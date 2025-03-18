const express = require('express');
const qrcode = require('qrcode');
const path = require('path');
const { startBot } = require('./bot');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = new sqlite3.Database('./subscriptions.db');

// Create bot_instances table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS bot_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_phone TEXT UNIQUE,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error("Error creating table:", err);
});


// API for creating bot instances
app.post('/api/instance/create', async (req, res) => {
  const { phone } = req.body;

  try {
    const sock = await startBot(phone);

    // Generate QR and send it to the client
    if (sock.authState.creds.registered === false) {
      const qr = await new Promise((resolve) => {
        sock.ev.on('connection.update', ({ qr }) => {
          if (qr) resolve(qr);
        });
      });

      const qrImage = await qrcode.toDataURL(qr);
      //Adding bot instance to db
      db.run('INSERT INTO bot_instances (user_phone, is_active) VALUES (?, 1)', [phone], function(err){
        if(err) console.error("Error inserting bot instance:",err);
      });
      res.json({ success: true, qr: qrImage });
    } else {
      res.json({ success: true, message: 'Bot ya está autenticado' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API to get bot instance status
app.get('/api/instance/status/:phone', (req, res) => {
  const { phone } = req.params;

  db.get('SELECT * FROM bot_instances WHERE user_phone = ?', [phone], (err, row) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, status: row ? row.is_active : false });
    }
  });
});


// Configuración de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rutas del panel
app.get('/admin', async (req, res) => {
  const subscribers = await queryDb('SELECT * FROM subscriptions ORDER BY created_at DESC');
  const groups = await queryDb('SELECT * FROM groups');
  res.render('admin', { subscribers, groups });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const { name, phone, publicar_grupo } = req.body;
  const token = crypto.randomBytes(4).toString('hex');
  const now = new Date();
  const expiryDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 días

  try {
    await queryDb(
      'INSERT INTO subscriptions (name, phone, token, confirmed, publicar_grupo, created_at, expiry_date) VALUES (?, ?, ?, 0, ?, ?, ?)',
      [name, phone, token, publicar_grupo ? 1 : 0, now.toISOString(), expiryDate.toISOString()]
    );

    const qrUrl = await qrcode.toDataURL(`http://${req.headers.host}/confirm?token=${token}`);
    res.render('confirmation', { qrUrl, token });
  } catch (err) {
    res.status(500).render('error', { error: 'Error en el registro' });
  }
});

app.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await queryDb('UPDATE subscriptions SET confirmed = 1 WHERE token = ?', [token]);
    if (result.changes > 0) {
      const user = await queryDb('SELECT * FROM subscriptions WHERE token = ?', [token]);
      // Enviar mensaje de confirmación via bot
      global.sock?.sendMessage(user.phone + '@s.whatsapp.net', {
        text: '✅ Tu suscripción ha sido confirmada. Válida hasta: ' + new Date(user.expiry_date).toLocaleDateString()
      });
      res.render('success', { message: 'Suscripción confirmada exitosamente' });
    } else {
      res.render('error', { error: 'Token inválido o ya utilizado' });
    }
  } catch (err) {
    res.render('error', { error: 'Error en la confirmación' });
  }
});

// API para el bot
app.post('/api/group/subscribe', async (req, res) => {
  const { groupId, name } = req.body;
  try {
    await queryDb('INSERT INTO groups (group_id, name) VALUES (?, ?)', [groupId, name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al suscribir grupo' });
  }
});

function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Panel running on port ${PORT}`);
});

module.exports = app;