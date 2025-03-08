
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
