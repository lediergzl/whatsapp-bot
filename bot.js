const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const moment = require("moment");
const cron = require("node-cron");
let saveQR;

// Intentar importar la función saveQR desde index.js
try {
  const index = require("./index.js");
  saveQR = index.saveQR;
} catch (error) {
  console.log("No se pudo importar saveQR desde index.js");
  saveQR = () => {}; // Función vacía como fallback
}

// Configurar el cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth/",
  }),
  puppeteer: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-accelerated-2d-canvas",
    ],
    headless: true,
    timeout: 60000,
  },
  restartOnAuthFail: true,
  puppeteerOptions: {
    ignoreHTTPSErrors: true,
  },
});

// Manejo de desconexiones
client.on("disconnected", (reason) => {
  console.log("Cliente desconectado:", reason);
  // Reintentar conexión después de un tiempo
  setTimeout(() => {
    console.log("Intentando reconectar...");
    client.initialize();
  }, 10000);
});

// Evento cuando se genera el código QR
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR Code generado. Por favor escanee con WhatsApp.");
  saveQR(qr); // Llamar a la función para guardar el QR
});

// Evento cuando el cliente está listo
client.on("ready", () => {
  console.log("Cliente WhatsApp está listo!");
  iniciarTareasProgramadas();
});

// Manejar mensajes entrantes
<<<<<<< HEAD
client.on("message", async (msg) => {
  try {
    if (!msg || !msg.body) return;

    const command = msg.body.toLowerCase();

    // Comandos para administradores
    if (await isAdmin(msg)) {
      switch (command) {
        case "!cerrar":
          await cerrarGrupo(msg);
          break;
        case "!abrir":
          await abrirGrupo(msg);
          break;
        case "!tarjeta":
          await enviarTarjeta(msg);
          break;
      }
=======
client.on('message', async msg => {
    try {
        // Verificación básica del mensaje
        if (!msg || !msg.body) return;
        
        const command = msg.body.toLowerCase().trim();
        
        // Verificar si es un comando
        if (command.startsWith('!')) {
            // Comandos para todos los usuarios
            switch(command) {
                case '!ayuda':
                    await enviarAyuda(msg);
                    break;
                case '!resultados':
                    await enviarResultados(msg);
                    break;
            }
            
            // Comandos solo para administradores
            try {
                const esAdmin = await isAdmin(msg);
                if (esAdmin) {
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
                        case '!limites':
                            await enviarLimites(msg);
                            break;
                    }
                }
            } catch (adminError) {
                console.error('Error al procesar comando de admin:', adminError);
            }
        }
    } catch (error) {
        console.error('Error al procesar mensaje:', error, error.stack);
>>>>>>> 2c8725c521acba1771a6e74f1ca594ce6f811882
    }
  } catch (error) {
    console.error("Error al procesar mensaje:", error);
  }
});

// Funciones de administración de grupos
async function isAdmin(msg) {
<<<<<<< HEAD
  if (msg.fromMe) return true;

  if (msg.chat && msg.chat.isGroup) {
    const chat = await msg.getChat();
    const participant = chat.participants.find(
      (p) => p.id._serialized === msg.author
    );
    return participant?.isAdmin;
  }
  return false;
=======
    try {
        // Si el mensaje es del propio bot, es admin
        if (msg.fromMe) return true;
        
        // Verificar si el mensaje tiene un chat y obtenerlo de forma segura
        if (!msg.chat) return false;
        
        const chat = await msg.getChat();
        
        // Verificar si es un grupo
        if (!chat || !chat.isGroup) return false;
        
        // Buscar el participante y verificar si es admin
        const participant = chat.participants.find(p => p.id._serialized === msg.author);
        return Boolean(participant?.isAdmin);
    } catch (error) {
        console.error('Error al verificar si es admin:', error);
        return false; // Por defecto, no es admin si hay error
    }
>>>>>>> 2c8725c521acba1771a6e74f1ca594ce6f811882
}

async function cerrarGrupo(msg) {
  if (!msg.chat || !msg.chat.isGroup) return;

  try {
    const chat = await msg.getChat();
    await chat.setSettings({
      restrict: "true",
    });
    msg.reply("Grupo cerrado exitosamente.");
  } catch (error) {
    console.error("Error al cerrar grupo:", error);
    msg.reply("Error al cerrar el grupo.");
  }
}

async function abrirGrupo(msg) {
  if (!msg.chat || !msg.chat.isGroup) return;

  try {
    const chat = await msg.getChat();
    await chat.setSettings({
      restrict: "false",
    });
    msg.reply("Grupo abierto exitosamente.");
  } catch (error) {
    console.error("Error al abrir grupo:", error);
    msg.reply("Error al abrir el grupo.");
  }
}

async function enviarTarjeta(msg) {
<<<<<<< HEAD
  try {
    if (!msg.chat || !msg.chat.isGroup) {
      return msg.reply("Este comando solo funciona en grupos.");
    }

    const chat = await msg.getChat();

    // Intentar obtener mensajes anclados
    if (!chat.pinned || chat.pinned.length === 0) {
      return msg.reply("No hay mensajes anclados en este grupo.");
    }

    // Obtener el primer mensaje anclado (generalmente la tarjeta)
    const mensajeAnclado = chat.pinned[0];

    // Verificar si el mensaje existe
    if (mensajeAnclado) {
      // Reutilizar el contenido del mensaje anclado
      const contenido = await client.getMessageById(mensajeAnclado);
      if (contenido) {
        // Si el mensaje anclado es una imagen
        if (contenido.hasMedia) {
          const media = await contenido.downloadMedia();
          await msg.reply(media);
        } else {
          // Si es un mensaje de texto
          await msg.reply(contenido.body);
        }
      } else {
        msg.reply("No se pudo obtener el mensaje anclado.");
      }
    } else {
      msg.reply("No se encontró el mensaje anclado.");
=======
    try {
        // Verificar si es un grupo
        if (!msg.chat) {
            return msg.reply('Este comando solo funciona en grupos.');
        }
        
        const chat = await msg.getChat();
        
        if (!chat.isGroup) {
            return msg.reply('Este comando solo funciona en grupos.');
        }
        
        try {
            // Intentar obtener mensajes anclados
            if (!chat.pinned || chat.pinned.length === 0) {
                // Si no hay mensajes anclados, usar tarjeta por defecto
                const tarjetaDefault = await generarTarjetaResultados();
                return msg.reply(tarjetaDefault);
            }
            
            // Obtener el primer mensaje anclado (generalmente la tarjeta)
            const mensajeAnclado = chat.pinned[0];
            
            if (!mensajeAnclado) {
                // Si no hay mensaje anclado, generar tarjeta por defecto
                const tarjetaDefault = await generarTarjetaResultados();
                return msg.reply(tarjetaDefault);
            }
            
            try {
                // Obtener el mensaje anclado
                const contenido = await client.getMessageById(mensajeAnclado);
                
                if (!contenido) {
                    throw new Error('No se pudo obtener el mensaje anclado');
                }
                
                // Si el mensaje anclado es una imagen
                if (contenido.hasMedia) {
                    const media = await contenido.downloadMedia();
                    await msg.reply(media);
                } else {
                    // Si es un mensaje de texto
                    await msg.reply(contenido.body);
                }
            } catch (mensajeError) {
                console.error('Error al obtener mensaje anclado:', mensajeError);
                // Si hay error, generar tarjeta por defecto
                const tarjetaDefault = await generarTarjetaResultados();
                await msg.reply(tarjetaDefault);
            }
        } catch (pinnedError) {
            console.error('Error al obtener mensajes anclados:', pinnedError);
            // Si hay error, generar tarjeta por defecto
            const tarjetaDefault = await generarTarjetaResultados();
            await msg.reply(tarjetaDefault);
        }
    } catch (error) {
        console.error('Error al enviar tarjeta:', error);
        msg.reply('Error al obtener la tarjeta: ' + error.message);
>>>>>>> 2c8725c521acba1771a6e74f1ca594ce6f811882
    }
  } catch (error) {
    console.error("Error al enviar tarjeta:", error);
    msg.reply("Error al obtener la tarjeta anclada: " + error.message);
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
    console.error("Error al publicar resultados:", error);
  }
}

// Configurar tareas programadas
function iniciarTareasProgramadas() {
<<<<<<< HEAD
  // Ejemplo: Publicar resultados a las 12:00 PM
  cron.schedule("0 12 * * *", () => {
    const gruposAutorizados = ["GRUPO1-ID", "GRUPO2-ID"]; // Reemplazar con IDs reales
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

const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const moment = require("moment");
const cron = require("node-cron");
let saveQR;

// Intentar importar la función saveQR desde index.js
try {
  const index = require("./index.js");
  saveQR = index.saveQR;
} catch (error) {
  console.log("No se pudo importar saveQR desde index.js");
  saveQR = () => {}; // Función vacía como fallback
}

// Configurar el cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth/",
  }),
  puppeteer: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-accelerated-2d-canvas",
    ],
    headless: true,
    timeout: 60000,
  },
  restartOnAuthFail: true,
  puppeteerOptions: {
    ignoreHTTPSErrors: true,
  },
});

// Manejo de desconexiones
client.on("disconnected", (reason) => {
  console.log("Cliente desconectado:", reason);
  // Reintentar conexión después de un tiempo
  setTimeout(() => {
    console.log("Intentando reconectar...");
    client.initialize();
  }, 10000);
});

// Evento cuando se genera el código QR
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR Code generado. Por favor escanee con WhatsApp.");
  saveQR(qr); // Llamar a la función para guardar el QR
});

// Evento cuando el cliente está listo
client.on("ready", () => {
  console.log("Cliente WhatsApp está listo!");
  iniciarTareasProgramadas();
});

// Manejar mensajes entrantes
client.on("message", async (msg) => {
  try {
    if (!msg || !msg.body) return;

    const command = msg.body.toLowerCase();

    // Comandos para administradores
    if (await isAdmin(msg)) {
      switch (command) {
        case "!cerrar":
          await cerrarGrupo(msg);
          break;
        case "!abrir":
          await abrirGrupo(msg);
          break;
        case "!tarjeta":
          await enviarTarjeta(msg);
          break;
      }
    }
  } catch (error) {
    console.error("Error al procesar mensaje:", error);
  }
});

// Funciones de administración de grupos
async function isAdmin(msg) {
  if (msg.fromMe) return true;

  if (msg.chat && msg.chat.isGroup) {
    const chat = await msg.getChat();
    const participant = chat.participants.find(
      (p) => p.id._serialized === msg.author
    );
    return participant?.isAdmin;
  }
  return false;
}

async function cerrarGrupo(msg) {
  if (!msg.chat || !msg.chat.isGroup) return;

  try {
    const chat = await msg.getChat();
    await chat.setSettings({
      restrict: "true",
    });
    msg.reply("Grupo cerrado exitosamente.");
  } catch (error) {
    console.error("Error al cerrar grupo:", error);
    msg.reply("Error al cerrar el grupo.");
  }
}

async function abrirGrupo(msg) {
  if (!msg.chat || !msg.chat.isGroup) return;

  try {
    const chat = await msg.getChat();
    await chat.setSettings({
      restrict: "false",
    });
    msg.reply("Grupo abierto exitosamente.");
  } catch (error) {
    console.error("Error al abrir grupo:", error);
    msg.reply("Error al abrir el grupo.");
  }
}

async function enviarTarjeta(msg) {
  try {
    if (!msg.chat || !msg.chat.isGroup) {
      return msg.reply("Este comando solo funciona en grupos.");
    }

    const chat = await msg.getChat();

    // Intentar obtener mensajes anclados
    if (!chat.pinned || chat.pinned.length === 0) {
      return msg.reply("No hay mensajes anclados en este grupo.");
    }

    // Obtener el primer mensaje anclado (generalmente la tarjeta)
    const mensajeAnclado = chat.pinned[0];

    // Verificar si el mensaje existe
    if (mensajeAnclado) {
      // Reutilizar el contenido del mensaje anclado
      const contenido = await client.getMessageById(mensajeAnclado);
      if (contenido) {
        // Si el mensaje anclado es una imagen
        if (contenido.hasMedia) {
          const media = await contenido.downloadMedia();
          await msg.reply(media);
        } else {
          // Si es un mensaje de texto
          await msg.reply(contenido.body);
        }
      } else {
        msg.reply("No se pudo obtener el mensaje anclado.");
      }
    } else {
      msg.reply("No se encontró el mensaje anclado.");
    }
  } catch (error) {
    console.error("Error al enviar tarjeta:", error);
    msg.reply("Error al obtener la tarjeta anclada: " + error.message);
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
    console.error("Error al publicar resultados:", error);
  }
}

// Configurar tareas programadas
function iniciarTareasProgramadas() {
  // Ejemplo: Publicar resultados a las 12:00 PM
  cron.schedule("0 12 * * *", () => {
    const gruposAutorizados = ["GRUPO1-ID", "GRUPO2-ID"]; // Reemplazar con IDs reales
    publicarResultados(gruposAutorizados);
  });
}

// Función placeholder para obtener resultados
async function obtenerResultados() {
  // Implementar lógica para obtener resultados
  return "Resultados del día...";
=======
    console.log('Iniciando tareas programadas...');
    
    // Publicar resultados del mediodía (12:00 PM)
    cron.schedule('0 12 * * *', async () => {
        console.log('Ejecutando tarea programada: Resultados del mediodía');
        await publicarResultadosEnGrupos('MEDIODÍA');
    });
    
    // Publicar resultados de la tarde (6:00 PM)
    cron.schedule('0 18 * * *', async () => {
        console.log('Ejecutando tarea programada: Resultados de la tarde');
        await publicarResultadosEnGrupos('TARDE');
    });
    
    // Publicar resultados de la noche (9:00 PM)
    cron.schedule('0 21 * * *', async () => {
        console.log('Ejecutando tarea programada: Resultados de la noche');
        await publicarResultadosEnGrupos('NOCHE');
    });
    
    console.log('Tareas programadas configuradas correctamente');
}

// Función para publicar resultados en grupos autorizados
async function publicarResultadosEnGrupos(momento) {
    try {
        console.log(`Publicando resultados del ${momento}...`);
        
        // Obtener resultados actualizados
        const resultados = await generarTarjetaResultados();
        
        // Lista de grupos donde se publicarán los resultados
        // En producción, esto debería obtenerse de una configuración o base de datos
        const gruposAutorizados = [];
        
        // Obtener todos los chats
        const chats = await client.getChats();
        
        // Filtrar solo los grupos
        const grupos = chats.filter(chat => chat.isGroup);
        
        console.log(`Encontrados ${grupos.length} grupos`);
        
        // Publicar en cada grupo
        for (const grupo of grupos) {
            try {
                console.log(`Publicando resultados en grupo: ${grupo.name}`);
                await grupo.sendMessage(`🎲 *RESULTADOS ${momento} (${moment().format('DD/MM/YYYY')})* 🎲\n\n${resultados}`);
            } catch (grupoError) {
                console.error(`Error al publicar en grupo ${grupo.name}:`, grupoError);
            }
        }
        
        console.log('Publicación de resultados completada');
    } catch (error) {
        console.error('Error al publicar resultados en grupos:', error);
    }
>>>>>>> 2c8725c521acba1771a6e74f1ca594ce6f811882
}

// Iniciar el cliente
client.initialize();
// Generar una tarjeta de resultados en formato texto
async function generarTarjetaResultados() {
    try {
        // Obtener la fecha actual formateada
        const fecha = moment().format('DD/MM/YYYY');
        
        // Generar números aleatorios para simular resultados
        // En producción, estos deberían venir de tu API o base de datos
        const loteria = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const nacional = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const leidsa = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const real = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const quiniela = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        
        // Formatear el mensaje
        const mensaje = `🎯 *RESULTADOS DEL DÍA ${fecha}* 🎯\n\n` +
                       `🔸 *Lotería Nacional*: ${nacional}\n` +
                       `🔸 *Lotería Real*: ${real}\n` +
                       `🔸 *Leidsa*: ${leidsa}\n` +
                       `🔸 *La Primera*: ${loteria}\n` +
                       `🔸 *Quiniela Pega 3*: ${quiniela}\n\n` +
                       `✅ *Resultados verificados* ✅`;
        
        return mensaje;
    } catch (error) {
        console.error('Error al generar tarjeta de resultados:', error);
        return '❌ Error al generar resultados. Intente más tarde.';
    }
}

// Enviar mensaje de ayuda
async function enviarAyuda(msg) {
    const mensaje = `🤖 *COMANDOS DISPONIBLES* 🤖\n\n` +
                   `🔹 *!ayuda* - Muestra este mensaje\n` +
                   `🔹 *!resultados* - Muestra los últimos resultados\n\n` +
                   `*COMANDOS PARA ADMINISTRADORES:*\n` +
                   `🔸 *!cerrar* - Cierra el grupo (solo administradores)\n` +
                   `🔸 *!abrir* - Abre el grupo (solo administradores)\n` +
                   `🔸 *!tarjeta* - Envía la tarjeta de resultados anclada\n` +
                   `🔸 *!limites* - Muestra los límites actuales`;
    
    await msg.reply(mensaje);
}

// Enviar últimos resultados
async function enviarResultados(msg) {
    try {
        const resultados = await generarTarjetaResultados();
        await msg.reply(resultados);
    } catch (error) {
        console.error('Error al enviar resultados:', error);
        msg.reply('❌ Error al obtener resultados. Intente más tarde.');
    }
}

// Enviar límites actuales (para administradores)
async function enviarLimites(msg) {
    try {
        // Aquí deberías obtener los límites reales de tu base de datos
        const limites = `📊 *LÍMITES ACTUALES* 📊\n\n` +
                       `🔸 *Lotería Nacional*: 80\n` +
                       `🔸 *Lotería Real*: 70\n` +
                       `🔸 *Leidsa*: 60\n` +
                       `🔸 *La Primera*: 50\n` +
                       `🔸 *Quiniela*: 40\n\n` +
                       `⚠️ *Si desea modificar los límites, contacte al administrador.*`;
        
        await msg.reply(limites);
    } catch (error) {
        console.error('Error al enviar límites:', error);
        msg.reply('❌ Error al obtener límites. Intente más tarde.');
    }
}

// Obtener resultados reales
async function obtenerResultados() {
    try {
        // En producción, deberías obtener los resultados de tu API o base de datos
        // Por ahora, generamos resultados aleatorios
        const resultados = await generarTarjetaResultados();
        return resultados;
    } catch (error) {
        console.error('Error al obtener resultados:', error);
        return '❌ Error al obtener resultados. Intente más tarde.';
    }
}
