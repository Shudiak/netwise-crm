import { Router } from 'express';
import axios from 'axios';
import { tenantResolver } from '../middleware/tenantResolver';
import { syncQueue } from '../queue';

export const metaWebhookRouter = Router();

// paso de verificación que exige Meta al registrar la URL del webhook
metaWebhookRouter.get('/webhooks/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

metaWebhookRouter.post('/webhooks/meta', tenantResolver, async (req, res) => {
  res.status(200).send('EVENT_RECEIVED'); // responder rápido, procesar después

  const entries = req.body.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;
      const leadgenId = change.value.leadgen_id;

      const { data } = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, {
        params: { access_token: process.env.META_PAGE_ACCESS_TOKEN },
      });

      await syncQueue.add('ad-lead-to-crm', {
        tenantId: req.tenant!.id,
        leadgenId,
        fieldData: data.field_data,
        campaign: data.campaign_name ?? 'sin campaña',
      });
    }
  }
});
