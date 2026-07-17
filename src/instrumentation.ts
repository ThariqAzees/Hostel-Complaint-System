export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { runDiagnostics } = await import("./lib/diagnostics");
      await runDiagnostics();
    } catch (err) {
      console.error("Failed to run startup diagnostics:", err);
    }
  }
}
