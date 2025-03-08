
// Este script ayuda a mantener el bot activo en servicios gratuitos
const https = require('https');

// URL de tu aplicación - actualiza esto cuando la despliegues
const URL = process.env.APP_URL || 'https://tu-app.glitch.me';

// Hacer ping a la aplicación cada 5 minutos para evitar que se duerma
setInterval(() => {
    https.get(URL + '/ping', (res) => {
        console.log(`[${new Date().toISOString()}] Servicio activo. Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('Error haciendo ping:', err.message);
    });
}, 5 * 60 * 1000); // 5 minutos

module.exports = { keepAlive: true };
