-- Add columns for route and stop numbering to support the new OSRM workflow.

-- Add route_number to driver_routes table
ALTER TABLE IF EXISTS driver_routes ADD COLUMN IF NOT EXISTS route_number VARCHAR(50);

-- Add stop_label to route_stops table
ALTER TABLE IF EXISTS route_stops ADD COLUMN IF NOT EXISTS stop_label VARCHAR(10);

-- Add route and stop info to orders table
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES driver_routes(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS route_number VARCHAR(50);
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS stop_number VARCHAR(10);

-- Add driver_number to user_profiles table for unique route numbering
ALTER TABLE IF EXISTS user_profiles ADD COLUMN IF NOT EXISTS driver_number VARCHAR(10);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_routes_route_number ON driver_routes(route_number);
CREATE INDEX IF NOT EXISTS idx_orders_route_info ON orders(route_number, stop_number);
