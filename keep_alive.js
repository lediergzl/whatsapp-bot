
// Este script ayuda a mantener el bot activo en servicios gratuitos
const https = require('https');
const http = require('http');

// URL de tu aplicación - detecta automáticamente
let APP_URL = process.env.APP_URL || '';

// Si no hay URL configurada, usamos un valor predeterminado basado en el puerto
if (!APP_URL) {
    const PORT = process.env.PORT || 3000;
    APP_URL = `http://localhost:${PORT}`;
}

console.log(`Keep-alive configurado para URL: ${APP_URL}`);

// Función para hacer ping a la aplicación
function pingApp() {
    try {
        // Determinar si usar http o https
        const httpModule = APP_URL.startsWith('https') ? https : http;
        
        httpModule.get(`${APP_URL}/ping`, (res) => {
            console.log(`[${new Date().toISOString()}] Servicio activo. Status: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('Error haciendo ping:', err.message);
        });
    } catch (error) {
        console.error('Error en ping:', error);
    }
}

// Hacer ping a la aplicación cada 5 minutos para evitar que se duerma
const INTERVALO_PING = 5 * 60 * 1000; // 5 minutos
setInterval(pingApp, INTERVALO_PING);

// Hacer ping inicial después de 30 segundos (dar tiempo a que inicie)
setTimeout(pingApp, 30 * 1000);

console.log(`Keep-alive configurado - Intervalo: ${INTERVALO_PING / 1000 / 60} minutos`);

module.exports = { keepAlive: true };
