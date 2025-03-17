const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('bot.db', (err) => {
    if (err) console.error('❌ Error al conectar con SQLite:', err);
    else console.log('✅ Base de datos conectada.');
});

// Crear tabla de límites si no existe
db.run(`CREATE TABLE IF NOT EXISTS limites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo TEXT UNIQUE,
    limite INTEGER
)`);

module.exports = db;
