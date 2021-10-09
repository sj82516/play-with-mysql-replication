# Play with MySQL Replication
了解 MySQL Replication 使用，並檢視在 RDS 上的功能，採用 MySQL v5.7，測試環境使用 docker

## 操作
1. 針對 1.x 的測試使用 docker compose
   1. `1.x` 使用 `$docker compose up`，等到 MySQL 啟動後並出現 ready for connections 代表完成
   2. 對應的測試 script 用 node.js 撰寫，執行 `$node test/index.js`

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
測試寫入同步的 Table，這會導致 replication 中斷，並在 log 看到錯誤
> [ERROR] Error running query, slave SQL thread aborted. Fix the problem, and restart the slave SQL thread with "SLAVE START". We stopped at log 'mysql-bin.000003' position 1310.

#### 1.2.2 實驗
測試如果寫入不在同步範圍的 Table，這部分是沒問題的

#### 1.2.3 實驗
如果是 statement-based 的同步方式，更新 Table schema 是否影響
1. 新增欄位 => statement-based / row-based 都可以
2. 調整既有欄位 => row-based 不行，但是 statement 可以