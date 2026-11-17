$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $workspace "docker-compose.yml"
$container = docker compose -f $composeFile ps -q db
if (-not $container) { throw "PostgreSQL no está en ejecución" }

$query = @"
SELECT 'materials' AS table_name, COUNT(*) AS legacy_count FROM materials WHERE file_url LIKE '/uploads/%'
UNION ALL
SELECT 'payments' AS table_name, COUNT(*) AS legacy_count FROM payments WHERE voucher_url LIKE '/uploads/%'
UNION ALL
SELECT 'deliverables' AS table_name, COUNT(*) AS legacy_count FROM deliverables WHERE file_url LIKE '/uploads/%'
UNION ALL
SELECT 'submission_revisions', COUNT(*) FROM submission_revisions WHERE file_url LIKE '/uploads/%'
UNION ALL
SELECT 'payment_history', COUNT(*) FROM payments p
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.installment_history) = 'array' THEN p.installment_history ELSE '[]'::jsonb END) receipt
WHERE receipt->>'voucherUrl' LIKE '/uploads/%';
"@

Write-Output "Referencias privadas legacy encontradas:"
docker exec -i $container psql -U postgres -d academia_virtual -F '|' -Atc $query
Write-Output "Las imágenes de cursos, cohortes y perfiles no se incluyen porque son recursos públicos."
