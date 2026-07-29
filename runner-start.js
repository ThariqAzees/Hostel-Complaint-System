const { execSync } = require("child_process");

try {
  console.log("Applying database migrations...");
  execSync("node node_modules/prisma/build/index.js migrate deploy", { stdio: "inherit" });
  console.log("Database migrations applied successfully!");
} catch (error) {
  console.error("WARNING: Database migration failed during startup:", error);
  console.log("Proceeding to start the application server anyway...");
}

console.log("Starting Next.js application server...");
// Load the standalone Next.js server.js
require("./server.js");
