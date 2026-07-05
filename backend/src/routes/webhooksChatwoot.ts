import { Router } from 'express';
import { tenantResolver } from '../middleware/tenantResolver';
import { syncQueue } from '../queue';

export const chatwootWebhookRouter = Router();

chatwootWebhookRouter.post('/webhooks/chatwoot', tenantResolver, async (req, res) => {
  const event = req.body.event;

  if (event === 'contact_created' || event === 'conversation_created') {
    await syncQueue.add('conversation-to-crm', {
      tenantId: req.tenant!.id,
      contact: req.body.contact ?? req.body.meta?.sender,
    });
  }

  res.status(200).json({ received: true });
});
