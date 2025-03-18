// bot.js

// ================= Dependencias =================
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');
const Bottleneck = require('bottleneck');
const comandos = require('./commands.js');
const { descargarTabla } = require('./imagen.js');
const { banearUsuario, obtenerTarjeta } = require('./commands.js');
const { extraerResultados, enviarResultadosAGrupos } = require('./resultados.js');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// ================= Base de Datos (SQLite) =================
const db = new sqlite3.Database('./subscriptions.db', (err) => {
  if (err) console.error("❌ Error abriendo la DB:", err);
  else console.log("✅ Base de datos conectada.");
});

db.run(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT, 
    phone TEXT,
    name TEXT,
    token TEXT,
    confirmed INTEGER DEFAULT 0,
    publicar_grupo INTEGER DEFAULT 0,
    created_at TEXT,
    expiry_date TEXT,
    paid INTEGER DEFAULT 0,
    amount REAL DEFAULT 0
  )
`);

// ================= Helper: Obtener permiso para publicar en grupo =================
function obtenerPublicarGrupo(phone) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT publicar_grupo FROM subscriptions WHERE phone = ? AND confirmed = 1", 
      [phone], 
      (err, row) => {
        if (err) return reject(err);
        console.log(`Obtener permiso publicar para ${phone}:`, row ? row.publicar_grupo : 'No encontrado');
        resolve(row ? row.publicar_grupo === 1 : false);
      }
    );
  });
}

// ================= Función para verificar mensajes anclados =================
async function checkPinnedMessage(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId);
    const pinned = metadata.pinnedMessage 
      ? (metadata.pinnedMessage.message?.conversation ||
         metadata.pinnedMessage.message?.extendedTextMessage?.text || '')
      : '';

    db.get("SELECT mensaje FROM mensajes_anclados WHERE grupo = ?", [groupId], (err, row) => {
      if (err) {
        console.error(`❌ Error consultando mensaje anclado para ${groupId}:`, err);
        return;
      }
      if (!row && pinned) {
        db.run(
          `INSERT INTO mensajes_anclados (grupo, mensaje) VALUES (?, ?)`,
          [groupId, pinned],
          (err) => {
            if (err) console.error(`❌ Error guardando mensaje anclado para ${groupId}:`, err);
            else {
              console.log(`📌 Nuevo mensaje anclado registrado para ${groupId}`);
              sock.sendMessage(groupId, { text: "📌 Se ha fijado un nuevo mensaje." });
            }
          }
        );
      } else if (row && row.mensaje !== pinned) {
        if (!pinned) {
          db.run("DELETE FROM mensajes_anclados WHERE grupo = ?", [groupId], (err) => {
            if (err) console.error(`❌ Error eliminando mensaje anclado para ${groupId}:`, err);
            else {
              console.log(`📌 Mensaje anclado removido para ${groupId}`);
              sock.sendMessage(groupId, { text: "📌 El mensaje anclado ha sido removido." });
            }
          });
        } else {
          db.run("UPDATE mensajes_anclados SET mensaje = ? WHERE grupo = ?", [pinned, groupId], (err) => {
            if (err) console.error(`❌ Error actualizando mensaje anclado para ${groupId}:`, err);
            else {
              console.log(`📌 Mensaje anclado actualizado para ${groupId}`);
              sock.sendMessage(groupId, { text: "📌 El mensaje anclado ha sido actualizado." });
            }
          });
        }
      }
    });
  } catch (err) {
    console.error(`❌ Error obteniendo metadata para ${groupId}:`, err);
  }
}

// ================= Función para enviar menú interactivo =================
async function enviarMenuComandos(sock, chatId) {
  const mensaje = `📌 *Menú de Comandos*\n\n` +
    `🔠 *!charada <número o palabra>* - Buscar una charada\n` +
    `📊 *!estadisticas <código>* - Ver estadísticas (Ej: FLD, FLN, GAD, etc.)\n` +
    `🎯 *!resultados <día/noche>* - Obtener resultados recientes\n` +
    `➕ *!add* - Suscribir el bot al grupo\n` +
    `🚫 *!ban @usuario* - Banear a un usuario del grupo\n` +
    `🧮 *!calc <operación>* - Calcular una expresión matemática\n` +
    `👋 *!hola* - Saludar al bot\n\n` +
    `⚡ Escribe un comando en el chat para ejecutarlo.`;

  await sock.sendMessage(chatId, { text: mensaje });
}




// ================= Otras variables y funciones globales =================
const filePathCharadas = './Charada.txt';
let charadas = [];

const mensajesRecientes = new Map();
const enviosAutomaticos = new Map();
const pendingAdminResult = new Map();

const limiter = new Bottleneck({
  minTime: 1500,
  maxConcurrent: 1
});

const frecuenciaUsuarios = new Map();
function verificarFrecuenciaUsuario(sender) {
  const ahora = Date.now();
  if (frecuenciaUsuarios.has(sender)) {
    const ultimoTiempo = frecuenciaUsuarios.get(sender);
    if (ahora - ultimoTiempo < 5000) return false;
  }
  frecuenciaUsuarios.set(sender, ahora);
  setTimeout(() => frecuenciaUsuarios.delete(sender), 30000);
  return true;
}

async function cargarCharadas() {
  try {
    const data = await fs.promises.readFile(filePathCharadas, 'utf8');
    charadas = data.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        const [numero, ...palabras] = line.split(': ');
        return {
          numero: numero.trim(),
          palabras: palabras.join(': ').split(', ').map(word => word.trim())
        };
      });
    console.log("Charadas cargadas:", charadas.length);
  } catch (err) {
    console.error('❌ Error leyendo el archivo de charadas:', err);
  }
}

async function enviarMensaje(sock, chatId, mensaje) {
  const retraso = Math.floor(Math.random() * 2000) + 1000;
  await new Promise(resolve => setTimeout(resolve, retraso));
  return await sock.sendMessage(chatId, { text: mensaje });
}

async function enviarMensajePrivado(sock, userJid, mensaje) {
  const retraso = Math.floor(Math.random() * 2000) + 1000;
  await new Promise(resolve => setTimeout(resolve, retraso));
  return await sock.sendMessage(userJid, { text: mensaje });
}

// ================= Funciones para el comando !charada =================
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

async function manejarComandoCharada(sock, chat, mensaje, sender) {
  const parts = mensaje.split(' ');
  if (parts[0] !== '!charada' || parts.length < 2) {
    return await enviarMensajePrivado(sock, sender, 'Usa el comando correctamente: !charada <número o nombre>');
  }
  const query = parts.slice(1).join(' ');
  const respuesta = buscarCharada(query);
  await enviarMensajePrivado(sock, sender, respuesta);
  await enviarMensaje(sock, chat, `@${sender.split('@')[0]} te envié la información por privado.`);
}

// ================= Funciones para Estadísticas y Resultados =================
const periodMapping = {
  'FLD': { lottery: 'florida', period: 'dia' },
  'FLN': { lottery: 'florida', period: 'noche' },
  'GAD': { lottery: 'georgia', period: 'dia' },
  'GAT': { lottery: 'georgia', period: 'tarde' },
  'GAN': { lottery: 'georgia', period: 'noche' },
  'NYD': { lottery: 'newyork', period: 'dia' },
  'NYN': { lottery: 'newyork', period: 'noche' }
};

async function manejarSolicitudEstadisticas(sock, chatId, sender, code) {
  if (!periodMapping[code]) {
    await enviarMensajePrivado(sock, sender, 'Código inválido. Usa: FLD, FLN, GAD, GAT, GAN, NYD, NYN.');
    return;
  }
  const { lottery, period } = periodMapping[code];
  try {
    const datos = await comandos.obtenerEstadisticasPorPeriodo(lottery, period);
    const mensajeEstadisticas = comandos.formatearEstadisticas(lottery, period.charAt(0).toUpperCase() + period.slice(1), datos);
    const tablaBuffer = await descargarTabla(lottery, period);
    const groupMetadata = await sock.groupMetadata(chatId);
    const phone = sender.replace('@s.whatsapp.net', '');
    const permitirPublicar = await obtenerPublicarGrupo(phone);
    if (groupMetadata && (groupMetadata.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')) || permitirPublicar)) {
      await sock.sendMessage(chatId, { image: tablaBuffer, caption: mensajeEstadisticas });
    } else {
      await sock.sendMessage(sender, { image: tablaBuffer, caption: mensajeEstadisticas });
      await enviarMensaje(sock, chatId, `@${sender.split('@')[0]} te envié las estadísticas por privado.`);
    }
  } catch (error) {
    console.error('❌ Error enviando estadísticas:', error);
    await enviarMensajePrivado(sock, sender, '❌ Error al obtener las estadísticas.');
  }
}

async function manejarSolicitudResultados(sock, chatId, sender, periodo) {
  try {
    if (!periodo) {
      await enviarMensajePrivado(sock, sender, 'Especifica el período: "dia" o "noche".');
      return;
    }
    let periodoNormalizado;
    if (['dia', 'día', 'fld'].includes(periodo.toLowerCase())) {
      periodoNormalizado = 'dia';
    } else if (['noche', 'noc', 'fln'].includes(periodo.toLowerCase())) {
      periodoNormalizado = 'noche';
    } else {
      await enviarMensajePrivado(sock, sender, 'Período no válido. Usa "dia" o "noche".');
      return;
    }
    const datos = await comandos.obtenerEstadisticasPorPeriodo('florida', periodoNormalizado);
    const mensajeEstadisticas = comandos.formatearEstadisticas('florida', 
      periodoNormalizado.charAt(0).toUpperCase() + periodoNormalizado.slice(1), datos);
    const groupMetadata = await sock.groupMetadata(chatId);
    const phone = sender.replace('@s.whatsapp.net', '');
    const permitirPublicar = await obtenerPublicarGrupo(phone);
    const tablaBuffer = await descargarTabla('florida', periodoNormalizado);
    if (groupMetadata && (groupMetadata.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')) || permitirPublicar)) {
      await sock.sendMessage(chatId, { image: tablaBuffer, caption: `📊 RESULTADOS ${periodoNormalizado.toUpperCase()}\n\n${mensajeEstadisticas}` });
    } else {
      await sock.sendMessage(sender, { image: tablaBuffer, caption: `📊 RESULTADOS ${periodoNormalizado.toUpperCase()}\n\n${mensajeEstadisticas}` });
      await enviarMensaje(sock, chatId, `@${sender.split('@')[0]} te envié los resultados por privado.`);
    }
  } catch (error) {
    console.error('❌ Error obteniendo resultados:', error);
    await enviarMensajePrivado(sock, sender, '❌ Error al obtener los resultados.');
  }
}

// Comando para suscribir el bot a un grupo
function procesarComandoSuscribirGrupo(sock, chatId, sender) {
  const phone = sender.replace('@s.whatsapp.net', '');
  db.get("SELECT * FROM subscriptions WHERE phone = ? AND confirmed = 1", [phone], async (err, row) => {
    if (err) {
      console.error("❌ Error en DB:", err);
      return;
    }
    if (!row) return;
    const publicar = row.publicar_grupo === 1;
    console.log(`Usuario ${phone} publicar en grupo: ${publicar}`);
    if (publicar) {
      programarEnviosAutomaticos(sock, chatId);
      await enviarMensaje(sock, chatId, "El bot ha sido suscrito a este grupo.");
    } else {
      await enviarMensaje(sock, chatId, "No tienes permiso para suscribir el bot a este grupo.");
    }
  });
}

// ================= Control de Acceso y Procesamiento de Comandos =================
// Solo se procesan comandos (mensajes que comienzan con "!") y usuarios registrados
function checkSubscriptionAndProcess(sock, sender, message) {
  const phone = sender.replace('@s.whatsapp.net', '');
  db.get("SELECT * FROM subscriptions WHERE phone = ? AND confirmed = 1", [phone], (err, row) => {
    if (err) {
      console.error("❌ Error en DB:", err);
      return;
    }
    if (!row) {
      console.log(`No se encontró registro para ${phone}`);
      return;
    }
    const now = new Date();
    if (new Date(row.expiry_date) < now) {
      console.log(`Suscripción de ${phone} ha expirado.`);
      return;
    }
    processCommandMessage(sock, sender, message);
  });
}

function processCommandMessage(sock, sender, message) {
  const chatId = message.key.remoteJid;
  const text = (message.message.conversation ||
                message.message.extendedTextMessage?.text ||
                "").trim().toLowerCase();
  if (!text.startsWith('!')) return;

  // Comando para abrir el menú interactivo
  if (text === '!menu') {
    enviarMenuComandos(sock, chatId);
    return;
  }

  // Si se ejecuta en grupo, se verifica el mensaje anclado en ese grupo
  if (chatId.endsWith('@g.us')) {
    checkPinnedMessage(sock, chatId);
  }

  // Resto de comandos
  if (text.startsWith('!calc')) {
    comandos.calcular(sock, chatId, sender, text.substring(5).trim());
  } else if (text.startsWith('!charada')) {
    manejarComandoCharada(sock, chatId, text, sender);
  } else if (chatId.endsWith('@g.us')) {
    if (text === '!abrir') {
      comandos.abrirGrupo(sock, chatId, sender);
    } else if (text === '!cerrar') {
      comandos.cerrarGrupo(sock, chatId, sender);
    } else if (text === '!tarjeta') {
      obtenerTarjeta(sock, chatId);
    } else if (text === '!add') {
      procesarComandoSuscribirGrupo(sock, chatId, sender);
    } else if (text.startsWith('!estadisticas')) {
      const parts = text.split(' ');
      if (parts.length < 2) {
        enviarMensajePrivado(sock, sender, 'Por favor especifica el código. Ejemplos: FLD, FLN, NYD, NYN, GAD, GAT, GAN.');
        return;
      }
      const code = parts[1].toUpperCase();
      manejarSolicitudEstadisticas(sock, chatId, sender, code);
    } else if (text.startsWith('!resultados')) {
      const parts = text.split(' ');
      const periodo = parts.length > 1 ? parts[1] : null;
      manejarSolicitudResultados(sock, chatId, sender, periodo);
    } else if (text.startsWith('!ban')) {
      const mencionados = message.message.extendedTextMessage?.contextInfo?.mentionedJid;
      if (!chatId.endsWith('@g.us')) {
        enviarMensaje(sock, chatId, 'El comando !ban solo es válido en grupos');
        return;
      }
      if (!mencionados || mencionados.length === 0) {
        enviarMensaje(sock, chatId, 'Debes mencionar al usuario que deseas banear');
        return;
      }
      const razon = text.split('!ban').pop().trim(); // Extract reason from command
      try {
        banearUsuario(sock, chatId, sender, mencionados, razon);
        enviarMensaje(sock, chatId, 'Usuario baneado con éxito');
      } catch (error) {
        console.error('Error al banear usuario:', error);
        enviarMensaje(sock, chatId, 'Error al banear usuario: ' + error.message);
      }
    } else {
      enviarMensaje(sock, chatId, "Comando no reconocido.");
    }
  } else {
    enviarMensaje(sock, chatId, "Comando no reconocido. Prueba con !hola.");
  }
}

// ================= Función de Envío Automático =================
function programarEnviosAutomaticos(sock, chatId) {
  if (enviosAutomaticos.has(chatId)) {
    const timers = enviosAutomaticos.get(chatId);
    timers.forEach(timer => clearTimeout(timer));
  }

  const ahora = new Date();
  // Estadísticas del día
  const horaAleatoriaDia = Math.floor(Math.random() * 3) + 12;
  const minutoAleatorioDia = Math.floor(Math.random() * 60);
  const proximoDia = new Date();
  proximoDia.setHours(horaAleatoriaDia, minutoAleatorioDia, 0, 0);
  if (proximoDia < ahora) proximoDia.setDate(proximoDia.getDate() + 1);
  const milisegundosEsperaDia = proximoDia.getTime() - ahora.getTime();

  const timerDia = setTimeout(async () => {
    try {
      console.log(`[AUTO] Enviando estadísticas del día para ${chatId}`);
      const datos = await comandos.obtenerEstadisticasPorPeriodo('florida', 'dia');
      const mensajeEstadisticas = comandos.formatearEstadisticas('florida', 'Día', datos);
      const tablaBuffer = await descargarTabla('florida', 'dia');
      await sock.sendMessage(chatId, { image: tablaBuffer, caption: `📊 RESULTADOS AUTOMÁTICOS DEL DÍA\n\n${mensajeEstadisticas}` });
      programarEnviosAutomaticos(sock, chatId);
    } catch (error) {
      console.error('❌ Error enviando estadísticas automáticas:', error);
    }
  }, milisegundosEsperaDia);

  // Estadísticas de la noche
  const horaAleatoriaNoche = Math.floor(Math.random() * 3) + 20;
  const minutoAleatorioNoche = Math.floor(Math.random() * 60);
  const proximaNoche = new Date();
  proximaNoche.setHours(horaAleatoriaNoche, minutoAleatorioNoche, 0, 0);
  if (proximaNoche < ahora) proximaNoche.setDate(proximaNoche.getDate() + 1);
  const milisegundosEsperaNoche = proximaNoche.getTime() - ahora.getTime();

  const timerNoche = setTimeout(async () => {
    try {
      console.log(`[AUTO] Enviando estadísticas de la noche para ${chatId}`);
      const datos = await comandos.obtenerEstadisticasPorPeriodo('florida', 'noche');
      const mensajeEstadisticas = comandos.formatearEstadisticas('florida', 'Noche', datos);
      const tablaBuffer = await descargarTabla('florida', 'noche');
      await sock.sendMessage(chatId, { image: tablaBuffer, caption: `📊 RESULTADOS AUTOMÁTICOS DE LA NOCHE\n\n${mensajeEstadisticas}` });
    } catch (error) {
      console.error('❌ Error enviando estadísticas automáticas:', error);
    }
  }, milisegundosEsperaNoche);

  enviosAutomaticos.set(chatId, [timerDia, timerNoche]);
  console.log(`[INFO] Próximo envío día: ${proximoDia.toLocaleString()}`);
  console.log(`[INFO] Próximo envío noche: ${proximaNoche.toLocaleString()}`);
}

// ================= Manejo de Conexión y Reconexión =================
const MAX_RECONNECT_RETRIES = 5;
const RECONNECT_INTERVAL = 3000;
let reconnectAttempts = 0;
let shouldReconnect = true;

async function startBot() {
    if (reconnectAttempts > MAX_RECONNECT_RETRIES) {
        console.error('❌ Máximo número de intentos de reconexión alcanzado');
        process.exit(1);
    }

  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Bot Baileys', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
        console.log("🔄 Nuevo QR recibido.");
        // Aquí podrías implementar el guardado del QR o enviarlo a un endpoint
    }

    if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[INFO] Conexión cerrada. Estado: ${statusCode}`);
        console.log(`[INFO] Intentando reconexión: ${shouldReconnect}`);

        if (shouldReconnect) {
            reconnectAttempts++;
            console.log(`[INFO] Intento de reconexión ${reconnectAttempts} de ${MAX_RECONNECT_RETRIES}`);
            setTimeout(startBot, RECONNECT_INTERVAL);
        }
    } else if (connection === 'open') {
        console.log('[INFO] Bot conectado correctamente.');
        reconnectAttempts = 0;
    }
  });

  sock.ev.on('group-participants.update', async (event) => {
    if (event.action === 'add' && event.participants.includes(sock.user.id)) {
      console.log(`[INFO] Bot añadido al grupo ${event.id}`);
      await sock.sendMessage(event.id, { text: "¡Hola a todos! Estoy aquí para ayudar. Selecciona una opción:" });
      await enviarMenuComandos(sock, event.id);
      programarEnviosAutomaticos(sock, event.id);
    }
  });

  const CANAL_RESULTADOS = "0029VaovEo2KAwEtAc5CP12C@newsletter";

  sock.ev.on('messages.upsert', async (msg) => {
    const m = msg.messages[0];
    if (!m.message) return;

    const chatId = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();

    // Monitorear mensajes del canal de resultados
    if (chatId === CANAL_RESULTADOS) {
      console.log('[INFO] Mensaje recibido del canal de resultados');
      const resultados = extraerResultados(text);
      if (resultados.georgia || resultados.newyork || resultados.florida) {
        console.log('[INFO] Resultados detectados, enviando a grupos');
        await enviarResultadosAGrupos(sock, resultados);
      }
      return;
    }

    if (!text.startsWith('!')) return;

    if (!verificarFrecuenciaUsuario(sender)) {
      console.log(`[SPAM] Mensaje bloqueado por exceso de frecuencia de ${sender}`);
      return;
    }

    try {
      await limiter.schedule(async () => {
        checkSubscriptionAndProcess(sock, sender, m);
      });
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      await enviarMensajePrivado(sock, sender, '❌ Error al procesar tu solicitud.');
    }
  });

  sock.ev.on('ready', async () => {
    try {
      const chats = await sock.groupFetchAllParticipating();
      for (const [id, chat] of Object.entries(chats)) {
        programarEnviosAutomaticos(sock, id);
        console.log(`[INFO] Programación automática configurada para ${chat.subject}`);
      }
    } catch (error) {
      console.error('❌ Error configurando programaciones automáticas:', error);
    }
  });
}

async function iniciarBot() {
  await cargarCharadas();
  startBot();
}

iniciarBot();