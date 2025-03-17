const db = require('./database.js');
const axios = require('axios');
const cheerio = require('cheerio');

// Mapeo de loterías a sus URLs
const URLS = {
    florida: 'https://www.predictor.x10.mx/app/plantillafl.php',
    newyork: 'https://www.predictor.x10.mx/app/plantillany.php',
    georgia: 'https://www.predictor.x10.mx/app/plantillaga.php'
};

// Almacena cálculos por usuario y chat (clave compuesta: chat-usuario)
const memoriaCalculo = {}; 

// Verificar si el usuario es administrador (usado en otros comandos)
async function verificarAdmin(sock, chat, usuario) {
    try {
        const metadata = await sock.groupMetadata(chat);
        return metadata.participants.some(p => p.id === usuario && (p.admin === 'admin' || p.admin === 'superadmin'));
    } catch (err) {
        console.error('❌ Error obteniendo admins:', err);
        return false;
    }
}

// Abrir el grupo para todos los usuarios
async function abrirGrupo(sock, chat, usuario) {
    const esAdmin = await verificarAdmin(sock, chat, usuario);
    if (!esAdmin) return sock.sendMessage(chat, { text: '🚫 No tienes permisos para abrir el grupo.' });

    await sock.groupSettingUpdate(chat, 'not_announcement');
    return sock.sendMessage(chat, { text: '✅ El grupo ha sido abierto para todos.' });
}

// Cerrar el grupo para solo administradores
async function cerrarGrupo(sock, chat, usuario) {
    const esAdmin = await verificarAdmin(sock, chat, usuario);
    if (!esAdmin) return sock.sendMessage(chat, { text: '🚫 No tienes permisos para cerrar el grupo.' });

    await sock.groupSettingUpdate(chat, 'announcement');
    return sock.sendMessage(chat, { text: '🔒 El grupo ha sido cerrado.' });
}

 

async function obtenerTarjeta(sock, chat) {
    try {
        // Obtener los mensajes recientes del chat
        const mensajes = await sock.loadMessages(chat, 50); // Carga hasta 50 mensajes recientes
        const mensajeAnclado = mensajes.messages.find(msg => msg.messageStubType === 29); // 29 indica mensaje anclado

        if (mensajeAnclado) {
            const text = mensajeAnclado.message?.conversation ||
                         mensajeAnclado.message?.extendedTextMessage?.text ||
                         '🚫 No se pudo interpretar el mensaje anclado.';
            await sock.sendMessage(chat, { text });
        } else {
            await sock.sendMessage(chat, { text: '🚫 No hay mensajes anclados en este grupo.' });
        }
    } catch (err) {
        console.error('❌ Error obteniendo la tarjeta:', err);
        await sock.sendMessage(chat, { text: '❌ No se pudo obtener la tarjeta.' });
    }
}


// Función auxiliar para extraer datos de una pestaña (tab)
function extraerDatosPorTab($, tabSelector) {
    const datos = {
        centenas: [],
        decenas: [],
        terminales: [],
        parejas: [],
        resultadoReciente: ''
    };

    // Extraer y limpiar el contenido basado en <br> desde el contenedor .stat-item
    function extraerValores(selector) {
        const parentHtml = $(selector).parent().html() || '';
        const partes = parentHtml.split('</h4>');
        if (partes.length < 2) return [];
        const contenido = partes[1];
        return contenido
            .split(/<br\s*\/?>/)
            .map(item => cheerio.load(item).text().trim())
            .filter(texto => texto !== '');
    }

    datos.centenas = extraerValores(`${tabSelector} .stat-item h4:contains("CENTENAS")`);
    datos.decenas = extraerValores(`${tabSelector} .stat-item h4:contains("DECENAS")`);
    datos.terminales = extraerValores(`${tabSelector} .stat-item h4:contains("TERMINALES")`);
    datos.parejas = extraerValores(`${tabSelector} .stat-item h4:contains("Parejas")`);

    // Extraer el resultado reciente
    datos.resultadoReciente = $(tabSelector + ' h3:contains("Resultado reciente:")')
        .next()
        .text()
        .trim();

    return datos;
}

// Obtener estadísticas de la lotería solicitada
async function obtenerEstadisticas(loteria = 'florida') {
    try {
        const url = URLS[loteria];
        if (!url) {
            throw new Error(`Lotería '${loteria}' no soportada`);
        }
        const response = await axios.get(url);
        if (response.status !== 200) {
            throw new Error(`Código de respuesta: ${response.status}`);
        }
        const $ = cheerio.load(response.data);
        let estadisticas = {};

        // Para Georgia se esperan tres pestañas: día, tarde y noche
        if (loteria === 'georgia') {
            estadisticas = {
                dia: extraerDatosPorTab($, '#tab1'),
                tarde: extraerDatosPorTab($, '#tab2'),
                noche: extraerDatosPorTab($, '#tab3')
            };
        } else {
            // Florida y New York: día (#tab1) y noche (#tab2)
            estadisticas = {
                dia: extraerDatosPorTab($, '#tab1'),
                noche: extraerDatosPorTab($, '#tab2')
            };
        }
        return estadisticas;
    } catch (err) {
        console.error('❌ Error obteniendo estadísticas:', err);
        return { error: true, mensaje: 'No se pudieron obtener las estadísticas.' };
    }
}

// Obtener estadísticas por periodo (Día, Noche o Tarde para Georgia)
async function obtenerEstadisticasPorPeriodo(loteria, periodo) {
    try {
        const datos = await obtenerEstadisticas(loteria);
        let estadisticas;
        const periodoLC = periodo.toLowerCase();
        if (periodoLC === 'dia') {
            estadisticas = datos.dia;
        } else if (periodoLC === 'noche') {
            estadisticas = datos.noche;
        } else if (periodoLC === 'tarde' && loteria === 'georgia') {
            estadisticas = datos.tarde;
        }
        if (!estadisticas) {
            throw new Error('No se encontraron estadísticas para el periodo solicitado.');
        }
        return estadisticas;
    } catch (error) {
        console.error('❌ Error en obtenerEstadisticasPorPeriodo:', error);
        throw new Error('No se pudieron obtener las estadísticas.');
    }
}

// Función para formatear las estadísticas en un mensaje
function formatearEstadisticas(loteria, periodo, datos) {
    let lotteryName = '';
    if (loteria === 'florida') lotteryName = 'Florida';
    else if (loteria === 'newyork') lotteryName = 'New York';
    else if (loteria === 'georgia') lotteryName = 'Georgia';
    
    let mensaje = `*Estadísticas de Lotería ${lotteryName} (${periodo}):*\n\n`;
    mensaje += `*Centenas:*\n${datos.centenas.join('\n')}\n\n`;
    mensaje += `*Decenas:*\n${datos.decenas.join('\n')}\n\n`;
    mensaje += `*Terminales:*\n${datos.terminales.join('\n')}\n\n`;
    mensaje += `*Parejas:*\n${datos.parejas.join('\n')}\n\n`;
    mensaje += `*Resultado Reciente:*\n${datos.resultadoReciente}`;
    return mensaje;
}

// Validar si la expresión solo contiene números y operadores permitidos
function esOperacionValida(expresion) {
    const regex = /^[0-9+\-*/().\s%]*$/;
    return regex.test(expresion.trim());
}

// Evaluar expresiones matemáticas de forma segura
function evaluarExpresion(expresion) {
    expresion = expresion.replace(/%/g, '*0.01'); // Manejar porcentajes
    try {
        return Function('Math', `"use strict"; return (${expresion});`)(Math);
    } catch (error) {
        throw new Error('Expresión inválida');
    }
}

// Calcular operaciones y mantener la memoria por usuario y chat
// Este comando está disponible para cualquier usuario, sin requerir permisos de administrador.
async function calcular(sock, chat, usuario, expresion) {
    // Se utiliza una clave compuesta: chat-usuario
    const key = `${chat}-${usuario}`;

    if (!expresion || expresion.trim() === '') {
        return sock.sendMessage(chat, { text: '❌ Expresión no proporcionada. Ingresa una operación válida.' });
    }

    if (expresion.trim().toLowerCase() === 'reset') {
        delete memoriaCalculo[key];
        return sock.sendMessage(chat, { text: '🧮 Memoria de cálculo reiniciada.' });
    }

    if (!esOperacionValida(expresion)) {
        return sock.sendMessage(chat, { text: '❌ Expresión inválida. Usa solo números y operadores (+, -, *, /, %, ()).' });
    }

    try {
        let operacionCompleta = memoriaCalculo[key] !== undefined 
            ? `${memoriaCalculo[key]} ${expresion}` 
            : expresion;

        console.log('Evaluando operación:', operacionCompleta);
        
        const resultado = evaluarExpresion(operacionCompleta);

        if (isNaN(resultado) || !isFinite(resultado)) {
            throw new Error('Resultado no válido');
        }

        memoriaCalculo[key] = resultado; // Almacenar el resultado

        const resultadoFormateado = Number.isInteger(resultado) 
            ? resultado 
            : parseFloat(resultado.toFixed(4));

        return sock.sendMessage(chat, { 
            text: `🧮 Resultado: ${resultadoFormateado}\n🔹 Escribe otra operación para continuar o usa *!calc reset* para reiniciar.` 
        });
    } catch (err) {
        console.error('❌ Error en cálculo:', err);
        return sock.sendMessage(chat, { text: '❌ Error al calcular. Asegúrate de que la expresión sea válida.' });
    }
}

// Banear usuario del grupo
async function banearUsuario(sock, chat, usuario, mencionados) {
    const esAdmin = await verificarAdmin(sock, chat, usuario);
    if (!esAdmin) {
        return sock.sendMessage(chat, { text: '🚫 No tienes permisos para banear usuarios.' });
    }

    if (!mencionados || mencionados.length === 0) {
        return sock.sendMessage(chat, { text: '🔹 Debes mencionar al usuario que deseas banear.' });
    }

    try {
        const metadata = await sock.groupMetadata(chat);
        const admins = metadata.participants
            .filter(p => p.admin)
            .map(p => p.id);
        
        for (let user of mencionados) {
            if (user === usuario) {
                return sock.sendMessage(chat, { text: '❌ No puedes banearte a ti mismo.' });
            }
            
            if (admins.includes(user)) {
                return sock.sendMessage(chat, { text: '❌ No puedes banear a un administrador.' });
            }

            await sock.groupParticipantsUpdate(chat, [user], 'remove');
            await sock.sendMessage(chat, { 
                text: `🚨 Usuario @${user.split('@')[0]} eliminado.`, 
                mentions: [user] 
            });
        }
    } catch (err) {
        console.error('❌ Error al banear usuario:', err);
        return sock.sendMessage(chat, { text: '❌ No se pudo eliminar al usuario.' });
    }
}

// Establecer límites de jugadas en la base de datos
async function establecerLimites(sock, chat, usuario, limite) {
    const esAdmin = await verificarAdmin(sock, chat, usuario);
    if (!esAdmin) return sock.sendMessage(chat, { text: '🚫 No tienes permisos para establecer límites.' });

    const limiteNumero = parseInt(limite);
    if (isNaN(limiteNumero) || limiteNumero <= 0) {
        return sock.sendMessage(chat, { text: '❌ El límite debe ser un número positivo.' });
    }

    db.run(
        `INSERT INTO limites (grupo, limite) VALUES (?, ?) 
        ON CONFLICT(grupo) DO UPDATE SET limite = ?`,
        [chat, limiteNumero, limiteNumero],
        (err) => {
            if (err) {
                console.error('❌ Error al actualizar límite:', err);
                return sock.sendMessage(chat, { text: '❌ No se pudo actualizar el límite.' });
            }
            return sock.sendMessage(chat, { text: `✅ Límite de jugadas actualizado a ${limiteNumero}.` });
        }
    );
}

// Manejador de mensajes para procesar comandos
async function manejarMensaje(sock, chat, usuario, mensaje) {
    if (mensaje.startsWith('!calc')) {
        const expresion = mensaje.substring(5).trim();
        // El comando !calc se ejecuta para cualquier usuario, sin restricciones.
        return calcular(sock, chat, usuario, expresion);
    }
    
    if (mensaje === '!abrir') {
        return abrirGrupo(sock, chat, usuario);
    } else if (mensaje === '!cerrar') {
        return cerrarGrupo(sock, chat, usuario);
    } else if (mensaje === '!tarjeta') {
        return obtenerTarjeta(sock, chat);
    } else if (mensaje.startsWith('!estadisticas')) {
        // Se espera un código para identificar la lotería y el periodo
        // Ejemplos: FLD, FLN, NYD, NYN, GAD, GAT, GAN
        const parts = mensaje.split(' ');
        if (parts.length < 2) {
            return sock.sendMessage(chat, { 
                text: 'Por favor especifica el código. Ejemplos: FLD, FLN, NYD, NYN, GAD, GAT, GAN.' 
            });
        }
        const code = parts[1].toUpperCase();
        const periodMapping = {
            'FLD': { lottery: 'florida', period: 'dia' },
            'FLN': { lottery: 'florida', period: 'noche' },
            'NYD': { lottery: 'newyork', period: 'dia' },
            'NYN': { lottery: 'newyork', period: 'noche' },
            'GAD': { lottery: 'georgia', period: 'dia' },
            'GAT': { lottery: 'georgia', period: 'tarde' },
            'GAN': { lottery: 'georgia', period: 'noche' }
        };
        if (!periodMapping[code]) {
            return sock.sendMessage(chat, { 
                text: 'Código inválido. Usa alguno de los siguientes: FLD, FLN, NYD, NYN, GAD, GAT, GAN.' 
            });
        }
        const { lottery, period } = periodMapping[code];
        try {
            const datos = await obtenerEstadisticasPorPeriodo(lottery, period);
            // Se formatea el periodo con la primera letra mayúscula
            const mensajeEstadisticas = formatearEstadisticas(lottery, period.charAt(0).toUpperCase() + period.slice(1), datos);
            return sock.sendMessage(chat, { text: mensajeEstadisticas });
        } catch (err) {
            return sock.sendMessage(chat, { text: '❌ Error al obtener las estadísticas.' });
        }
    } else if (mensaje.startsWith('!limite ')) {
        const limite = mensaje.substring(8).trim();
        return establecerLimites(sock, chat, usuario, limite);
    }
    
    return null; // Si no es un comando conocido, no hacemos nada
}

module.exports = {
    abrirGrupo,
    cerrarGrupo,
    obtenerTarjeta,
    obtenerEstadisticas,
    obtenerEstadisticasPorPeriodo,
    calcular,
    banearUsuario,
    establecerLimites,
    manejarMensaje,
    formatearEstadisticas
};
