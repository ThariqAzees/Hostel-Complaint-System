const { execSync } = require("child_process");

try {
  console.log("Applying database migrations...");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  console.log("Database migrations applied successfully!");
} catch (error) {
  console.error("Database migration failed:", error);
  process.exit(1);
}

console.log("Starting Next.js application server...");
// Load the standalone Next.js server.js
require("./server.js");
