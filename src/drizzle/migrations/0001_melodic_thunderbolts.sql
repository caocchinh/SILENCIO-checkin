
-- Update any NULL values to FALSE (safety measure)
UPDATE "customer" SET "has_checked_in" = FALSE WHERE "has_checked_in" IS TRUE;
