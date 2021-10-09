const mysql = require('mysql2/promise');

exports.connectSourceDB = async function connectSourceDB(url, port = 3307) {
    return await mysql.createConnection({
        host: url,
        user: 'root',
        password: 'rootroot',
        port: port
    })
}

exports.connectReplicaDB = async function connectReplicaDB(url) {
    return await mysql.createConnection({
        host: url,
        user: 'root',
        password: 'rootroot',
        port: 3308
    })
}

exports.closeConnection = async function closeConnection(sourceDBConnection, replicaDBConnection) {
    await sourceDBConnection.destroy();
    await replicaDBConnection.destroy();
}

exports.setUpReplication = async function setUpReplication(sourceDBConnection, replicaDBConnection, source = "source") {
    createReplcaUser(sourceDBConnection);
    startReplica(replicaDBConnection, source);
}

async function createReplcaUser(sourceDBConnection){
    await sourceDBConnection.execute("CREATE USER IF NOT EXISTS 'repl' identified by 'repl'");
    await sourceDBConnection.execute("GRANT REPLICATION slave on *.* to 'repl'");
}

async function startReplica(replicaDBConnection, source) {
    await replicaDBConnection.execute(`CHANGE MASTER TO MASTER_HOST='${source}', MASTER_USER='repl', MASTER_PASSWORD='repl' FOR CHANNEL "${source}"`);
    await replicaDBConnection.execute(`START SLAVE FOR CHANNEL "${source}"`);
}