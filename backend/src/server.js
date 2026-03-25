import http from "node:http";
import { app } from "./app.js";
import { connectDB } from "./data/mongodb.js";
import { seedCatalogIfNeeded } from "./data/seedCatalog.js";
import { attachRealtimeServer } from "./lib/realtime.js";

const port = Number(process.env.PORT ?? 8080);

async function start() {
  const server = http.createServer(app);
  attachRealtimeServer(server);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      console.log(`Backend server listening on http://localhost:${port}`);
      resolve();
    });
  });

  try {
    await connectDB();
    await seedCatalogIfNeeded();
  } catch (error) {
    console.error("Backend startup error:", error);
    server.close(() => {
      process.exit(1);
    });
  }
}

start().catch((error) => {
  console.error("Backend startup error:", error);
  process.exit(1);
});
