import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../db';
import { prospects } from '../../drizzle/schema';
import { sql } from 'drizzle-orm';
import { dbManager } from '../services/dbManager';

// Helper to simulate a tenant context
async function withTenant<T>(tenantId: number | null, callback: (tx: any) => Promise<T>): Promise<T> {
  return await db.transaction(async (tx) => {
    if (tenantId !== null) {
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId.toString()}, true)`);
    } else {
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', '', true)`);
    }
    return await callback(tx);
  });
}

describe('Multi-Tenant Isolation', () => {
  const tenant1Id = 1;
  const tenant2Id = 2;

  beforeAll(async () => {
    await dbManager.initialize();
  });

  test('Tenant 1 cannot see Tenant 2 prospects', async () => {
    // Insérer un prospect pour le tenant 2 (en mode système)
    await withTenant(null, async (tx) => {
      await tx.insert(prospects).values({ 
        tenantId: tenant2Id, 
        firstName: 'Secret', 
        lastName: 'Agent', 
        phone: '+1111',
        email: 'secret@agent.com',
        status: 'new'
      });
    });

    // Requêter en tant que tenant 1
    const result = await withTenant(tenant1Id, async (tx) => {
      return await tx.select().from(prospects);
    });

    // Vérifier qu'aucun prospect du tenant 2 n'est visible
    expect(result.every(p => p.tenantId === tenant1Id)).toBe(true);
    expect(result.find(p => p.firstName === 'Secret')).toBeUndefined();
  });

  test('Tenant cannot insert data for another tenant', async () => {
    await expect(
      withTenant(tenant1Id, async (tx) => {
        await tx.insert(prospects).values({ 
          tenantId: tenant2Id, 
          firstName: 'Hack', 
          lastName: 'Attempt', 
          phone: '+2222',
          email: 'hack@attempt.com',
          status: 'new'
        });
      })
    ).rejects.toThrow();
  });

  test('RLS applies to all key tables', async () => {
    const tablesWithTenantId = [
      'prospects', 'calls', 'campaigns', 'appointments',
      'messages', 'workflows', 'documents', 'customer_invoices'
    ];
    for (const table of tablesWithTenantId) {
      const result: any = await db.execute(sql`
        SELECT relrowsecurity FROM pg_class WHERE relname = ${table}
      `);
      expect(result[0]?.relrowsecurity).toBe(true);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await withTenant(null, async (tx) => {
      await tx.execute(sql`DELETE FROM prospects WHERE first_name IN ('Secret', 'Hack')`);
    });
  });
});
