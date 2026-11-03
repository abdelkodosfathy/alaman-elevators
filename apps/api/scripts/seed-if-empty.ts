// Seeds the demo catalog only when the database has no products yet.
// The seed replaces products wholesale, so running it on every deploy would wipe prices edited from the admin panel.
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

async function main() {
  const prisma = new PrismaClient();
  const products = await prisma.product.count();
  await prisma.$disconnect();
  if (products > 0) {
    console.log(`Catalog has ${products} products, skipping seed`);
    return;
  }
  execSync('npx prisma db seed', { stdio: 'inherit' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
