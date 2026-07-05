import { Router } from 'express';
import { tenantResolver } from '../middleware/tenantResolver';
import * as chatwoot from '../services/chatwootClient';
import { provisionTenant } from '../services/tenantProvisioning';

export const portalRouter = Router();

portalRouter.get('/conversations', tenantResolver, async (req, res) => {
  const data = await chatwoot.listConversations(req.tenant!);
  res.json(data);
});

// alta de un cliente nuevo — en producción, protegido con un guard de admin
portalRouter.post('/admin/tenants', async (req, res) => {
  const tenant = await provisionTenant(req.body);
  res.status(201).json(tenant);
});
