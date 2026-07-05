import { Tenant } from '../middleware/tenantResolver';
import * as odoo from '../services/odooClient';
import * as contactMap from '../services/contactMap';

export async function conversationToCrm(
  tenant: Tenant,
  chatwootContact: { id: number; name: string; phone_number?: string; email?: string },
) {
  const existing = await contactMap.findByChatwootId(tenant.id, chatwootContact.id);
  if (existing) return existing;

  const leadId = await odoo.createLead(tenant, {
    name: chatwootContact.name,
    phone: chatwootContact.phone_number,
    email: chatwootContact.email,
    source: 'Chatwoot',
  });

  return contactMap.create(tenant.id, {
    chatwootContactId: chatwootContact.id,
    odooLeadId: leadId,
    email: chatwootContact.email,
    phone: chatwootContact.phone_number,
  });
}
