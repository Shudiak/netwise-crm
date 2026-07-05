# Stack Chatwoot + Odoo + Backend orquestador

Tres stacks independientes conectados por una red Docker compartida (`tenant-net`).
Pensado para probarse primero en un servidor local virtualizado, sin IP pública ni Traefik.

```
netwise-crm/
├── network-setup.sh
├── odoo/          → CRM, multi-tenant por base de datos (db_filter)
├── chatwoot/       → chat, multi-tenant nativo (accounts)
└── backend/        → tu fachada + orquestador (Express + TypeScript)
```

## 0. Requisitos en el servidor

- Docker + Docker Compose v2
- Puertos libres: 8069, 8072 (Odoo), 3000 (Chatwoot), 4000 (backend)

## 1. Crear la red compartida (una sola vez)

```bash
cd netwise-crm
./network-setup.sh
```

Los tres `docker-compose.yml` referencian `tenant-net` como red **externa** — si no la creas antes, el `docker compose up` de cada stack falla.

## 2. Levantar Odoo

```bash
cd odoo
docker compose up -d
```

Revisa que la contraseña maestra en `config/odoo.conf` (`admin_passwd`) sea la misma que pondrás luego en `backend/.env` como `ODOO_MASTER_PASSWORD`. Cámbiala antes de exponer esto a nada que no sea tu red local.

### Verificar `db_filter` sin depender de DNS todavía

```bash
curl -H "Host: clientea.local" http://<ip-de-tu-vm>:8069/web/login
```

Si te devuelve el login (aunque la base `clientea` todavía no exista, Odoo debe mostrar el flujo correcto de "crear base" filtrado a ese nombre) sabes que el filtro está funcionando antes de meter ningún proxy.

## 3. Levantar Chatwoot

```bash
cd ../chatwoot
cp .env.example .env
# genera un secreto real y reemplázalo en .env
openssl rand -hex 64
```

Primer arranque — hay que preparar la base de datos y migrar:

```bash
docker compose up -d chatwoot-db chatwoot-redis
docker compose run --rm chatwoot-rails bundle exec rails db:chatwoot_prepare
docker compose up -d
```

Entra a `http://<ip-de-tu-vm>:3000`, crea el primer usuario (super admin) desde el asistente de instalación.

### Generar el token de la Platform API (lo necesita tu backend)

Desde la consola de Rails dentro del contenedor:

```bash
docker compose exec chatwoot-rails bundle exec rails console
```

```ruby
user = User.find_by(email: 'tu_admin@correo.com')
token = PlatformApiKey.create!(user: user)
puts token.access_token
```

Copia ese valor en `backend/.env` como `CHATWOOT_PLATFORM_TOKEN`.

## 4. Levantar el backend

```bash
cd ../backend
cp .env.example .env
# completa ODOO_MASTER_PASSWORD y CHATWOOT_PLATFORM_TOKEN con los valores de los pasos anteriores
docker compose up -d --build
```

Prueba que responde:

```bash
curl http://<ip-de-tu-vm>:4000/health
# -> {"ok":true}
```

## 5. Dar de alta tu primer cliente de prueba (tenant)

```bash
curl -X POST http://<ip-de-tu-vm>:4000/api/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente A","subdomain":"clientea","adminEmail":"admin@clientea.local"}'
```

Esto internamente:
1. Crea la base de datos `clientea` en Odoo vía `create_database` (XML-RPC).
2. Crea un `account` nuevo en la misma instalación de Chatwoot.
3. Guarda el mapeo en la tabla `tenants` de tu propia base (`backend-db`).

## 6. Simular el subdominio desde tu máquina cliente

Como no tienes DNS real, edita el `hosts` de la máquina desde la que vas a probar (no del servidor):

```
# /etc/hosts (Linux/Mac) o C:\Windows\System32\drivers\etc\hosts (Windows)
<ip-de-tu-vm>   clientea.local
```

Ahora `http://clientea.local:4000/api/conversations` resuelve el tenant correcto a través del middleware `tenantResolver`.

> Nota: en este stack de prueba el backend detecta el tenant por subdominio directamente,
> sin proxy intermedio. Cuando pases a producción con Traefik, el header `Host` seguirá
> llegando igual — solo agregas TLS y el enrutamiento a Odoo delante de todo esto.

## 7. Probar el flujo de webhooks localmente

Como tu servidor no tiene IP pública, Meta no podrá llamarte directamente. Para probar el flujo de principio a fin sin exponer nada a internet, simula el webhook a mano:

```bash
curl -X POST http://<ip-de-tu-vm>:4000/webhooks/chatwoot \
  -H "Content-Type: application/json" \
  -H "Host: clientea.local" \
  -d '{
    "event": "contact_created",
    "contact": { "id": 1, "name": "Juan Pérez", "phone_number": "+521234567890" }
  }'
```

Revisa los logs del backend (`docker compose logs -f backend`) para ver el job encolándose y procesándose contra Odoo.

Para probar el webhook de Meta sin cuenta de Ads real, puedes simular el payload de `leadgen` a mano de la misma forma — solo cambia la URL a `/webhooks/meta` y ajusta el cuerpo al formato de `entry[].changes[]` que envía Meta.

## 8. Orden de apagado/prendido recomendado

```
odoo → chatwoot → backend      (al levantar)
backend → chatwoot → odoo      (al apagar)
```

El backend depende de que las otras dos APIs respondan; si las levantas después, simplemente reinicia el contenedor `backend` (`docker compose restart backend`).

## Próximos pasos sugeridos

- Cuando quieras exponer esto a internet real: agrega Traefik como cuarto stack, con `HostRegexp` apuntando a Odoo y un router aparte para Chatwoot y el backend, más `mkcert` o Let's Encrypt según el caso.
- Agrega autenticación real (JWT) al `portalRouter` — en este esqueleto los endpoints del portal están abiertos para facilitar las pruebas.
- El `event_log` ya está en el esquema de `init-db.sql` pero el backend aún no escribe en él — es el siguiente paso natural para tener trazabilidad y reintentos manuales de eventos fallidos.
