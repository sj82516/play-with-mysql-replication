# Play with MySQL Replication
了解 MySQL Replication 使用，並檢視在 RDS 上的功能，採用 MySQL v5.7，測試環境使用 docker

共分成
1. MySQL Replication
   1. 指定 table
   2. 寫入新的資料到 Replication
      1. 更新 replication table
         1. statement-base replication
         2. row-base replication
   3. Multi-Source Replication
2. RDS MySQL Replication
   1. 指定 table?
   2. 寫入新資料到 Replication?
   3. (不支援) Multi-Source Replication
## 操作
1. 針對 1.x 的測試使用 docker compose
   1. `1.x` 使用 `$docker compose up`，等到 MySQL 啟動後並出現 listen on port 3306 代表完成
   2. 對應的測試 script 用 node.js 撰寫，執行 `$node test/index.js`

## 說明
### MySQL Replication
1. 需要幫 Source / Replica 都設定 server_id，為了同步順利開啟 gtid
   1. 在 1.1 實驗中，可以透過 `replicate-do-table=db_name.tbl_name` 指定要同步的 table，也可以反向指定 `replicate-ignore-table=db_name.tbl_name` 哪些 table 不要同步，文件出處 [17.1.6.3 Replica Server Options and Variables](https://dev.mysql.com/doc/refman/8.0/en/replication-options-replica.html#option_mysqld_replicate-do-table)