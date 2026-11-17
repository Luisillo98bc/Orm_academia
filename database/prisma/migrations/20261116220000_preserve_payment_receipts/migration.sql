-- Preserve the price agreed before monthly plans existed. Never infer a debt
-- for an existing enrollment from the current duration of its cohort.
UPDATE payments p
SET total_installments = 1, next_due_date = NULL
WHERE p.created_at < (
  SELECT started_at FROM _prisma_migrations
  WHERE migration_name = '20261114200000_add_monthly_installments'
    AND finished_at IS NOT NULL AND rolled_back_at IS NULL
  ORDER BY started_at LIMIT 1
)
AND p.installment_number = 1
AND (p.installment_history IS NULL OR p.installment_history = 'null'::jsonb);

-- This read-only view exposes each actual receipt once, including receipts
-- whose payment is now waiting for the next installment. Original data stays intact.
CREATE VIEW payment_receipts AS
WITH history AS (
  SELECT DISTINCT ON (p.id, (item->>'installmentNumber')::integer)
    p.id AS payment_id,
    (item->>'installmentNumber')::integer AS installment_number,
    (item->>'amount')::numeric(12,2) AS amount,
    COALESCE(item->>'method', p.method::text) AS method,
    COALESCE((item->>'validatedAt')::timestamptz AT TIME ZONE 'UTC', p.validated_at, p.created_at) AS paid_at,
    item->>'voucherUrl' AS voucher_url
  FROM payments p
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.installment_history) = 'array'
      THEN p.installment_history ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS entries(item, position)
  WHERE item->>'status' = 'COMPLETED'
  ORDER BY p.id, (item->>'installmentNumber')::integer, position DESC
)
SELECT * FROM history
UNION ALL
SELECT p.id, p.installment_number, p.amount, p.method::text,
       COALESCE(p.validated_at, p.created_at), p.voucher_url
FROM payments p
WHERE p.status = 'COMPLETED'
AND NOT EXISTS (
  SELECT 1 FROM history h
  WHERE h.payment_id = p.id AND h.installment_number = p.installment_number
);
ALTER TABLE users ALTER COLUMN two_factor_secret TYPE VARCHAR(255);

