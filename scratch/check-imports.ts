import { prisma } from "../src/lib/db";

async function main() {
  const imports = await prisma.studentImport.findMany({
    orderBy: { created_at: "desc" },
    take: 5,
    include: {
      records: {
        take: 3,
      }
    }
  });
  console.log(JSON.stringify(imports, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
