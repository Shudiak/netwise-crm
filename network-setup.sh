#!/usr/bin/env bash
set -e
docker network inspect tenant-net >/dev/null 2>&1 || docker network create tenant-net
echo "Red 'tenant-net' lista. Los tres stacks (odoo, chatwoot, backend) deben usarla como red externa."
