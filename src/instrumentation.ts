export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation Hook] Starting database migrations...");

    // Dynamic imports to prevent compiler warnings in Edge Runtime
    const { exec } = await import("child_process");
    const path = await import("path");

    const projectRoot = process.cwd();
    const prismaCliPath = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

    const cleanDbUrl = (process.env.DATABASE_URL || "").trim();
    const env = { ...process.env, DATABASE_URL: cleanDbUrl };

    exec(`node "${prismaCliPath}" migrate deploy --config prisma.config.mjs`, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error("[Instrumentation Hook] Database migration failed:", error.message);
        console.error("[Instrumentation Hook] Stderr:", stderr);
      } else {
        console.log("[Instrumentation Hook] Database migrations applied successfully!");
        console.log(stdout);
      }
    });
  }
}
