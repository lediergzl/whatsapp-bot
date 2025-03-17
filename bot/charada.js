const fs = require('fs');
const path = require('path');

const filePath = './Charada.txt'; // Cambia esto a la ruta de tu archivo
let charadas = [];

// Cargar charadas desde el archivo
function cargarCharadas() {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return reject('❌ Error leyendo el archivo: ' + err);
            }
            const lines = data.split('\n');
            charadas = lines.map(line => {
                const [numero, ...palabras] = line.split(': ');
                return {
                    numero: numero.trim(),
                    palabras: palabras.join(': ').split(', ').map(word => word.trim())
                };
            });
            resolve();
        });
    });
}

// Buscar charada por número o por nombre
function buscarCharada(query) {
    const numero = parseInt(query, 10);
    if (!isNaN(numero)) {
        // Buscar por número
        const charada = charadas[numero - 1]; // Ajuste por índice
        return charada 
            ? `Charada ${numero}: ${charada.palabras.join(', ')}`
            : '❌ Charada no encontrada.';
    } else {
        // Convertir la consulta a minúsculas y separar en términos
        const queryLower = query.toLowerCase().trim();
        const terms = queryLower.split(/\s+/);
        // Filtrar charadas que contengan TODOS los términos (sin importar el orden)
        const resultados = charadas.filter(charada => {
            const charadaText = charada.palabras.join(' ').toLowerCase();
            return terms.every(term => charadaText.includes(term));
        });
        return resultados.length > 0
            ? resultados.map(charada => `Charada ${charada.numero}: ${charada.palabras.join(', ')}`).join('\n')
            : '❌ No se encontraron charadas con ese nombre.';
    }
}

// Manejador del comando !charada
async function manejarComandoCharada(sock, chat, mensaje) {
    const parts = mensaje.split(' ');
    if (parts[0] !== '!charada' || parts.length < 2) {
        return sock.sendMessage(chat, { text: 'Por favor usa el comando correctamente: !charada <número o nombre>' });
    }

    const query = parts.slice(1).join(' '); // Obtener el resto del mensaje
    const respuesta = buscarCharada(query);
    return sock.sendMessage(chat, { text: respuesta });
}

// Función principal para iniciar el bot
async function iniciarBot(sock) {
    await cargarCharadas(); // Cargar charadas al inicio
    // Aquí agregas el resto de la lógica del bot
}

// Exportar el manejador de comandos
module.exports = {
    manejarComandoCharada,
    iniciarBot
};
