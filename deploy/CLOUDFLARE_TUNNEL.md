# Cloudflare Tunnel en produccion

El tunel se ejecuta como el servicio `cloudflared` de
`compose.production.yaml`. El token vive separado en `deploy/.env.tunnel` y
nunca se inyecta en backend/worker ni se guarda en Git.

## Preparacion en Cloudflare Zero Trust

1. Agrega `luisenriquebautistacoz.com` a Cloudflare y configura los nameservers
   que indique Cloudflare.
2. Crea un tunel remoto, por ejemplo `academia-prod`.
3. Genera el token del tunel y pegalo unicamente en la VM como
   `CLOUDFLARE_TUNNEL_TOKEN`.
4. Crea las rutas publicadas en este orden:

   - Hostname `academia.luisenriquebautistacoz.com`, path `/api/*`, servicio
     `http://backend:3000`.
   - El mismo hostname, path `/socket.io/*`, servicio `http://backend:3000`.
   - El mismo hostname sin path, servicio `http://frontend:3000`.

Las rutas por path no eliminan el prefijo, por lo que `/api/v1/...` llega al
backend con la misma ruta.

## Preparacion en la VM

```bash
mkdir -p /opt/academia
cd /opt/academia
git clone <URL-PRIVADA-DEL-REPOSITORIO> .
cp deploy/.env.production.example deploy/.env.production
cp deploy/.env.tunnel.example deploy/.env.tunnel
chmod 600 deploy/.env.production deploy/.env.tunnel
# Completar secretos reales, dominio, SMTP y Google.
set -a; . deploy/.env.tunnel; set +a
docker compose --env-file deploy/.env.production \
  -f docker-compose.yml -f compose.production.yaml config --quiet
docker compose --env-file deploy/.env.production \
  -f docker-compose.yml -f compose.production.yaml up -d db minio
```

Para las actualizaciones automáticas, instalar también en esta VM el runner
self-hosted de GitHub con la etiqueta `production`. El workflow de CD se
ejecuta localmente en ese runner y solo necesita conexiones salientes hacia
GitHub y Cloudflare.

No publiques los puertos de PostgreSQL, MinIO, backend ni frontend. El acceso
administrativo de MinIO debe realizarse por SSH o Cloudflare Access restringido.
