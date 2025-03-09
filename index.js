
// Este archivo inicia el bot de WhatsApp
require('./bot.js');
require('./keep_alive');

// Mantener el proceso vivo
const express = require('express');
const app = express();

// Ruta principal - muestra página básica
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Bot de WhatsApp</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .status { color: green; font-weight: bold; }
                    .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Bot de WhatsApp</h1>
                    <p>Estado: <span class="status">Funcionando</span></p>
                    <p>Última actividad: ${new Date().toLocaleString()}</p>
                </div>
            </body>
        </html>
    `);
});

// Ruta para health check
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Variable global para almacenar el último QR
let latestQR = '';

// Función para que el bot guarde el QR
const saveQR = (qr) => {
    latestQR = qr;
};

// Exportar la función para que bot.js pueda acceder a ella
module.exports.saveQR = saveQR;

// Ruta para mostrar el QR en web
app.get('/qr', (req, res) => {
    if (!latestQR) {
        return res.send('No hay código QR disponible aún. Espera un momento y recarga la página.');
    }
    
    res.send(`
        <html>
            <head>
                <title>Código QR de WhatsApp</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                    .qr-container { max-width: 300px; margin: 0 auto; }
                    img { max-width: 100%; height: auto; }
                    .refresh { margin-top: 20px; }
                    button { padding: 10px 20px; background-color: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; }
                </style>
            </head>
            <body>
                <h1>Escanea este código QR en WhatsApp</h1>
                <div class="qr-container">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(latestQR)}&size=300x300" alt="WhatsApp QR Code">
                </div>
                <p>Si el código no funciona, intenta recargar la página o reiniciar el bot</p>
                <div class="refresh">
                    <button onclick="location.reload()">Recargar QR</button>
                </div>
            </body>
        </html>
    `);
});

// Prevenir que el proceso se detenga por errores no capturados
process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
