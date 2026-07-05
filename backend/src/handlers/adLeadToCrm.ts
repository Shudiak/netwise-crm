import { Tenant } from '../middleware/tenantResolver';
import * as odoo from '../services/odooClient';
import * as contactMap from '../services/contactMap';

export async function adLeadToCrm(
  tenant: Tenant,
  lead: { leadgenId: string; fullName: string; phone?: string; email?: string; campaign: string },
) {
  const odooLeadId = await odoo.createLead(tenant, {
    name: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    source: `Facebook Ads - ${lead.campaign}`,
  });

  return contactMap.create(tenant.id, {
    metaLeadgenId: lead.leadgenId,
    odooLeadId,
    email: lead.email,
    phone: lead.phone,
  });
}
