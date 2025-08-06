-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS route_stops CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP SEQUENCE IF EXISTS route_number_seq CASCADE;

-- Create sequence for route numbers
CREATE SEQUENCE route_number_seq START 1001;

-- Create routes table with exact columns the app expects
CREATE TABLE routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_number TEXT UNIQUE NOT NULL DEFAULT ('R' || LPAD(nextval('route_number_seq')::TEXT, 4, '0')),
  route_name TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'assigned', 'in_progress', 'completed', 'cancelled')),
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_stops INTEGER DEFAULT 0,
  total_distance DECIMAL(10,2) DEFAULT 0,
  total_time INTEGER DEFAULT 0,
  estimated_duration INTEGER DEFAULT 0,
  actual_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create route_stops table
CREATE TABLE route_stops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  stop_number INTEGER NOT NULL,
  sequence_order INTEGER NOT NULL,
  stop_label TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  estimated_time INTEGER DEFAULT 15,
  distance_from_previous DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed', 'skipped', 'failed')),
  actual_arrival_time TIMESTAMP WITH TIME ZONE,
  actual_departure_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, stop_number),
  UNIQUE(route_id, order_id)
);

-- Add route-related columns to orders table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'route_id') THEN
    ALTER TABLE orders ADD COLUMN route_id UUID REFERENCES routes(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'route_number') THEN
    ALTER TABLE orders ADD COLUMN route_number TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'stop_number') THEN
    ALTER TABLE orders ADD COLUMN stop_number INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assigned_driver_id') THEN
    ALTER TABLE orders ADD COLUMN assigned_driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_number ON route_stops(route_id, stop_number);
CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);

-- Create function to auto-update route totals
CREATE OR REPLACE FUNCTION update_route_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes 
  SET 
    total_stops = (SELECT COUNT(*) FROM route_stops WHERE route_id = COALESCE(NEW.route_id, OLD.route_id)),
    total_distance = (SELECT COALESCE(SUM(distance_from_previous), 0) FROM route_stops WHERE route_id = COALESCE(NEW.route_id, OLD.route_id)),
    total_time = (SELECT COALESCE(SUM(estimated_time), 0) FROM route_stops WHERE route_id = COALESCE(NEW.route_id, OLD.route_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.route_id, OLD.route_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_route_totals_insert ON route_stops;
CREATE TRIGGER trigger_update_route_totals_insert
  AFTER INSERT ON route_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_route_totals();

DROP TRIGGER IF EXISTS trigger_update_route_totals_update ON route_stops;
CREATE TRIGGER trigger_update_route_totals_update
  AFTER UPDATE ON route_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_route_totals();

DROP TRIGGER IF EXISTS trigger_update_route_totals_delete ON route_stops;
CREATE TRIGGER trigger_update_route_totals_delete
  AFTER DELETE ON route_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_route_totals();

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- RLS policies for routes
CREATE POLICY "Users can view routes they created or are assigned to" ON routes
  FOR SELECT USING (
    auth.uid() = created_by OR 
    auth.uid() = driver_id OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can create routes" ON routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins and assigned drivers can update routes" ON routes
  FOR UPDATE USING (
    auth.uid() = created_by OR 
    auth.uid() = driver_id OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete routes" ON routes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS policies for route_stops
CREATE POLICY "Users can view route stops for routes they have access to" ON route_stops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM routes 
      WHERE routes.id = route_stops.route_id 
      AND (
        routes.created_by = auth.uid() OR 
        routes.driver_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Admins can manage route stops" ON route_stops
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Grant permissions
GRANT USAGE ON SEQUENCE route_number_seq TO authenticated;
GRANT ALL ON routes TO authenticated;
GRANT ALL ON route_stops TO authenticated;
