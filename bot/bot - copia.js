const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const Bottleneck = require('bottleneck');
const comandos = require('./commands.js');

const filePath = './Charada.txt';
let charadas = [];
let TIEMPO_ELIMINACION_MS = 10000;

// Limitador para evitar spam
const limiter = new Bottleneck({
    minTime: 1500, // Mínimo 1.5 segundos entre mensajes
    maxConcurrent: 1 // Un solo mensaje a la vez
});

// Registro de mensajes enviados
const mensajesRecientes = new Map();

// Cargar charadas
async function cargarCharadas() {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        charadas = data.split('\n').map(line => {
            const [numero, ...palabras] = line.split(': ');
            return { numero: numero.trim(), palabras: palabras.join(': ').split(', ').map(word => word.trim()) };
        });
    } catch (err) {
        console.error('❌ Error leyendo el archivo:', err);
    }
}

// Control de mensajes recientes
function verificarFrecuencia(chatId) {
    const ahora = Date.now();
    if (mensajesRecientes.has(chatId)) {
        const tiempoUltimo = mensajesRecientes.get(chatId);
        if (ahora - tiempoUltimo < 5000) return false; // Si han pasado menos de 5s, bloquea
    }
    mensajesRecientes.set(chatId, ahora);
    setTimeout(() => mensajesRecientes.delete(chatId), 30000); // Limpia cada 30s
    return true;
}

// Retraso aleatorio antes de responder
async function enviarMensaje(sock, chatId, mensaje) {
    const retraso = Math.floor(Math.random() * 2000) + 1000; // Entre 1 y 3s
    await new Promise(resolve => setTimeout(resolve, retraso));
    return await sock.sendMessage(chatId, { text: mensaje });
}

// Buscar charada
function buscarCharada(query) {
    const numero = parseInt(query, 10);
    if (!isNaN(numero)) {
        const charada = charadas[numero - 1];
        return charada ? `Charada ${numero}: ${charada.palabras.join(', ')}` : '❌ Charada no encontrada.';
    } else {
        const resultados = charadas.filter(charada =>
            charada.palabras.some(word => word.toLowerCase().includes(query.toLowerCase()))
        );
        const numeros = resultados.map(charada => charada.numero);
        return numeros.length > 0
            ? `Resultados para "${query}": ${numeros.join(', ')}`
            : '❌ No se encontraron charadas con ese nombre.';
    }
}

// Manejador del comando !charada
async function manejarComandoCharada(sock, chat, mensaje) {
    const parts = mensaje.split(' ');
    if (parts[0] !== '!charada' || parts.length < 2) {
        return await enviarMensaje(sock, chat, 'Usa el comando correctamente: !charada <número o nombre>');
    }

    const query = parts.slice(1).join(' ');
    const respuesta = buscarCharada(query);
    await enviarMensaje(sock, chat, respuesta);
}

// Obtener mensaje anclado en el grupo
async function obtenerMensajeAnclado(sock, chat) {
    try {
        const metadata = await sock.groupMetadata(chat);
        const mensajeAnclado = metadata.announcement ? metadata.announcement : '🚫 No hay mensajes anclados.';
        await enviarMensaje(sock, chat, mensajeAnclado);
    } catch (err) {
        console.error('❌ Error obteniendo el mensaje anclado:', err);
        await enviarMensaje(sock, chat, '❌ No se pudo obtener el mensaje anclado.');
    }
}

// Iniciar bot
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['Bot Baileys', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('[INFO] Conexión cerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('[INFO] Bot conectado correctamente.');
        }
    });

    sock.ev.on('messages.upsert', async (msg) => {
        const m = msg.messages[0];
        if (!m.message || !m.key.remoteJid.endsWith('@g.us')) return;

        const chatId = m.key.remoteJid;
        const sender = m.key.participant;
        const text = m.message.conversation?.trim().toLowerCase() || '';
        const mencionados = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (!verificarFrecuencia(chatId)) {
            console.log(`[SPAM] Mensaje bloqueado por exceso de frecuencia en ${chatId}`);
            return;
        }

        try {
            await limiter.schedule(async () => {
                if (text === '!abrir') {
                    await comandos.abrirGrupo(sock, chatId, sender);
                } else if (text === '!cerrar') {
                    await comandos.cerrarGrupo(sock, chatId, sender);
                } else if (text === '!tarjeta') {
                    await obtenerMensajeAnclado(sock, chatId);
                } else if (text.startsWith('!estadisticas')) {
                    const parts = text.split(' ');
                    if (parts.length < 2) {
                        await enviarMensaje(sock, chatId, 'Especifica FLD para el día o FLN para la noche.');
                    } else {
                        const codigo = parts[1].toUpperCase();
                        let periodo;
                        if (codigo === 'FLD') {
                            periodo = 'Día';
                        } else if (codigo === 'FLN') {
                            periodo = 'Noche';
                        } else {
                            await enviarMensaje(sock, chatId, 'Código inválido. Usa FLD o FLN.');
                            return;
                        }
                        const datos = await comandos.obtenerEstadisticasPorPeriodo(sock, chatId, periodo);
                        const mensajeEstadisticas = comandos.formatearEstadisticas(periodo, datos);
                        await enviarMensaje(sock, chatId, mensajeEstadisticas);
                    }
                } else if (text.startsWith('!charada')) {
                    await manejarComandoCharada(sock, chatId, text);
                }
            });
        } catch (error) {
            console.error('❌ Error procesando mensaje:', error);
            await enviarMensaje(sock, chatId, '❌ Error al procesar tu solicitud.');
        }
    });
}

// Iniciar bot con charadas cargadas
async function iniciarBot() {
    await cargarCharadas();
    startBot();
}

iniciarBot();
