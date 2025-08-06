-- Create routes table for permanent route storage
CREATE TABLE IF NOT EXISTS routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_number INTEGER UNIQUE NOT NULL,
  route_name TEXT,
  assigned_driver_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'optimized', 'assigned', 'in_progress', 'completed', 'cancelled')),
  total_stops INTEGER DEFAULT 0,
  total_distance DECIMAL(10,2),
  estimated_duration INTEGER, -- in minutes
  actual_duration INTEGER, -- in minutes
  start_location JSONB,
  end_location JSONB,
  optimization_settings JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create route_stops table for individual stops in a route
CREATE TABLE IF NOT EXISTS route_stops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  stop_number INTEGER NOT NULL,
  stop_label TEXT,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  estimated_departure TIMESTAMP WITH TIME ZONE,
  actual_departure TIMESTAMP WITH TIME ZONE,
  distance_from_previous DECIMAL(10,2), -- in km
  duration_from_previous INTEGER, -- in minutes
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed', 'skipped', 'failed')),
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
    ALTER TABLE orders ADD COLUMN route_id UUID REFERENCES routes(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'stop_number') THEN
    ALTER TABLE orders ADD COLUMN stop_number INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assigned_driver_id') THEN
    ALTER TABLE orders ADD COLUMN assigned_driver_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
CREATE INDEX IF NOT EXISTS idx_routes_assigned_driver ON routes(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_number ON route_stops(route_id, stop_number);
CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON orders(assigned_driver_id);

-- Create sequence for route numbers
CREATE SEQUENCE IF NOT EXISTS route_number_seq START 1001;

-- Create function to auto-assign route numbers
CREATE OR REPLACE FUNCTION assign_route_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.route_number IS NULL THEN
    NEW.route_number := nextval('route_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-assigning route numbers
DROP TRIGGER IF EXISTS trigger_assign_route_number ON routes;
CREATE TRIGGER trigger_assign_route_number
  BEFORE INSERT ON routes
  FOR EACH ROW
  EXECUTE FUNCTION assign_route_number();

-- Update timestamp trigger for routes
CREATE OR REPLACE FUNCTION update_routes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_routes_updated_at ON routes;
CREATE TRIGGER trigger_update_routes_updated_at
  BEFORE UPDATE ON routes
  FOR EACH ROW
  EXECUTE FUNCTION update_routes_updated_at();

-- Update timestamp trigger for route_stops
CREATE OR REPLACE FUNCTION update_route_stops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_route_stops_updated_at ON route_stops;
CREATE TRIGGER trigger_update_route_stops_updated_at
  BEFORE UPDATE ON route_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_route_stops_updated_at();
