-- Fix routes table schema and add missing columns
-- This script ensures the routes table has all necessary columns and constraints

-- First, let's check if the routes table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_number VARCHAR(50),
    route_name VARCHAR(255) NOT NULL,
    driver_id UUID REFERENCES auth.users(id),
    assigned_driver_id UUID REFERENCES auth.users(id),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'planned', 'assigned', 'in_progress')),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_distance DECIMAL(10,2) DEFAULT 0,
    estimated_duration INTEGER DEFAULT 0,
    total_stops INTEGER DEFAULT 0
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add route_number column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'route_number') THEN
        ALTER TABLE routes ADD COLUMN route_number VARCHAR(50);
    END IF;
    
    -- Add assigned_driver_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'assigned_driver_id') THEN
        ALTER TABLE routes ADD COLUMN assigned_driver_id UUID REFERENCES auth.users(id);
    END IF;
    
    -- Add total_distance column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'total_distance') THEN
        ALTER TABLE routes ADD COLUMN total_distance DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add estimated_duration column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'estimated_duration') THEN
        ALTER TABLE routes ADD COLUMN estimated_duration INTEGER DEFAULT 0;
    END IF;
    
    -- Add total_stops column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'total_stops') THEN
        ALTER TABLE routes ADD COLUMN total_stops INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create route_stops table if it doesn't exist
CREATE TABLE IF NOT EXISTS route_stops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stop_number INTEGER NOT NULL,
    stop_label VARCHAR(255),
    distance_from_previous DECIMAL(10,2) DEFAULT 0,
    duration_from_previous INTEGER DEFAULT 0,
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    actual_departure TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed', 'skipped', 'failed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(route_id, stop_number),
    UNIQUE(route_id, order_id)
);

-- Create function to auto-generate route numbers
CREATE OR REPLACE FUNCTION generate_route_number()
RETURNS TRIGGER AS $$
DECLARE
    next_number INTEGER;
    new_route_number VARCHAR(50);
BEGIN
    -- Get the next route number for this user
    SELECT COALESCE(MAX(CAST(SUBSTRING(route_number FROM 2) AS INTEGER)), 0) + 1
    INTO next_number
    FROM routes 
    WHERE created_by = NEW.created_by 
    AND route_number ~ '^R[0-9]+$';
    
    -- Generate the route number
    new_route_number := 'R' || LPAD(next_number::TEXT, 3, '0');
    
    -- Set the route number
    NEW.route_number := new_route_number;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating route numbers
DROP TRIGGER IF EXISTS trigger_generate_route_number ON routes;
CREATE TRIGGER trigger_generate_route_number
    BEFORE INSERT ON routes
    FOR EACH ROW
    WHEN (NEW.route_number IS NULL)
    EXECUTE FUNCTION generate_route_number();

-- Create function to update total_stops when route_stops change
CREATE OR REPLACE FUNCTION update_route_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update total_stops count
    UPDATE routes 
    SET total_stops = (
        SELECT COUNT(*) 
        FROM route_stops 
        WHERE route_id = COALESCE(NEW.route_id, OLD.route_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.route_id, OLD.route_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating route totals
DROP TRIGGER IF EXISTS trigger_update_route_totals_insert ON route_stops;
CREATE TRIGGER trigger_update_route_totals_insert
    AFTER INSERT ON route_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_route_totals();

DROP TRIGGER IF EXISTS trigger_update_route_totals_delete ON route_stops;
CREATE TRIGGER trigger_update_route_totals_delete
    AFTER DELETE ON route_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_route_totals();

-- Create geocoding cache table for performance
CREATE TABLE IF NOT EXISTS geocoding_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    formatted_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_assigned_driver ON routes(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_number ON route_stops(route_id, stop_number);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_address ON geocoding_cache(address);

-- Enable RLS on routes table
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for routes
DROP POLICY IF EXISTS "Users can view their own routes" ON routes;
CREATE POLICY "Users can view their own routes" ON routes
    FOR SELECT USING (
        created_by = auth.uid() OR 
        assigned_driver_id = auth.uid() OR
        driver_id = auth.uid()
    );

DROP POLICY IF EXISTS "Users can create routes" ON routes;
CREATE POLICY "Users can create routes" ON routes
    FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own routes" ON routes;
CREATE POLICY "Users can update their own routes" ON routes
    FOR UPDATE USING (
        created_by = auth.uid() OR 
        assigned_driver_id = auth.uid() OR
        driver_id = auth.uid()
    );

DROP POLICY IF EXISTS "Users can delete their own routes" ON routes;
CREATE POLICY "Users can delete their own routes" ON routes
    FOR DELETE USING (created_by = auth.uid());

-- Enable RLS on route_stops table
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for route_stops
DROP POLICY IF EXISTS "Users can view route stops for their routes" ON route_stops;
CREATE POLICY "Users can view route stops for their routes" ON route_stops
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_stops.route_id 
            AND (
                routes.created_by = auth.uid() OR 
                routes.assigned_driver_id = auth.uid() OR
                routes.driver_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can create route stops for their routes" ON route_stops;
CREATE POLICY "Users can create route stops for their routes" ON route_stops
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_stops.route_id 
            AND routes.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update route stops for their routes" ON route_stops;
CREATE POLICY "Users can update route stops for their routes" ON route_stops
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_stops.route_id 
            AND (
                routes.created_by = auth.uid() OR 
                routes.assigned_driver_id = auth.uid() OR
                routes.driver_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete route stops for their routes" ON route_stops;
CREATE POLICY "Users can delete route stops for their routes" ON route_stops
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_stops.route_id 
            AND routes.created_by = auth.uid()
        )
    );

-- Enable RLS on geocoding_cache table
ALTER TABLE geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for geocoding_cache (allow all authenticated users to read/write)
DROP POLICY IF EXISTS "Authenticated users can access geocoding cache" ON geocoding_cache;
CREATE POLICY "Authenticated users can access geocoding cache" ON geocoding_cache
    FOR ALL USING (auth.role() = 'authenticated');

-- Update existing routes to have proper total_stops count
UPDATE routes 
SET total_stops = (
    SELECT COUNT(*) 
    FROM route_stops 
    WHERE route_id = routes.id
)
WHERE total_stops IS NULL OR total_stops = 0;

-- Add route_id column to orders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'route_id') THEN
        ALTER TABLE orders ADD COLUMN route_id UUID REFERENCES routes(id);
    END IF;
END $$;

-- Create index for orders route_id
CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);
