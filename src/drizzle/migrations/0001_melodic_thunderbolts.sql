
-- Update any NULL values to FALSE (safety measure)
UPDATE "customer" SET "has_checked_in" = FALSE WHERE "has_checked_in" IS NULL;

-- Make the column NOT NULL
ALTER TABLE "customer" ALTER COLUMN "has_checked_in" SET NOT NULL;