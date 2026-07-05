import 'dotenv/config';
import express from 'express';
import { chatwootWebhookRouter } from './routes/webhooksChatwoot';
import { metaWebhookRouter } from './routes/webhooksMeta';
import { portalRouter } from './routes/portal';
import './processors/syncLead'; // levanta el worker de la cola al arrancar

const app = express();
app.use(express.json());

app.use(chatwootWebhookRouter);
app.use(metaWebhookRouter);
app.use('/api', portalRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`backend escuchando en :${port}`));
