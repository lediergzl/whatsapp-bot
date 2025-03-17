const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('./logger');

// Mapeo de loterías a sus respectivas URLs
const URLS = {
  florida: 'https://www.predictor.x10.mx/app/plantillafl.php',
  newyork: 'https://www.predictor.x10.mx/app/plantillany.php',
  georgia: 'https://www.predictor.x10.mx/app/plantillaga.php'
};

// Función auxiliar para extraer datos de una pestaña (tab)
function extraerDatosPorTab($, tabSelector) {
  const datos = {
    centenas: [],
    decenas: [],
    terminales: [],
    parejas: [],
    resultadoReciente: ''
  };

  // Extrae y limpia el contenido basado en <br> desde el contenedor .stat-item
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

  // Extrae el resultado reciente
  datos.resultadoReciente = $(tabSelector + ' h3:contains("Resultado reciente:")')
    .next()
    .text()
    .trim();

  return datos;
}

// Función principal para obtener las estadísticas según la lotería
async function obtenerEstadisticas(loteria = 'florida', horario = null) {
  const horarioConsulta = horario || obtenerHorarioActual();
  logger.info(`Iniciando la obtención de estadísticas para ${loteria.toUpperCase()} a las: ${horarioConsulta}`);

  const url = URLS[loteria];
  if (!url) {
    throw new Error(`Lotería '${loteria}' no soportada`);
  }

  try {
    const response = await axios.get(url);
    if (response.status !== 200) {
      throw new Error(`Error al obtener las estadísticas. Código de respuesta: ${response.status}`);
    }

    const $ = cheerio.load(response.data);
    let estadisticas = {};

    // Para georgia se esperan tres pestañas: dia (#tab1), tarde (#tab2) y noche (#tab3)
    if (loteria === 'georgia') {
      estadisticas = {
        dia: extraerDatosPorTab($, '#tab1'),
        tarde: extraerDatosPorTab($, '#tab2'),
        noche: extraerDatosPorTab($, '#tab3')
      };
    } else {
      // Florida y New York cuentan con dos pestañas: dia (#tab1) y noche (#tab2)
      estadisticas = {
        dia: extraerDatosPorTab($, '#tab1'),
        noche: extraerDatosPorTab($, '#tab2')
      };
    }

    logger.info(`Estadísticas obtenidas correctamente para ${loteria.toUpperCase()} a las: ${horarioConsulta}`);
    return estadisticas;

  } catch (error) {
    logger.error(`Error al obtener las estadísticas: ${error.message}`);
    return {
      error: true,
      mensaje: `No se pudieron obtener las estadísticas para ${loteria.toUpperCase()}. Error: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Función para obtener el horario actual en formato adecuado
function obtenerHorarioActual() {
  const fecha = new Date();
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos} ${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
}

// Función para obtener estadísticas con reintentos automáticos
async function obtenerEstadisticasConReintentos(loteria = 'florida', intentos = 3, delay = 3000) {
  let intentosRestantes = intentos;
  let estadisticas;

  while (intentosRestantes > 0) {
    estadisticas = await obtenerEstadisticas(loteria);

    if (!estadisticas.error) {
      break; // Si se obtienen los datos correctamente, se sale del ciclo
    }

    console.log(`Reintentando para ${loteria.toUpperCase()}... Intento ${intentos - intentosRestantes + 1}/${intentos}`);
    intentosRestantes--;

    if (intentosRestantes > 0) {
      console.log(`Esperando ${delay / 1000} segundos antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return estadisticas;
}

// Función que genera el mensaje formateado de las estadísticas para el bot
async function generarMensajeEstadisticas(loteria = 'florida') {
  const estadisticas = await obtenerEstadisticasConReintentos(loteria);
  if (estadisticas.error) {
    throw new Error(estadisticas.mensaje);
  }
  
  let mensaje = `*Estadísticas de Lotería ${loteria.toUpperCase()}:*\n\n`;

  // Para georgia se manejan tres horarios
  if (loteria === 'georgia') {
    mensaje += '*Día:*\n';
    mensaje += '*Centenas:*\n' + estadisticas.dia.centenas.join('\n') + '\n';
    mensaje += '*Decenas:*\n' + estadisticas.dia.decenas.join('\n') + '\n';
    mensaje += '*Terminales:*\n' + estadisticas.dia.terminales.join('\n') + '\n';
    mensaje += '*Parejas:*\n' + estadisticas.dia.parejas.join('\n') + '\n';
    mensaje += '*Resultado Reciente:*\n' + estadisticas.dia.resultadoReciente + '\n\n';

    mensaje += '*Tarde:*\n';
    mensaje += '*Centenas:*\n' + estadisticas.tarde.centenas.join('\n') + '\n';
    mensaje += '*Decenas:*\n' + estadisticas.tarde.decenas.join('\n') + '\n';
    mensaje += '*Terminales:*\n' + estadisticas.tarde.terminales.join('\n') + '\n';
    mensaje += '*Parejas:*\n' + estadisticas.tarde.parejas.join('\n') + '\n';
    mensaje += '*Resultado Reciente:*\n' + estadisticas.tarde.resultadoReciente + '\n\n';

    mensaje += '*Noche:*\n';
    mensaje += '*Centenas:*\n' + estadisticas.noche.centenas.join('\n') + '\n';
    mensaje += '*Decenas:*\n' + estadisticas.noche.decenas.join('\n') + '\n';
    mensaje += '*Terminales:*\n' + estadisticas.noche.terminales.join('\n') + '\n';
    mensaje += '*Parejas:*\n' + estadisticas.noche.parejas.join('\n') + '\n';
    mensaje += '*Resultado Reciente:*\n' + estadisticas.noche.resultadoReciente;
  } else {
    // Para Florida y New York (dos pestañas: día y noche)
    mensaje += '*Día:*\n';
    mensaje += '*Centenas:*\n' + estadisticas.dia.centenas.join('\n') + '\n';
    mensaje += '*Decenas:*\n' + estadisticas.dia.decenas.join('\n') + '\n';
    mensaje += '*Terminales:*\n' + estadisticas.dia.terminales.join('\n') + '\n';
    mensaje += '*Parejas:*\n' + estadisticas.dia.parejas.join('\n') + '\n';
    mensaje += '*Resultado Reciente:*\n' + estadisticas.dia.resultadoReciente + '\n\n';
    
    mensaje += '*Noche:*\n';
    mensaje += '*Centenas:*\n' + estadisticas.noche.centenas.join('\n') + '\n';
    mensaje += '*Decenas:*\n' + estadisticas.noche.decenas.join('\n') + '\n';
    mensaje += '*Terminales:*\n' + estadisticas.noche.terminales.join('\n') + '\n';
    mensaje += '*Parejas:*\n' + estadisticas.noche.parejas.join('\n') + '\n';
    mensaje += '*Resultado Reciente:*\n' + estadisticas.noche.resultadoReciente;
  }
  
  return mensaje;
}

module.exports = {
  generarMensajeEstadisticas,
  obtenerEstadisticas // Exportada por si se requiere usarla directamente
};
