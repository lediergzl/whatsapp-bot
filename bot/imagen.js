const puppeteer = require('puppeteer');
const fs = require('fs');

// Opciones válidas y mapeo de comandos
const opciones = {
  "FLD": { estado: "florida", tipo: "dia" },
  "FLN": { estado: "florida", tipo: "noche" },
  "GAD": { estado: "georgia", tipo: "dia" },
  "GAT": { estado: "georgia", tipo: "tarde" },
  "GAN": { estado: "georgia", tipo: "noche" },
  "NYD": { estado: "newyork", tipo: "dia" },  // Asegúrate que esto esté correcto
  "NYN": { estado: "newyork", tipo: "noche" }, // Asegúrate que esto esté correcto
};

// Ruta del archivo de marcador
const marcadorPath = './marcador.txt';

// Función para verificar si la tabla ya fue descargada hoy
const tablaDescargadaHoy = (estado, tipoSorteo) => {
  if (fs.existsSync(marcadorPath)) {
    const marcador = fs.readFileSync(marcadorPath, 'utf-8');
    const [fecha, tabla, tipo] = marcador.split('|');

    const fechaHoy = new Date().toISOString().split('T')[0];
    if (fecha === fechaHoy && tabla === estado && tipo === tipoSorteo) {
      console.log(`✅ La tabla '${estado}' para el sorteo '${tipoSorteo}' ya fue descargada hoy. Usando el archivo existente.`);
      return true;
    }
  }
  return false;
};

// Función para descargar la tabla
const descargarTabla = async (estado, tipoSorteo) => {
  const fileName = `tabla_${estado}_${tipoSorteo}.png`;

  // Verificar si la tabla ya fue descargada hoy
  if (tablaDescargadaHoy(estado, tipoSorteo)) {
    return fs.readFileSync(fileName); // Retornar el buffer de la imagen si ya se descargó
  }

  const url = "https://www.predictor.x10.mx/app/tablas.php";
  let browser; // Declarar la variable aquí

  try {
    console.log(`🔄 Abriendo la página y seleccionando '${estado}' y el sorteo '${tipoSorteo}'...`);

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#tabla-select');

    // Transformar el valor de 'estado' si es "newyork"
    const estadoSelect = (estado === "newyork") ? "ny" : estado;
    await page.select('#tabla-select', estadoSelect);

    // Disparar evento de cambio manualmente
    await page.evaluate(() => {
      const select = document.querySelector('#tabla-select');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Esperar 5 segundos para que se actualice la tabla
    await new Promise(resolve => setTimeout(resolve, 5000));

    await page.waitForSelector('#capture-area', { timeout: 5000 });

    const element = await page.$('#capture-area');

    if (element) {
      await element.screenshot({ path: fileName });
      console.log(`✅ Imagen guardada correctamente como '${fileName}'`);

      const fechaHoy = new Date().toISOString().split('T')[0];
      fs.writeFileSync(marcadorPath, `${fechaHoy}|${estado}|${tipoSorteo}`, 'utf-8');
      return fs.readFileSync(fileName); // Retornar el buffer de la imagen
    } else {
      console.log("❌ No se encontró la tabla en la página.");
      throw new Error("Tabla no encontrada");
    }

  } catch (error) {
    console.error("❌ Error al capturar la imagen:", error.message);
    throw error; // Propagar el error para manejarlo en el bot
  } finally {
    if (browser) {
      await browser.close(); // Asegurarse de cerrar el navegador si fue creado
    }
  }
};

// Función principal para manejar el comando de estadísticas
const manejarComandoEstadisticas = async (comando) => {
  const codigo = comando.toUpperCase();

  if (opciones[codigo]) {
    const { estado, tipo } = opciones[codigo];
    return await descargarTabla(estado, tipo); // Retornar el buffer de la imagen
  } else {
    console.log("❌ Código de estadística no válido.");
    throw new Error("Código de estadística no válido");
  }
};

// Exportar las funciones
module.exports = { manejarComandoEstadisticas, descargarTabla, opciones };
