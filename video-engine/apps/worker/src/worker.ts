import { startWorkers } from "./pipeline/queues.js";
import { handlers } from "./stages/index.js";
import { log } from "./lib/logger.js";
import { config } from "./config.js";

const workers = startWorkers(handlers);
log.info(`Workers up (${workers.length} queues, paid APIs ${config.PAID_APIS_ENABLED ? "ENABLED" : "mocked"})`);

const shutdown = async () => {
  log.info("shutting down");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
