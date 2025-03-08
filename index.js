const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const cron = require('node-cron');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Evento cuando se genera el código QR
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code generado. Escanéalo con WhatsApp.');
});

// Evento cuando el cliente está listo
client.on('ready', async () => {
    console.log('✅ Bot de WhatsApp está listo.');
    iniciarTareasProgramadas();
});

// Manejar mensajes entrantes
client.on('message', async msg => {
    const command = msg.body.toLowerCase();

    if (await isAdmin(msg)) {
        switch (command) {
            case '!cerrar':
                await cerrarGrupo(msg);
                break;
            case '!abrir':
                await abrirGrupo(msg);
                break;
            case '!tarjeta':
                await enviarTarjeta(msg);
                break;
            case '!resultados':
                await publicarResultados([msg.from]);
                break;
        }
    }
});

// Verificar si el usuario es administrador del grupo
async function isAdmin(msg) {
    if (msg.fromMe) return true;
    
    if (msg.chat.isGroup) {
        const chat = await msg.getChat();
        const participant = chat.participants.find(p => p.id._serialized === msg.author);
        return participant?.isAdmin;
    }
    return false;
}

// Cerrar el grupo
async function cerrarGrupo(msg) {
    if (!msg.chat.isGroup) return;
    try {
        const chat = await msg.getChat();
        await chat.setMessagesAdminsOnly(true);
        msg.reply('🔒 El grupo ha sido cerrado.');
    } catch (error) {
        console.error('Error al cerrar grupo:', error);
        msg.reply('❌ Error al cerrar el grupo.');
    }
}

// Abrir el grupo
async function abrirGrupo(msg) {
    if (!msg.chat.isGroup) return;
    try {
        const chat = await msg.getChat();
        await chat.setMessagesAdminsOnly(false);
        msg.reply('🔓 El grupo ha sido abierto.');
    } catch (error) {
        console.error('Error al abrir grupo:', error);
        msg.reply('❌ Error al abrir el grupo.');
    }
}

// Enviar la tarjeta anclada en el chat
async function enviarTarjeta(msg) {
    try {
        const chat = await msg.getChat();
        const pinnedMessages = await chat.fetchMessages({ limit: 10 });

        const pinned = pinnedMessages.find(m => m.isPinned);
        if (pinned) {
            await msg.reply(`📌 Tarjeta anclada:\n\n${pinned.body}`);
        } else {
            msg.reply('❌ No hay mensajes anclados en este chat.');
        }
    } catch (error) {
        console.error('Error al obtener la tarjeta:', error);
        msg.reply('❌ Error al obtener la tarjeta.');
    }
}

// Obtener los resultados de la lotería
async function obtenerResultados() {
    try {
        const urls = [
            'https://www.predictor.x10.mx/app/plantillany.php',
            'https://www.predictor.x10.mx/app/plantillaga.php',
            'https://www.predictor.x10.mx/app/plantillafl.php'
        ];

        let resultados = '🎲 *Resultados de Lotería*\n';
        for (const url of urls) {
            const { data } = await axios.get(url);
            resultados += `📌 ${data}\n\n`;
        }
        return resultados;
    } catch (error) {
        console.error('Error al obtener resultados:', error);
        return '❌ No se pudieron obtener los resultados.';
    }
}

// Publicar resultados en los grupos
async function publicarResultados(grupos) {
    try {
        const resultados = await obtenerResultados();
        for (const grupo of grupos) {
            const chat = await client.getChatById(grupo);
            await chat.sendMessage(resultados);
        }
    } catch (error) {
        console.error('Error al publicar resultados:', error);
    }
}

// Configurar tareas programadas
function iniciarTareasProgramadas() {
    cron.schedule('0 12 * * *', () => {
        const gruposAutorizados = ['GRUPO1-ID', 'GRUPO2-ID']; // Reemplazar con IDs reales
        publicarResultados(gruposAutorizados);
    });
}

// Iniciar el cliente
client.initialize();
