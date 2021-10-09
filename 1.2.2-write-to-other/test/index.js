const mysql = require('mysql2/promise');

async function main() {
    const sourceDBConnection = await connectSourceDB();
    const replicaDBConnection = await connectReplicaDB();
    await setUpReplication(sourceDBConnection, replicaDBConnection);
    await createDBAndInsertData(sourceDBConnection);
    // 需要等一小段時間同步
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    await writeToReplica(replicaDBConnection);
    await writeToSource(sourceDBConnection);
    await checkDataInReplica(replicaDBConnection);
    await closeConnection(sourceDBConnection, replicaDBConnection);
}

main();

async function connectSourceDB() {
    return await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'root',
        port: 3307
    })
}

async function connectReplicaDB() {
    return await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'root',
        port: 3308
    })
}

async function setUpReplication(sourceDBConnection, replicaDBConnection) {
    createReplcaUser(sourceDBConnection);
    startReplica(replicaDBConnection);
}

async function createReplcaUser(sourceDBConnection){
    await sourceDBConnection.execute("CREATE USER IF NOT EXISTS 'repl' identified by 'repl'");
    await sourceDBConnection.execute("GRANT REPLICATION slave on *.* to 'repl'");
}

async function startReplica(replicaDBConnection) {
    await replicaDBConnection.execute("CHANGE MASTER TO MASTER_HOST='source', MASTER_USER='repl', MASTER_PASSWORD='repl'");
    await replicaDBConnection.execute("START SLAVE");
}

async function createDBAndInsertData(sourceDBConnection) {
    await sourceDBConnection.execute("CREATE SCHEMA IF NOT EXISTS test");
    await sourceDBConnection.execute("CREATE TABLE IF NOT EXISTS `test`.`test` ( id int AUTO_INCREMENT, name varchar(255), PRIMARY KEY (id) )");
    await sourceDBConnection.execute("INSERT INTO `test`.`test` (name) VALUES ('hello') ");
}

async function writeToReplica(replicaDBConnection) {
    await replicaDBConnection.execute("CREATE TABLE IF NOT EXISTS `test`.`test2` ( id int AUTO_INCREMENT, name varchar(255), PRIMARY KEY (id) )");
    await replicaDBConnection.execute("INSERT INTO `test`.`test2` (name) VALUES ('hello') ");
}

async function writeToSource(sourceDBConnection) {
    await sourceDBConnection.execute("INSERT INTO `test`.`test` (name) VALUES ('hello3') ");
    await sourceDBConnection.execute("INSERT INTO `test`.`test` (name) VALUES ('hello4') ");
}

async function checkDataInReplica(replicaDBConnection) {
    let [rows] = await replicaDBConnection.execute("SELECT * FROM `test`.`test`");
    console.log(rows);
    [rows] = await replicaDBConnection.execute("SELECT * FROM `test`.`test2`");
    console.log(rows);
}

async function closeConnection(sourceDBConnection, replicaDBConnection) {
    await sourceDBConnection.destroy();
    await replicaDBConnection.destroy();
}