import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  odoo_db: string;
  odoo_user: string;
  odoo_api_key: string;
  chatwoot_account_id: number;
  meta_page_id: string | null;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

// Resuelve el tenant a partir de tres posibles fuentes:
//  1) subdominio del portal   -> clientea.tuapp.com
//  2) page_id de un webhook de Meta
//  3) account.id de un webhook de Chatwoot
export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = req.hostname.split('.')[0];
    const pageId = req.body?.entry?.[0]?.id ?? null;
    const chatwootAccountId = req.body?.account?.id ?? null;

    const { rows } = await pool.query(
      `SELECT * FROM tenants
       WHERE subdomain = $1 OR meta_page_id = $2 OR chatwoot_account_id = $3
       LIMIT 1`,
      [sub, pageId, chatwootAccountId],
    );

    const tenant = rows[0] ?? null;
    if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });

    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}
