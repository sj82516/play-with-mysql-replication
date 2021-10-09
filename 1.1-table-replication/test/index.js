const mysql = require('mysql2/promise');
const {
    connectSourceDB,
    connectReplicaDB,
    setUpReplication,
    closeConnection
} = require('../../common');

async function main() {
    const sourceDBConnection = await connectSourceDB('localhost');
    const replicaDBConnection = await connectReplicaDB('localhost');
    await setUpReplication(sourceDBConnection, replicaDBConnection);
    await createDBAndInsertData(sourceDBConnection);
    // 需要等一小段時間同步
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    await checkDataInReplica(replicaDBConnection);
    await closeConnection(sourceDBConnection, replicaDBConnection);
}

main();

async function createDBAndInsertData(sourceDBConnection) {
    await sourceDBConnection.execute("CREATE SCHEMA IF NOT EXISTS test");
    await sourceDBConnection.execute("CREATE TABLE IF NOT EXISTS `test`.`test` ( id int AUTO_INCREMENT, name varchar(255), PRIMARY KEY (id) )");
    await sourceDBConnection.execute("INSERT INTO `test`.`test` (name) VALUES ('hello') ");
    await sourceDBConnection.execute("CREATE TABLE IF NOT EXISTS `test`.`test2` ( id int AUTO_INCREMENT, name varchar(255), PRIMARY KEY (id) )");
    await sourceDBConnection.execute("INSERT INTO `test`.`test2` (name) VALUES ('hello') ");
}

async function checkDataInReplica(replicaDBConnection) {
    const [rows] = await replicaDBConnection.execute("SELECT * FROM `test`.`test`");
    console.log(rows);
    
    // 只有同步 test.test，所以 test.test2 不會出現在 replication 中
    try{
        const [rows] = await replicaDBConnection.execute("SELECT * FROM `test`.`test2`");
        console.log(rows);
    }catch(error) {
        console.log(error.sqlMessage);
    }
}