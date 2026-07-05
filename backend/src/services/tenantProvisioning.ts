import { pool } from '../db';
import { createDatabase } from './odooClient';
import { createPlatformAccount } from './chatwootClient';

// Ciclo completo de alta de un cliente nuevo:
//  1. crea su base de datos en Odoo (multi-tenant por db_filter)
//  2. crea su "account" dentro de la instalación compartida de Chatwoot
//  3. guarda el mapeo en tu propia base para que el resto del backend lo use
export async function provisionTenant(input: { name: string; subdomain: string; adminEmail: string }) {
  const odooDbName = input.subdomain;
  const odooAdminPassword = Math.random().toString(36).slice(2, 12);

  await createDatabase(process.env.ODOO_MASTER_PASSWORD!, odooDbName, input.adminEmail, odooAdminPassword);

  const chatwootAccount = await createPlatformAccount(input.name);

  const { rows } = await pool.query(
    `INSERT INTO tenants (name, subdomain, odoo_db, odoo_user, odoo_api_key, chatwoot_account_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [input.name, input.subdomain, odooDbName, input.adminEmail, odooAdminPassword, chatwootAccount.id],
  );

  return rows[0];
}
