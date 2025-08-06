-- Step 1: Alter the route_number column to be of type TEXT.
-- This is necessary because we want to store route numbers with a prefix (e.g., 'R101').
ALTER TABLE public.routes
ALTER COLUMN route_number TYPE TEXT;

-- Step 2: Create a sequence to generate unique numbers for routes.
-- This ensures that we don't have duplicate route numbers.
CREATE SEQUENCE IF NOT EXISTS routes_route_number_seq;

-- Step 3: Create or replace the function to get the next route number.
-- This function will be called from our application to generate a new route number.
CREATE OR REPLACE FUNCTION public.get_next_route_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'R' || nextval('routes_route_number_seq');
END;
$$ LANGUAGE plpgsql;

-- Step 4: Grant usage on the sequence to the authenticated role.
-- This is crucial for RLS (Row-Level Security) environments like Supabase.
GRANT USAGE, SELECT ON SEQUENCE routes_route_number_seq TO authenticated;

-- Step 5: Grant execute permission on the function to the authenticated role.
GRANT EXECUTE ON FUNCTION public.get_next_route_number() TO authenticated;
