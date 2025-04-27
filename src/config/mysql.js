const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '0000',
    database: 'dc',
    connectionLimit: 20,
    enableKeepAlive: true, // Keep-Alive 활성화
    keepAliveInitialDelay: 10000, // Keep-Alive 초기 지연 (ms 단위)
});

module.exports = pool;
