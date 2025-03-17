// panel.js

const express = require('express');
const qrcode = require('qrcode');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para procesar datos enviados desde formularios
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de la base de datos SQLite
const db = new sqlite3.Database('./subscriptions.db', (err) => {
  if (err) {
    console.error("❌ Error abriendo la DB:", err);
  } else {
    console.log("✅ Base de datos conectada.");
  }
});

// Crear tabla de suscripciones (si no existe)
// Se incluyen los campos: name, phone, token, confirmed, publicar_grupo, created_at y expiry_date.
db.run(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT,
    phone TEXT UNIQUE,
    name TEXT,
    token TEXT,
    confirmed INTEGER DEFAULT 0,
    publicar_grupo INTEGER DEFAULT 0,
    created_at TEXT,
    expiry_date TEXT,
    paid INTEGER DEFAULT 0,
    amount REAL DEFAULT 0
  )
`, (err) => {
  if (err) console.error("❌ Error creando la tabla:", err);
});

// GET /register: Muestra el formulario de registro
app.get('/register', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Registro de Usuario</title>
      </head>
      <body>
        <h1>Registro de Usuario</h1>
        <form method="POST" action="/register">
          <label>Nombre:</label>
          <input type="text" name="name" required /><br/><br/>
          <label>Teléfono (formato internacional, sin '+'):</label>
          <input type="text" name="phone" required /><br/><br/>
          <!-- Opcional: Puedes agregar un checkbox para permitir publicar en grupo -->
          <label>Permitir publicar en grupo:</label>
          <input type="checkbox" name="publicar_grupo" value="1" /><br/><br/>
          <button type="submit">Registrar</button>
        </form>
      </body>
    </html>
  `);
});

// POST /register: Procesa el formulario, genera un token y crea el registro
app.post('/register', (req, res) => {
  const { name, phone, publicar_grupo } = req.body;
  if (!name || !phone) {
    return res.send("Debe proporcionar nombre y teléfono.");
  }
  // Genera un token aleatorio de 8 caracteres (hexadecimal)
  const token = crypto.randomBytes(4).toString('hex');
  const now = new Date();
  const createdAt = now.toISOString();
  const FREE_TRIAL_DAYS = 7;
  const expiryDate = new Date(now.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const sql = "INSERT INTO subscriptions (name, phone, token, confirmed, publicar_grupo, created_at, expiry_date) VALUES (?, ?, ?, 0, ?, ?, ?)";
  // Si el checkbox se marca, publicar_grupo será 1; de lo contrario, 0.
  db.run(sql, [name, phone, token, publicar_grupo ? 1 : 0, createdAt, expiryDate], function(err) {
    if (err) {
      console.error("❌ Error registrando usuario:", err);
      return res.send("Error registrando usuario.");
    }
    // Se genera el enlace de confirmación que contiene el token
    const confirmUrl = `http://localhost:${PORT}/confirm?token=${token}`;
    // Se genera el QR code a partir del enlace de confirmación
    qrcode.toDataURL(confirmUrl, (err, qrDataUrl) => {
      if (err) {
        console.error("❌ Error generando QR:", err);
        return res.send("Error generando QR.");
      }
      res.send(`
        <html>
          <head>
            <title>Confirma tu Registro</title>
          </head>
          <body>
            <h1>Confirma tu Registro</h1>
            <p>Escanea el siguiente código QR con tu teléfono para confirmar tu registro:</p>
            <img src="${qrDataUrl}" /><br/><br/>
            <p>O haz clic en <a href="${confirmUrl}">este enlace</a> para confirmar.</p>
          </body>
        </html>
      `);
    });
  });
});

// GET /confirm: Confirma el registro mediante el token recibido
app.get('/confirm', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.send("Token no proporcionado.");
  }
  const sql = "UPDATE subscriptions SET confirmed = 1 WHERE token = ?";
  db.run(sql, [token], function(err) {
    if (err) {
      console.error("❌ Error confirmando registro:", err);
      return res.send("Error confirmando registro.");
    }
    if (this.changes === 0) {
      return res.send("Token inválido o ya confirmado.");
    }
    res.send(`
      <html>
        <head>
          <title>Registro Confirmado</title>
        </head>
        <body>
          <h1>Registro Confirmado</h1>
          <p>Tu registro ha sido confirmado. Ahora podrás usar el bot.</p>
        </body>
      </html>
    `);
  });
});

// (Opcional) Endpoint para consultar el estado de la suscripción por teléfono
app.get('/subscription', (req, res) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.send("Parámetro 'phone' requerido.");
  }
  db.get("SELECT * FROM subscriptions WHERE phone = ?", [phone], (err, row) => {
    if (err) {
      res.status(500).send("Error en la base de datos.");
    } else if (!row) {
      res.send("No se encontró suscripción para " + phone);
    } else {
      res.json(row);
    }
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Panel web corriendo en http://localhost:${PORT}`);
});
