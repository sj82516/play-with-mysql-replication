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
    await changeReplicaTableSchema(replicaDBConnection);
    await writeToSource(sourceDBConnection);
    await checkDataInReplica(replicaDBConnection);
    await closeConnection(sourceDBConnection, replicaDBConnection);
}

main();

async function createDBAndInsertData(sourceDBConnection) {
    await sourceDBConnection.execute("CREATE SCHEMA IF NOT EXISTS test");
    await sourceDBConnection.execute("CREATE TABLE IF NOT EXISTS `test`.`test` ( id int AUTO_INCREMENT, name varchar(255), PRIMARY KEY (id) )");
    await sourceDBConnection.execute("INSERT INTO `test`.`test` (name) VALUES ('hello') ");
}

async function changeReplicaTableSchema(replicaDBConnection) {
    // await replicaDBConnection.execute("ALTER TABLE `test`.`test` ADD COLUMN `value` INT NULL AFTER `name`");
    await replicaDBConnection.execute("ALTER TABLE `test`.`test` CHANGE COLUMN `name` `name` VARCHAR(200) NULL DEFAULT NULL");
}

async function writeToSource(sourceDBConnection) {
    await sourceDBConnection.execute("INSERT INTO `test`.`test` (name) VALUES ('hello3') ");
    await sourceDBConnection.execute("INSERT INTO `test`.`test` (name) VALUES ('hello4') ");
}

async function checkDataInReplica(replicaDBConnection) {
    let [rows] = await replicaDBConnection.execute("SELECT * FROM `test`.`test`");
    console.log(rows);
}