const { execSync } = require("child_process");

try {
  console.log("Applying database migrations...");
  const cleanDbUrl = (process.env.DATABASE_URL || "").trim();
  const env = { ...process.env, DATABASE_URL: cleanDbUrl };
  execSync("node node_modules/prisma/build/index.js migrate deploy --config prisma.config.mjs", { stdio: "inherit", env });
  console.log("Database migrations applied successfully!");
} catch (error) {
  console.error("WARNING: Database migration failed during startup:", error);
  console.log("Proceeding to start the application server anyway...");
}

console.log("Starting Next.js application server...");
// Load the standalone Next.js server.js
require("./server.js");
