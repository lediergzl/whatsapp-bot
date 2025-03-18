const express = require('express');
const qrcode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Base de datos
const db = new sqlite3.Database('./subscriptions.db');

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
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Panel web corriendo en puerto ${PORT}`);
});

module.exports = app;