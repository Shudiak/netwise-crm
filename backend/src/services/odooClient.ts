import xmlrpc from 'xmlrpc';
import { Tenant } from '../middleware/tenantResolver';

const ODOO_URL = process.env.ODOO_URL!;

function client(path: string) {
  const url = new URL(ODOO_URL + path);
  return xmlrpc.createClient({
    host: url.hostname,
    port: Number(url.port || 8069),
    path: url.pathname,
  });
}

function call(c: xmlrpc.Client, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    c.methodCall(method, params, (err, value) => (err ? reject(err) : resolve(value)));
  });
}

export async function authenticate(tenant: Tenant): Promise<number> {
  const common = client('/xmlrpc/2/common');
  return call(common, 'authenticate', [tenant.odoo_db, tenant.odoo_user, tenant.odoo_api_key, {}]);
}

export async function createLead(
  tenant: Tenant,
  data: { name: string; phone?: string; email?: string; source: string },
) {
  const uid = await authenticate(tenant);
  const models = client('/xmlrpc/2/object');
  return call(models, 'execute_kw', [
    tenant.odoo_db,
    uid,
    tenant.odoo_api_key,
    'crm.lead',
    'create',
    [{ name: data.name, phone: data.phone, email_from: data.email, description: `Origen: ${data.source}` }],
  ]);
}

// usado solo por el servicio de aprovisionamiento, requiere el master password de Odoo
export async function createDatabase(
  masterPassword: string,
  dbName: string,
  adminEmail: string,
  adminPassword: string,
) {
  const db = client('/xmlrpc/2/db');
  return call(db, 'create_database', [masterPassword, dbName, false, 'es_MX', adminPassword, adminEmail]);
}
