import { Worker } from 'bullmq';
import { connection } from '../queue';
import { pool } from '../db';
import { conversationToCrm } from '../handlers/conversationToCrm';
import { adLeadToCrm } from '../handlers/adLeadToCrm';

export const syncWorker = new Worker(
  'sync-events',
  async (job) => {
    const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [job.data.tenantId]);
    const tenant = rows[0];
    if (!tenant) throw new Error('tenant no encontrado para el job ' + job.id);

    if (job.name === 'conversation-to-crm') {
      return conversationToCrm(tenant, job.data.contact);
    }

    if (job.name === 'ad-lead-to-crm') {
      const fields: Record<string, string> = {};
      for (const f of job.data.fieldData) fields[f.name] = f.values[0];

      return adLeadToCrm(tenant, {
        leadgenId: job.data.leadgenId,
        fullName: fields.full_name ?? 'Sin nombre',
        phone: fields.phone_number,
        email: fields.email,
        campaign: job.data.campaign,
      });
    }
  },
  { connection },
);

syncWorker.on('failed', (job, err) => {
  console.error(`job ${job?.id} falló:`, err.message);
});
