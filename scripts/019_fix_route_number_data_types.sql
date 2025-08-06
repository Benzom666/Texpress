-- Fix route_number data type inconsistencies across all tables
-- This script converts route_number from integer to TEXT where needed

-- First, check and fix the routes table
DO $$ 
BEGIN
  -- Check if route_number exists and is integer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'routes' 
    AND column_name = 'route_number' 
    AND data_type = 'integer'
  ) THEN
    -- Convert integer route_number to text
    ALTER TABLE routes ALTER COLUMN route_number TYPE TEXT;
    RAISE NOTICE 'Converted routes.route_number from integer to TEXT';
  END IF;
  
  -- Ensure route_number exists as TEXT if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'routes' 
    AND column_name = 'route_number'
  ) THEN
    ALTER TABLE routes ADD COLUMN route_number TEXT UNIQUE;
    RAISE NOTICE 'Added routes.route_number as TEXT';
  END IF;
END $$;

-- Fix the orders table route_number column
DO $$ 
BEGIN
  -- Check if route_number exists and is integer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'route_number' 
    AND data_type = 'integer'
  ) THEN
    -- Convert integer route_number to text
    ALTER TABLE orders ALTER COLUMN route_number TYPE TEXT;
    RAISE NOTICE 'Converted orders.route_number from integer to TEXT';
  END IF;
  
  -- Add route_number as TEXT if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'route_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN route_number TEXT;
    RAISE NOTICE 'Added orders.route_number as TEXT';
  END IF;
END $$;

-- Update the route number generation function to return TEXT
CREATE OR REPLACE FUNCTION generate_route_number()
RETURNS TEXT AS $$
DECLARE
  date_str TEXT;
  counter INTEGER := 1;
  route_num TEXT;
  existing_count INTEGER;
BEGIN
  -- Generate date string (YYYYMMDD)
  date_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  
  -- Loop to find unique route number
  LOOP
    route_num := 'RT' || date_str || '-' || lpad(counter::TEXT, 3, '0');
    
    -- Check if this route number already exists
    SELECT COUNT(*) INTO existing_count 
    FROM routes 
    WHERE route_number = route_num;
    
    -- If not found, we can use this number
    IF existing_count = 0 THEN
      RETURN route_num;
    END IF;
    
    -- Increment counter and try again
    counter := counter + 1;
    
    -- Safety check to prevent infinite loop
    IF counter > 999 THEN
      -- Use timestamp as fallback
      route_num := 'RT' || date_str || '-' || extract(epoch from now())::TEXT;
      RETURN route_num;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update the route_number sequence to work with TEXT
DROP SEQUENCE IF EXISTS route_number_seq CASCADE;

-- Update the trigger function to use the new TEXT-based generation
CREATE OR REPLACE FUNCTION assign_route_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.route_number IS NULL OR NEW.route_number = '' THEN
    NEW.route_number := generate_route_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_assign_route_number ON routes;
CREATE TRIGGER trigger_assign_route_number
  BEFORE INSERT ON routes
  FOR EACH ROW
  EXECUTE FUNCTION assign_route_number();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_routes_route_number_text ON routes(route_number);
CREATE INDEX IF NOT EXISTS idx_orders_route_number_text ON orders(route_number);

-- Clean up any invalid route numbers (optional)
UPDATE routes SET route_number = generate_route_number() 
WHERE route_number IS NULL OR route_number = '' OR route_number ~ '^[0-9]+$';

RAISE NOTICE 'Route number data types fixed successfully';
