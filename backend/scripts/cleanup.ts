import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { PrismaClient } from '@prisma/client';

(async () => {
  const TEMP_DIR = path.join(os.tmpdir(), 'ocr-auto-label');
  console.log(`🧹 Deleting temp directory: ${TEMP_DIR}`);
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    console.log('✅ Temp directory removed');
  } catch (err) {
    console.warn('Temp directory already clean or removal failed:', err);
  }

  // Reset SQLite database (only for local development)
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    console.log('🗑️  Resetting local SQLite database…');
    const prisma = new PrismaClient();
    try {
      await prisma.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE);`;
      await prisma.image.deleteMany({});
      console.log('✅ SQLite tables cleared');
    } catch (dbErr) {
      console.error('Failed to clear database:', dbErr);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log('DATABASE_URL is not SQLite – skipping DB purge');
  }

  console.log('🎉 Cleanup complete!');
  process.exit(0);
})(); 