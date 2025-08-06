-- Fix route creation issues by ensuring proper constraints and functions

-- First, let's create the RPC function to get next route number
CREATE OR REPLACE FUNCTION get_next_route_number()
RETURNS INTEGER AS $$
DECLARE
    next_number INTEGER;
BEGIN
    -- Get the next value from the sequence
    SELECT nextval('route_number_seq') INTO next_number;
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Make sure the route_number column allows the trigger to set it
ALTER TABLE routes ALTER COLUMN route_number DROP NOT NULL;

-- Update the trigger function to handle route number assignment better
CREATE OR REPLACE FUNCTION assign_route_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign route number if it's not provided
  IF NEW.route_number IS NULL THEN
    NEW.route_number := nextval('route_number_seq');
  END IF;
  
  -- Ensure route_name is not null
  IF NEW.route_name IS NULL OR NEW.route_name = '' THEN
    NEW.route_name := 'Route ' || NEW.route_number;
  END IF;
  
  -- Ensure total_stops is not null
  IF NEW.total_stops IS NULL THEN
    NEW.total_stops := 0;
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

-- Add back the NOT NULL constraint after fixing the trigger
ALTER TABLE routes ALTER COLUMN route_number SET NOT NULL;

-- Ensure the sequence starts at the right number
SELECT setval('route_number_seq', COALESCE((SELECT MAX(route_number) FROM routes), 1000), true);

-- Add some helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at);
CREATE INDEX IF NOT EXISTS idx_routes_status_created_by ON routes(status, created_by);

-- Make sure RLS is properly configured for routes table
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view routes they created or are assigned to" ON routes;
DROP POLICY IF EXISTS "Users can create routes" ON routes;
DROP POLICY IF EXISTS "Users can update routes they created" ON routes;
DROP POLICY IF EXISTS "Users can delete routes they created" ON routes;

-- Create comprehensive RLS policies for routes
CREATE POLICY "Users can view routes they created or are assigned to" ON routes
  FOR SELECT USING (
    auth.uid() = created_by OR 
    auth.uid() = assigned_driver_id OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can create routes" ON routes
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin', 'driver')
    )
  );

CREATE POLICY "Users can update routes they created" ON routes
  FOR UPDATE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can delete routes they created" ON routes
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- Ensure route_stops table has proper RLS
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view route stops for their routes" ON route_stops;
DROP POLICY IF EXISTS "Users can create route stops" ON route_stops;
DROP POLICY IF EXISTS "Users can update route stops" ON route_stops;
DROP POLICY IF EXISTS "Users can delete route stops" ON route_stops;

-- Create RLS policies for route_stops
CREATE POLICY "Users can view route stops for their routes" ON route_stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM routes 
      WHERE routes.id = route_stops.route_id 
      AND (
        routes.created_by = auth.uid() OR 
        routes.assigned_driver_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Users can create route stops" ON route_stops
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM routes 
      WHERE routes.id = route_stops.route_id 
      AND (
        routes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Users can update route stops" ON route_stops
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM routes 
      WHERE routes.id = route_stops.route_id 
      AND (
        routes.created_by = auth.uid() OR 
        routes.assigned_driver_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Users can delete route stops" ON route_stops
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM routes 
      WHERE routes.id = route_stops.route_id 
      AND (
        routes.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_profiles.id = auth.uid() 
          AND user_profiles.role IN ('admin', 'super_admin')
        )
      )
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SEQUENCE route_number_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON route_stops TO authenticated;
