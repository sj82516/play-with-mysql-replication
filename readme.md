# Play with MySQL Replication
了解 MySQL Replication 使用，並檢視在 RDS 上的功能，採用 MySQL v5.7，測試環境使用 docker

## 操作
1. 針對 1.x 的測試使用 docker compose
   1. `1.x` 使用 `$docker compose up`，等到 MySQL 啟動後並出現 ready for connections 代表完成
   2. 對應的測試 script 用 node.js 撰寫，執行 `$node test/index.js`
   3. 如果要重跑實驗最好清掉 container `$docker container prune`

測驗的方式只要是
1. 寫入 source，預期 hello1/hello2 要被同步
2. 調整 replica
3. 寫入 source
4. 檢查 hello3/hello4 有沒有被同步，就知道 step2 有沒有影響同步機制

## 說明
### MySQL Replication
需要幫 Source / Replica 都設定 server_id，為了同步順利開啟 gtid 功能

#### 實驗 1.1
透過 `replicate-do-table=db_name.tbl_name` 指定要同步的 table，也可以反向指定 `replicate-ignore-table=db_name.tbl_name`，哪些 table 不要同步，文件出處 [17.1.6.3 Replica Server Options and Variables](https://dev.mysql.com/doc/refman/8.0/en/replication-options-replica.html#option_mysqld_replicate-do-table)

MySQL Replication 是透過 binlog 同步到 replica，而 binlog 有三種格式
1. statement-based
2. row-based
3. mixed：結合上述兩種

不同的格式會影響同步的結果
1. `如果 default db 指定非同步的 db`，假設 replica 在 statement-based 格式指定 --replicate-do-db=sales，但以下的 sql 不會被同步
```sql
USE prices;
UPDATE sales.january SET amount=amount+1000;
```
文件提到因為如果 statement 中有跨多個 database，因為判斷上的麻煩所以一率不同步；而 row-based 可以同步
> The main reason for this “check just the default database” behavior is that it is difficult from the statement alone to know whether it should be replicated

2. 如果是在一個 statement 中指定多個 db，則 statement-based 會所有 db 都影響，不論有沒有在允許範圍內；而 row-based 只有允許的 db 受影響，例如 replica 指定 --replicate-do-db=db1
```sql
USE db1;
UPDATE db1.table1, db2.table2 SET db1.table1.col1 = 10, db2.table2.col2 = 20;
```
statement-based 會 `db1, db2 都更新`而 row-based 只有 db1 更新

可以看出 row-based 的 binlog 格式相對安全許多，也比較符合預期

#### 1.2.1 實驗
測試INSERT 新資料到同步的 Table 會導致 replication 中斷，並在 log 看到錯誤
> [ERROR] Error running query, slave SQL thread aborted. Fix the problem, and restart the slave SQL thread with "SLAVE START". We stopped at log 'mysql-bin.000003' position 1310.

#### 1.2.2 實驗
測試如果寫入不在同步範圍的 Table，這部分是沒問題的

#### 1.2.3 實驗
如果是 statement-based 的同步方式，更新 Table schema 是否影響
1. 新增欄位，並修改已同步的資料 => statement-based / row-based 都可以
2. 調整既有欄位，我把 varchar(255) 改成 varchar(200) => row-based 不行，但是 statement 可以
3. 增加 Index => 都可以

#### 1.3 實驗
指定多個 source 同步到一個 replica 上，需要調整 replica 設定
```
mysql> STOP SLAVE;
mysql> SET GLOBAL master_info_repository = 'TABLE';
mysql> SET GLOBAL relay_log_info_repository = 'TABLE';
```
在 replica 中，需要指定不同的 channel
```
mysql> CHANGE MASTER TO MASTER_HOST="source2" .... FOR CHANNEL "source_2";
mysql> START SLAVE FOR CHANNEL "source_2";
```
如果故意把 source1 / source2 的 database / table 都取一樣產生衝突，會導致複製失敗
> [Error] running query, slave SQL thread aborted. Fix the problem, and restart the slave SQL thread with "SLAVE START". We stopped at log 'mysql-bin.000003' position 1046

## 2.0 實驗
把實驗搬到了 RDS，設定檔主要有三份
1. row-based => 把 binlog_format 改成 ROW
2. statement-based => 把 binlog_format 改成 STATEMENT
3. replica => read_only 改成 `0`，記得要 reboot 才能生效

另外再開啟機器部分，記得 source DB 必須開啟 backup，否則不能開 read replica，猜測是避免 source DB 寫入多筆資料的情況，有 backup 才能直接開啟 replica 並開始同步

因為文件標明不支援 multi-resouse，所以只測其餘的
1. 開新的 Table => OK
2. 建立 Index => OK
3. 新增欄位並修改既有的資料 => OK
4. 調整既有欄位 => row-based 不行，錯誤碼相同 / statement-based 可以
> 2021-10-09T23:15:12.092294Z 36 [ERROR] Slave SQL for channel '': Column 1 of table 'test.test' cannot be converted from type 'varchar(255(bytes))' to type 'varchar(200(bytes) latin1)', Error_code: 1677
2021-10-09T23:15:12.092305Z 36 [ERROR] Error running query, slave SQL thread aborted. Fix the problem, and restart the slave SQL thread with "SLAVE START". We stopped at log 'mysql-bin-changelog.000155' position 3419.

## 結語
實驗結果跟一開始猜想差不多，replication 就是單純把 binlog 同步到 replica 上執行一遍，所以只要指令能成功跑起來，replica 要做什麼其他的操作都是沒問題，這會在涉及到 row-based / statement-based binlog 的差異  
rds 部分基本與 mysql 相同