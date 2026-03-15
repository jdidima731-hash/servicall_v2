import { beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../server/index.js';

beforeAll(async () => {
  console.log('🔧 Initialisation des tests...');
});

beforeEach(async () => {
  // Nettoyer les tables avant chaque test
  await db.execute('TRUNCATE users CASCADE');
  await db.execute('TRUNCATE organizations CASCADE');
});

afterAll(async () => {
  console.log('🧹 Nettoyage après les tests...');
  await db.execute('TRUNCATE users CASCADE');
  await db.execute('TRUNCATE organizations CASCADE');
});
