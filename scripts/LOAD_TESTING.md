# Pruebas de carga

El script `load-test.mjs` usa `fetch` nativo de Node y no modifica datos. Por defecto verifica salud, catálogo de cursos y catálogo de cohortes.

```powershell
node scripts/load-test.mjs --base http://localhost:3003/api/v1 --requests 1000 --concurrency 50
```

El resultado incluye tasa de éxito, throughput, distribución de códigos HTTP y percentiles p50/p95/p99. Se puede ajustar el timeout por solicitud con `--timeout 10000`.

Para endpoints protegidos se puede pasar un token y rutas específicas:

```powershell
node scripts/load-test.mjs --token $env:ACCESS_TOKEN --path /academic/enrollments/me,/certificates/my
```

Las pruebas de escritura (matrículas, carga de archivos y generación de certificados) deben ejecutarse con datos de prueba aislados, usando un token de servicio y un archivo fixture; el script admite esas rutas mediante `--path`, pero no inventa payloads ni crea registros reales.

## Carga sostenida autenticada

`sustained-load.mjs` repite recorridos de lectura y escritura de una fixture
local. Solo admite un origen de loopback y una fixture con `isolated: true`.
La API y PostgreSQL deben ser desechables y tener deshabilitados correo,
proveedores externos y tareas programadas. No utilizar sesiones reales.

```powershell
node scripts/sustained-load.mjs ruta-a-fixture-local.json
```

Formato de la fixture (los identificadores y tokens deben existir en la base
de prueba):

```json
{
  "isolated": true,
  "base": "http://127.0.0.1:3000/api/v1",
  "maxP95Ms": 1000,
  "clients": [{
    "token": "jwt-de-prueba",
    "steps": [
      { "name": "matriculas", "path": "/academic/enrollments/me" },
      { "name": "progreso", "method": "PATCH", "path": "/academic/materials/UUID/progress", "body": { "completed": true } }
    ]
  }],
  "stages": [{ "users": 1, "durationMs": 60000, "pauseMs": 5000 }]
}
```

Cada cliente realiza una acción por intervalo; las etapas seleccionan los
primeros `users` clientes. No se omiten los límites de la API: HTTP 429,
timeouts, errores de red y respuestas no exitosas cuentan como fallos. La
latencia incluye el cuerpo completo. El proceso devuelve código 1 si una
etapa tiene fallos o supera `maxP95Ms`.

Guardar únicamente resultados agregados y métricas de recursos. Las fixtures
contienen tokens y deben permanecer fuera de Git. Registrar CPU, RAM, límites
de los contenedores, conexiones de PostgreSQL, reinicios y consistencia de las
escrituras. Una etapa aprobada demuestra ese recorrido y esa carga en el
hardware medido, no una capacidad máxima universal.
