const mysql = require('mysql2/promise');
const {
    connectDB,
    setUpReplication,
    closeConnection
} = require('../../common');

async function main() {
    await loop(3307, "test", "source");
    await loop(3309, "test2", "source2"); 
}

main();

async function loop(sourcePort, name, source) {
    const sourceDBConnection = await connectDB('localhost', sourcePort);
    const replicaDBConnection = await connectDB('localhost');
    await setUpReplication(sourceDBConnection, replicaDBConnection, source, source);
    await createDBAndInsertData(sourceDBConnection, name);
    await new Promise(resolve => setTimeout(resolve, 5000)); 
    await writeToSource(sourceDBConnection, name);
    await checkDataInReplica(replicaDBConnection, name);
    await closeConnection(sourceDBConnection, replicaDBConnection);
}

async function createDBAndInsertData(sourceDBConnection, name) {
    await sourceDBConnection.execute(`CREATE SCHEMA IF NOT EXISTS ${name}`);
    await sourceDBConnection.execute(`CREATE TABLE IF NOT EXISTS ${name}.${name} ( id int AUTO_INCREMENT, name varchar(255), PRIMARY KEY (id) )`);
    await sourceDBConnection.execute(`INSERT INTO ${name}.${name} (name) VALUES ('hello') `);
}

async function writeToSource(sourceDBConnection, name) {
    await sourceDBConnection.execute(`INSERT INTO ${name}.${name} (name) VALUES ('hello3') `);
    await sourceDBConnection.execute(`INSERT INTO ${name}.${name} (name) VALUES ('hello4') `);
}

async function checkDataInReplica(replicaDBConnection, name) {
    let [rows] = await replicaDBConnection.execute(`SELECT * FROM ${name}.${name}`);
    console.log(rows);
}