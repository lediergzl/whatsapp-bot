
const { delay } = require('@whiskeysockets/baileys');
const db = require('./database.js');

function extraerResultados(mensaje) {
  const resultados = {
    georgia: null,
    newyork: null,
    florida: null
  };

  // Expresiones regulares para cada lotería
  const regexGeorgia = /🍑Lotería de Georgia🍑[\s\S]*?⏰(\d+:\d+ [ap]m)⏰[\s\S]*?📅(\d{2}\/\d{2}\/\d{2})📅[\s\S]*?Cash 3 ⚡️(\d{3})[\s\S]*?Cash 4 ⚡️(\d{4})/;
  const regexNewYork = /🗽Lotería de New York🗽[\s\S]*?⏰(\d+:\d+ [ap]m)⏰[\s\S]*?📅(\d{2}\/\d{2}\/\d{2})📅[\s\S]*?Numbers⚡️(\d{3})[\s\S]*?Win 4️⃣\s*⚡️(\d{4})/;
  const regexFlorida = /🦩Lotería de Florida🦩[\s\S]*?⏰(\d+:\d+ [ap]m)⏰[\s\S]*?📅(\d{2}\/\d{2}\/\d{2})📅[\s\S]*?Pick 3 ⚡️(\d{3})[\s\S]*?Pick 4 ⚡️(\d{4})/;

  // Extraer resultados
  const matchGeorgia = mensaje.match(regexGeorgia);
  const matchNewYork = mensaje.match(regexNewYork);
  const matchFlorida = mensaje.match(regexFlorida);

  if (matchGeorgia) {
    resultados.georgia = {
      hora: matchGeorgia[1],
      fecha: matchGeorgia[2],
      cash3: matchGeorgia[3],
      cash4: matchGeorgia[4]
    };
  }

  if (matchNewYork) {
    resultados.newyork = {
      hora: matchNewYork[1],
      fecha: matchNewYork[2],
      numbers: matchNewYork[3],
      win4: matchNewYork[4]
    };
  }

  if (matchFlorida) {
    resultados.florida = {
      hora: matchFlorida[1],
      fecha: matchFlorida[2],
      pick3: matchFlorida[3],
      pick4: matchFlorida[4]
    };
  }

  return resultados;
}

async function obtenerGruposSuscritos() {
  return new Promise((resolve, reject) => {
    db.all("SELECT group_id FROM groups WHERE active = 1", [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(row => row.group_id));
    });
  });
}

async function enviarResultadosAGrupos(sock, resultados) {
  try {
    const grupos = await obtenerGruposSuscritos();
    
    for (const grupo of grupos) {
      // Crear mensaje para cada lotería
      if (resultados.georgia) {
        const mensajeGeorgia = `🎰 *RESULTADOS GEORGIA ${resultados.georgia.hora}*\n` +
                              `📅 Fecha: ${resultados.georgia.fecha}\n` +
                              `🎲 Cash 3: ${resultados.georgia.cash3}\n` +
                              `🎲 Cash 4: ${resultados.georgia.cash4}`;
        
        await sock.sendMessage(grupo, { text: mensajeGeorgia });
        await delay(2000 + Math.random() * 3000); // Retardo aleatorio entre 2-5 segundos
      }

      if (resultados.newyork) {
        const mensajeNY = `🗽 *RESULTADOS NEW YORK ${resultados.newyork.hora}*\n` +
                         `📅 Fecha: ${resultados.newyork.fecha}\n` +
                         `🎲 Numbers: ${resultados.newyork.numbers}\n` +
                         `🎲 Win 4: ${resultados.newyork.win4}`;
        
        await sock.sendMessage(grupo, { text: mensajeNY });
        await delay(2000 + Math.random() * 3000);
      }

      if (resultados.florida) {
        const mensajeFL = `🌴 *RESULTADOS FLORIDA ${resultados.florida.hora}*\n` +
                         `📅 Fecha: ${resultados.florida.fecha}\n` +
                         `🎲 Pick 3: ${resultados.florida.pick3}\n` +
                         `🎲 Pick 4: ${resultados.florida.pick4}`;
        
        await sock.sendMessage(grupo, { text: mensajeFL });
        await delay(2000 + Math.random() * 3000);
      }
    }
  } catch (error) {
    console.error('Error enviando resultados a grupos:', error);
  }
}

module.exports = {
  extraerResultados,
  enviarResultadosAGrupos
};
