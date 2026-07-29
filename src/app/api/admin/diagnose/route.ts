import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { exec } from "child_process";
import path from "path";

// Execute command in a promise to handle async
function runCommand(cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr,
        code: error ? (error.code || 1) : 0
      });
    });
  });
}

export async function GET(request: Request) {
  // Guard the endpoint to admin only
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    databaseConnected: false,
    databaseUrlMasked: "",
    connectionInfo: null,
    prismaMigrationsTableExists: false,
    appliedMigrations: [],
    updatedAtColumnExists: false,
    migrateStatus: null,
    error: null
  };

  try {
    // Mask DATABASE_URL for security/privacy
    const dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl) {
      // postgresql://user:pass@host:port/db?schema=public
      diagnostics.databaseUrlMasked = dbUrl.replace(/:[^:@/]+@/, ":***@");
    }

    // 1. Test database connection & get current session connection info
    const connInfoResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT current_database() as db, current_user as "user", inet_server_addr() as host, inet_server_port() as port
    `);
    if (connInfoResult && connInfoResult.length > 0) {
      diagnostics.databaseConnected = true;
      diagnostics.connectionInfo = {
        database: connInfoResult[0].db,
        user: connInfoResult[0].user,
        host: connInfoResult[0].host ? connInfoResult[0].host.toString() : "localhost/socket",
        port: connInfoResult[0].port
      };
    }

    // 2. Check if _prisma_migrations table exists
    const tableCheck = await prisma.$queryRawUnsafe<any[]>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '_prisma_migrations'
      ) as exists
    `);
    
    diagnostics.prismaMigrationsTableExists = tableCheck && tableCheck.length > 0 && tableCheck[0].exists;

    // 3. Query applied migrations if table exists
    if (diagnostics.prismaMigrationsTableExists) {
      const migrationsResult = await prisma.$queryRawUnsafe<any[]>(`
        SELECT id, migration_name, applied_steps_count, finished_at 
        FROM _prisma_migrations 
        ORDER BY finished_at DESC
      `);
      diagnostics.appliedMigrations = migrationsResult;
    }

    // 4. Query columns on student_imports table in Postgres to check updatedAt
    const columnsResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'student_imports'
    `);
    
    diagnostics.updatedAtColumnExists = columnsResult.some(
      c => c.column_name === "updated_at"
    );

    // 5. Run npx prisma migrate status using the local package CLI bundle
    const projectRoot = process.cwd();
    const prismaCliPath = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
    const statusResult = await runCommand(`node "${prismaCliPath}" migrate status`);
    
    diagnostics.migrateStatus = {
      code: statusResult.code,
      stdout: statusResult.stdout,
      stderr: statusResult.stderr
    };

  } catch (err: any) {
    diagnostics.error = {
      message: err.message,
      code: err.code,
      stack: err.stack
    };
  }

  return NextResponse.json(diagnostics);
}
export const dynamic = "force-dynamic";
