
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Nombre de archivo basado en la fecha actual
const getLogFileName = () => {
    return path.join(logsDir, `bot_${moment().format('YYYY-MM-DD')}.log`);
};

// Función para escribir logs
const writeLog = (level, message, details = null) => {
    try {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        // Agregar detalles si existen
        if (details) {
            if (typeof details === 'object') {
                logMessage += `\nDETAILS: ${JSON.stringify(details)}`;
            } else {
                logMessage += `\nDETAILS: ${details}`;
            }
        }
        
        // Agregar salto de línea
        logMessage += '\n';
        
        // Escribir en el archivo
        fs.appendFileSync(getLogFileName(), logMessage);
        
        // También mostrar en consola
        console.log(logMessage);
    } catch (error) {
        console.error('Error escribiendo log:', error);
    }
};

// Métodos de log por nivel
const logger = {
    info: (message, details = null) => writeLog('info', message, details),
    warn: (message, details = null) => writeLog('warn', message, details),
    error: (message, details = null) => writeLog('error', message, details),
    debug: (message, details = null) => writeLog('debug', message, details),
    command: (message, details = null) => writeLog('command', message, details),
    
    // Log específico para comandos recibidos
    commandReceived: (command, user, chat) => {
        const message = `Comando recibido: ${command}`;
        const details = {
            user: user || 'Desconocido',
            chat: chat || 'Desconocido',
            timestamp: Date.now()
        };
        writeLog('command', message, details);
    },
    
    // Log para acciones realizadas
    actionPerformed: (action, result, details = null) => {
        const message = `Acción realizada: ${action} - Resultado: ${result}`;
        writeLog('action', message, details);
    }
};

module.exports = logger;
