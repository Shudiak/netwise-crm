import axios from 'axios';
import { Tenant } from '../middleware/tenantResolver';

const http = axios.create({
  baseURL: process.env.CHATWOOT_URL,
  headers: { api_access_token: process.env.CHATWOOT_PLATFORM_TOKEN! },
});

export async function createContact(
  tenant: Tenant,
  data: { name: string; phone_number?: string; email?: string },
) {
  const { data: res } = await http.post(`/api/v1/accounts/${tenant.chatwoot_account_id}/contacts`, data);
  return res;
}

export async function listConversations(tenant: Tenant) {
  const { data } = await http.get(`/api/v1/accounts/${tenant.chatwoot_account_id}/conversations`);
  return data;
}

// crea un "account" nuevo dentro de la misma instalación de Chatwoot -> un cliente nuevo del SaaS
export async function createPlatformAccount(name: string) {
  const { data } = await http.post(`/platform/api/v1/accounts`, { name });
  return data; // { id, name, ... }
}
