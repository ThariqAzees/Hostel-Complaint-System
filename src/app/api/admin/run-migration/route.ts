import { NextResponse } from "next/server";
import { exec } from "child_process";
import { getSessionUser } from "@/lib/auth";
import path from "path";

// Execute command in a promise to handle async
function runCommand(cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const cleanDbUrl = (process.env.DATABASE_URL || "").trim();
    const env = { ...process.env, DATABASE_URL: cleanDbUrl };
    exec(cmd, { env }, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr,
        code: error ? (error.code || 1) : 0
      });
    });
  });
}

export async function POST(request: Request) {
  // Guard the endpoint to admin only
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectRoot = process.cwd();
  // Call Prisma CLI bundle directly with absolute path
  const prismaCliPath = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
  const command = `node "${prismaCliPath}" migrate deploy --config prisma.config.mjs`;

  console.log(`Running manual migration command: ${command}`);
  const result = await runCommand(command);

  return NextResponse.json({
    success: result.code === 0,
    command,
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr
  });
}
export const dynamic = "force-dynamic";
