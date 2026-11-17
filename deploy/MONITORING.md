# Monitoreo de produccion

El Compose productivo rota los logs de Docker con `json-file`, hasta 10 MB por
archivo y cinco archivos por contenedor. El script
`scripts/monitor-production.sh` comprueba:

- PostgreSQL, MinIO, backend y frontend en estado `healthy`.
- ClamAV en estado `running`; el backend rechaza cargas si el antivirus no responde.
- Cloudflare Tunnel en estado `running`.
- `minio-init` finalizado con codigo 0.
- Uso del disco configurado en `MONITOR_DISK_PATH`.

## Prueba manual

Desde la raiz del repositorio:

```bash
chmod +x scripts/monitor-production.sh
./scripts/monitor-production.sh
```

El resultado exitoso es una linea `OK`. Un fallo devuelve codigo distinto de
cero para que cron, systemd o un monitor externo genere una alerta.

## Ejecucion cada cinco minutos

En la VM, agregar al crontab del usuario que administra Docker:

```cron
*/5 * * * * cd /opt/academia && /opt/academia/scripts/monitor-production.sh >> /var/log/academia-monitor.log 2>&1
```

Instalar también la política de rotación del log del monitor:

```bash
sudo install -m 0644 deploy/academia-monitor.logrotate /etc/logrotate.d/academia-monitor
sudo logrotate -d /etc/logrotate.d/academia-monitor
```

La política conserva ocho rotaciones semanales y comprime las anteriores.

Para recibir alertas, configurar en `deploy/.env.production` un
`MONITOR_ALERT_WEBHOOK_URL` compatible con payloads JSON `{ "text": "..." }`.
No guardar ese webhook en Git.

Revisiones útiles:

```bash
docker system df
docker compose --env-file deploy/.env.production \
  --env-file deploy/.env.tunnel \
  -f docker-compose.yml -f compose.production.yaml logs --tail=100 backend cloudflared
```
