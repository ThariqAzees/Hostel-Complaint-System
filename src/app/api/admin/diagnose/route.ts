import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  // Guard the endpoint to admin only
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    databaseConnected: false,
    updatedAtColumnExists: false,
    columns: [],
    error: null
  };

  try {
    // 1. Test database connection
    await prisma.$queryRaw`SELECT 1`;
    diagnostics.databaseConnected = true;

    // 2. Query columns on student_imports table in Postgres
    const columnsResult = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'student_imports'
    `);
    
    diagnostics.columns = columnsResult.map(c => ({
      name: c.column_name,
      type: c.data_type
    }));

    diagnostics.updatedAtColumnExists = columnsResult.some(
      c => c.column_name === "updated_at"
    );

  } catch (err: any) {
    diagnostics.error = {
      message: err.message,
      code: err.code,
      stack: err.stack
    };
  }

  return NextResponse.json(diagnostics);
}
