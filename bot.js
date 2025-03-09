const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const moment = require('moment');
const cron = require('node-cron');
let saveQR;

// Intentar importar la función saveQR desde index.js
try {
    const index = require('./index.js');
    saveQR = index.saveQR;
} catch (error) {
    console.log('No se pudo importar saveQR desde index.js');
    saveQR = () => {}; // Función vacía como fallback
}

// Configurar el cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth/'
    }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-accelerated-2d-canvas'
        ],
        headless: true,
        timeout: 60000
    },
    restartOnAuthFail: true,
    puppeteerOptions: {
        ignoreHTTPSErrors: true
    }
});

// Manejo de desconexiones
client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    // Reintentar conexión después de un tiempo
    setTimeout(() => {
        console.log('Intentando reconectar...');
        client.initialize();
    }, 10000);
});

// Evento cuando se genera el código QR
client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('QR Code generado. Por favor escanee con WhatsApp.');
    saveQR(qr); // Llamar a la función para guardar el QR
});

// Evento cuando el cliente está listo
client.on('ready', () => {
    console.log('Cliente WhatsApp está listo!');
    iniciarTareasProgramadas();
});

// Manejar mensajes entrantes
client.on('message', async msg => {
    try {
        if (!msg || !msg.body) return;
        
        const command = msg.body.toLowerCase();

        // Comandos para administradores
        if (await isAdmin(msg)) {
            switch(command) {
                case '!cerrar':
                    await cerrarGrupo(msg);
                    break;
                case '!abrir':
                    await abrirGrupo(msg);
                    break;
                case '!tarjeta':
                    await enviarTarjeta(msg);
                    break;
            }
        }
    } catch (error) {
        console.error('Error al procesar mensaje:', error);
    }
});

// Funciones de administración de grupos
async function isAdmin(msg) {
    if (msg.fromMe) return true;

    if (msg.chat && msg.chat.isGroup) {
        const chat = await msg.getChat();
        const participant = chat.participants.find(p => p.id._serialized === msg.author);
        return participant?.isAdmin;
    }
    return false;
}

async function cerrarGrupo(msg) {
    if (!msg.chat || !msg.chat.isGroup) return;

    try {
        const chat = await msg.getChat();
        await chat.setSettings({
            'restrict': 'true'
        });
        msg.reply('Grupo cerrado exitosamente.');
    } catch (error) {
        console.error('Error al cerrar grupo:', error);
        msg.reply('Error al cerrar el grupo.');
    }
}

async function abrirGrupo(msg) {
    if (!msg.chat || !msg.chat.isGroup) return;

    try {
        const chat = await msg.getChat();
        await chat.setSettings({
            'restrict': 'false'
        });
        msg.reply('Grupo abierto exitosamente.');
    } catch (error) {
        console.error('Error al abrir grupo:', error);
        msg.reply('Error al abrir el grupo.');
    }
}

async function enviarTarjeta(msg) {
    try {
        // Aquí deberías tener la URL o el path de la tarjeta anclada
        const tarjeta = MessageMedia.fromFilePath('./assets/tarjeta.jpg');
        await msg.reply(tarjeta);
    } catch (error) {
        console.error('Error al enviar tarjeta:', error);
        msg.reply('Error al enviar la tarjeta.');
    }
}

// Función para publicar resultados de loterías
async function publicarResultados(grupos) {
    try {
        // Aquí deberías obtener los resultados de tu API o base de datos
        const resultados = await obtenerResultados();

        for (const grupo of grupos) {
            const chat = await client.getChatById(grupo);
            await chat.sendMessage(`🎲 Resultados de Lotería\n${resultados}`);
        }
    } catch (error) {
        console.error('Error al publicar resultados:', error);
    }
}

// Configurar tareas programadas
function iniciarTareasProgramadas() {
    // Ejemplo: Publicar resultados a las 12:00 PM
    cron.schedule('0 12 * * *', () => {
        const gruposAutorizados = ['GRUPO1-ID', 'GRUPO2-ID']; // Reemplazar con IDs reales
        publicarResultados(gruposAutorizados);
    });
}

// Función placeholder para obtener resultados
async function obtenerResultados() {
    // Implementar lógica para obtener resultados
    return "Resultados del día...";
}

// Iniciar el cliente
client.initialize();
