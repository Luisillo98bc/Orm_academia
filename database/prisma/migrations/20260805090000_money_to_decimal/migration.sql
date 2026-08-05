-- Convert monetary IEEE-754 columns to exact fixed-point values.
-- Existing values are rounded once to the new two-decimal business scale.
ALTER TABLE "cohorts"
  ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2),
  ALTER COLUMN "price" SET DEFAULT 0;

ALTER TABLE "payments"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "workers"
  ALTER COLUMN "base_salary" TYPE DECIMAL(12,2) USING ROUND("base_salary"::numeric, 2);

ALTER TABLE "contracts"
  ALTER COLUMN "agreed_salary" TYPE DECIMAL(12,2) USING ROUND("agreed_salary"::numeric, 2);

ALTER TABLE "payrolls"
  ALTER COLUMN "base_salary" TYPE DECIMAL(12,2) USING ROUND("base_salary"::numeric, 2),
  ALTER COLUMN "bonuses" TYPE DECIMAL(12,2) USING ROUND("bonuses"::numeric, 2),
  ALTER COLUMN "bonuses" SET DEFAULT 0,
  ALTER COLUMN "deductions" TYPE DECIMAL(12,2) USING ROUND("deductions"::numeric, 2),
  ALTER COLUMN "deductions" SET DEFAULT 0,
  ALTER COLUMN "total_amount" TYPE DECIMAL(12,2) USING ROUND("total_amount"::numeric, 2);

ALTER TABLE "cohorts"
  ADD CONSTRAINT "cohorts_price_nonnegative" CHECK ("price" >= 0);
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_nonnegative" CHECK ("amount" >= 0);
ALTER TABLE "workers"
  ADD CONSTRAINT "workers_base_salary_nonnegative" CHECK ("base_salary" >= 0);
ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_agreed_salary_nonnegative" CHECK ("agreed_salary" >= 0);
ALTER TABLE "payrolls"
  ADD CONSTRAINT "payrolls_amounts_nonnegative" CHECK (
    "base_salary" >= 0 AND "bonuses" >= 0 AND
    "deductions" >= 0 AND "total_amount" >= 0
  );
