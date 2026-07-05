import { pool } from '../db';

export async function findByChatwootId(tenantId: string, chatwootContactId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM contact_map WHERE tenant_id = $1 AND chatwoot_contact_id = $2`,
    [tenantId, chatwootContactId],
  );
  return rows[0] ?? null;
}

export async function create(
  tenantId: string,
  data: {
    chatwootContactId?: number;
    odooLeadId?: number;
    metaLeadgenId?: string;
    email?: string;
    phone?: string;
  },
) {
  const { rows } = await pool.query(
    `INSERT INTO contact_map (tenant_id, chatwoot_contact_id, odoo_lead_id, meta_leadgen_id, email, phone)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      tenantId,
      data.chatwootContactId ?? null,
      data.odooLeadId ?? null,
      data.metaLeadgenId ?? null,
      data.email ?? null,
      data.phone ?? null,
    ],
  );
  return rows[0];
}
