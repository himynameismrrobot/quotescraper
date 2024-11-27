-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."quote_staging";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."quote_staging";
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON "public"."quote_staging";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."quotes";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."quotes";
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON "public"."quotes";

-- Create separate policies for each operation on quote_staging table
CREATE POLICY "Enable insert for service role" ON "public"."quote_staging"
FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Enable select for service role" ON "public"."quote_staging"
FOR SELECT TO service_role
USING (true);

CREATE POLICY "Enable update for service role" ON "public"."quote_staging"
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for service role" ON "public"."quote_staging"
FOR DELETE TO service_role
USING (true);

-- Create separate policies for each operation on quotes table
CREATE POLICY "Enable insert for service role" ON "public"."quotes"
FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Enable select for service role" ON "public"."quotes"
FOR SELECT TO service_role
USING (true);

CREATE POLICY "Enable update for service role" ON "public"."quotes"
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for service role" ON "public"."quotes"
FOR DELETE TO service_role
USING (true);

-- Ensure RLS is enabled on both tables
ALTER TABLE "public"."quote_staging" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;
