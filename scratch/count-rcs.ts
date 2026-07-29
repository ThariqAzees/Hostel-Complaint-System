import { prisma } from "../src/lib/db";

async function main() {
  const rcs = await prisma.user.findMany({
    where: { role: "RC" },
    select: { name: true, email: true, is_active: true }
  });
  console.log(JSON.stringify(rcs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
