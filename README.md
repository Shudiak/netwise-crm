# Netwise CRM Stack

Tres stacks independientes conectados por una red Docker compartida (`tenant-net`).
Diseñado para desplegarse en servidores localmente virtualizados (VMware, Proxmox) o VPS.

```
netwise-crm/
├── network-setup.sh    → Crea la red Docker compartida (una sola vez)
├── odoo/               → CRM Odoo 19 Community + Dark Mode
├── chatwoot/            → Chat multicanal, multi-tenant nativo
└── backend/             → API orquestador (Express + TypeScript)
```

## Stack actual — Odoo 19

| Componente | Versión | Notas |
|---|---|---|
| Odoo | 19.0 Community | Última versión estable |
| PostgreSQL | 16 | Requerido por Odoo 19 |
| Dark Mode | dark_mode_backend v19.0 | Cybrosys — se aplica automáticamente |
| Multi-tenant | `db_filter = ^%d$` | Filtra BD por subdominio/Host header |
| Workers | 2 | Ajustar según CPU/RAM |
| Longpolling | 8072 | Chat interno y notificaciones |

## Puertos

| Puerto | Servicio |
|---|---|
| 8069 | Odoo Web / XML-RPC |
| 8072 | Odoo Longpolling |
| 3000 | Chatwoot |
| 4000 | Backend API |

## Requisitos

- Docker + Docker Compose v2
- Mínimo **20GB disco** (imágenes Odoo 19 + Postgres 16 = ~4GB, BD crece con uso)
- Puertos libres: 8069, 8072, 3000, 4000

## 1. Despliegue rápido (Odoo)

```bash
git clone git@github.com:Shudiak/netwise-crm.git
cd netwise-crm
./network-setup.sh          # Crea la red tenant-net (solo la primera vez)
cd odoo
docker compose up -d
```

Después de levantar, entra a `http://<ip>:8069` y:
1. Crea la base de datos (nombre, email admin, contraseña master)
2. El dark mode se aplica automáticamente (ya está instalado como módulo)
3. Si necesitas reinstalar: `docker compose stop odoo && docker compose run --rm odoo odoo -c /etc/odoo/odoo.conf -d <nombre_bd> -i dark_mode_backend --stop-after-init`

## 2. Levantar Chatwoot

```bash
cd ../chatwoot
cp .env.example .env
openssl rand -hex 64      # Genera secreto para .env

docker compose up -d chatwoot-db chatwoot-redis
docker compose run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare
docker compose up -d
```

Entrar a `http://<ip>:3000`, crear super admin desde el asistente.

### Token Platform API (para el backend)

```bash
docker compose exec chatwoot-rails bundle exec rails console
```
```ruby
user = User.find_by(email: 'admin@correo.com')
token = PlatformApiKey.create!(user: user)
puts token.access_token
```

## 3. Levantar el Backend

```bash
cd ../backend
cp .env.example .env
# Completa ODOO_MASTER_PASSWORD y CHATWOOT_PLATFORM_TOKEN
docker compose up -d --build
```

```bash
curl http://<ip>:4000/health   # -> {"ok":true}
```

## 4. Alta de tenant (cliente)

```bash
curl -X POST http://<ip>:4000/api/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente A","subdomain":"clientea","adminEmail":"admin@clientea.local"}'
```

Esto crea: BD en Odoo (XML-RPC) + account en Chatwoot + mapeo en backend-db.

## 5. Pruebas locales sin DNS

Edita `hosts` en tu máquina cliente (no en el servidor):

```
<ip-de-la-vm>   clientea.local
```

```
http://clientea.local:4000/api/conversations
```

## 6. Simular webhooks (sin IP pública)

```bash
curl -X POST http://<ip>:4000/webhooks/chatwoot \
  -H "Content-Type: application/json" \
  -H "Host: clientea.local" \
  -d '{
    "event": "contact_created",
    "contact": { "id": 1, "name": "Juan Pérez", "phone_number": "+521****7890" }
  }'
```

## 7. Orden de arranque/apagado

```
Levantar:  odoo → chatwoot → backend
Apagar:    backend → chatwoot → odoo
```

## Expansión de disco (VMware)

Si el disco del server se quedó sin espacio tras expandirlo en VMware:

```bash
# El PV detecta el espacio nuevo automáticamente
lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv
resize2fs /dev/ubuntu-vg/ubuntu-lv
df -h /
```

## Configuración de Odoo

Archivo: `odoo/config/odoo.conf`

| Parámetro | Valor | Descripción |
|---|---|---|
| `admin_passwd` | `odoo` | ⚠️ Cambiar antes de producción |
| `db_host` | `odoo-db` | Container Postgres |
| `db_filter` | `^%d$` | Multi-tenant por subdominio |
| `proxy_mode` | `True` | Detrás de reverse proxy |
| `workers` | `2` | Ajustar por CPU |
| `longpolling_port` | `8072` | Notificaciones/chat |

## Addons custom

- **dark_mode_backend** (Cybrosys) — Tema oscuro automático para Odoo 19 Community

## Próximos pasos

- [ ] Traefik como reverse proxy con TLS (Let's Encrypt / mkcert)
- [ ] Autenticación JWT en `portalRouter`
- [ ] Event log en `backend-db` para trazabilidad de webhooks
- [ ] Backups automatizados de PostgreSQL
