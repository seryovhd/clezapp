import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import Company from "./models/Company";
import { startQueueProcess } from "./queues";
import { TransferTicketQueue } from "./wbotTransferTicketQueue";
import cron from "node-cron";
import EvolutionMonitor from "./services/EvolutionApiServices/EvolutionMonitor";


const server = app.listen(process.env.PORT, async () => {
  const companies = await Company.findAll();
  const allPromises: any[] = [];
  companies.map(async c => {
  
  	if(c.status === true){  
    	const promise = StartAllWhatsAppsSessions(c.id);
    	allPromises.push(promise);
    }else{
      logger.info(`❌ EMPRESA INACTIVA: ${c.id} | ${c.name}`);
    }
  
  });

  Promise.all(allPromises).then(() => {
    startQueueProcess();
  });
  logger.info(`🚀 SERVIDOR INICIADO EN EL PUERTO: ${process.env.PORT}`);
});

process.on("uncaughtException", err => {
  console.error(`${new Date().toUTCString()} uncaughtException:`, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, p) => {
  console.error(
    `${new Date().toUTCString()} unhandledRejection:`,
    reason,
    p
  );
  process.exit(1);
});


cron.schedule("*/5 * * * *", async () => {  // De 1 minuto para 5 minutos
  try {
    logger.info(`🚀 SERVICIO DE TRANSFERENCIA DE TICKETS INICIADO`);
    await TransferTicketQueue();
  } catch (error) {
    logger.error(`❌ ERROR EN EL CRON JOB:`, error);
  }  
});



initIO(server);
EvolutionMonitor.start();

// Configure graceful shutdown to handle all outstanding promises
gracefulShutdown(server, {
  signals: "SIGINT SIGTERM",
  timeout: 30000, // 30 seconds
  onShutdown: async () => {
    logger.info("🔒 CERRANDO EL SERVIDOR DE MANERA SEGURA...");
    // Agrega cualquier otro código de limpieza aquí, si es necesario
  },
  finally: () => {
    logger.info("✅ APAGADO DEL SERVIDOR COMPLETADO.");
  }  
});
