-- Add missing columns to routes table if they don't exist
DO $$ 
BEGIN
    -- Add estimated_duration column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'estimated_duration') THEN
        ALTER TABLE routes ADD COLUMN estimated_duration INTEGER DEFAULT 0;
    END IF;
    
    -- Add total_driving_time column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'total_driving_time') THEN
        ALTER TABLE routes ADD COLUMN total_driving_time INTEGER DEFAULT 0;
    END IF;
    
    -- Add total_service_time column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'total_service_time') THEN
        ALTER TABLE routes ADD COLUMN total_service_time INTEGER DEFAULT 0;
    END IF;
    
    -- Add started_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'started_at') THEN
        ALTER TABLE routes ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
    
    -- Add completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'completed_at') THEN
        ALTER TABLE routes ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
    
    -- Ensure route_number has a default value or is nullable
    -- Check if route_number column exists and is not nullable
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'routes' AND column_name = 'route_number' AND is_nullable = 'NO') THEN
        -- Make route_number nullable temporarily or add a default
        ALTER TABLE routes ALTER COLUMN route_number DROP NOT NULL;
    END IF;
END $$;

-- Create route_stops table with correct column names
CREATE TABLE IF NOT EXISTS route_stops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    stop_number INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL,
    stop_label TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    estimated_duration INTEGER DEFAULT 15, -- Use estimated_duration instead of estimated_time
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

-- Add estimated_duration column to route_stops if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_stops' AND column_name = 'estimated_duration') THEN
        ALTER TABLE route_stops ADD COLUMN estimated_duration INTEGER DEFAULT 15;
    END IF;
END $$;

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

-- Create a function to generate route numbers if it doesn't exist
CREATE OR REPLACE FUNCTION generate_route_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
    date_prefix TEXT;
BEGIN
    -- Generate date prefix (YYYYMMDD)
    date_prefix := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    -- Loop until we find an unused route number
    LOOP
        new_number := 'RT' || date_prefix || '-' || LPAD(counter::TEXT, 3, '0');
        
        -- Check if this route number already exists
        IF NOT EXISTS (SELECT 1 FROM routes WHERE route_number = new_number) THEN
            EXIT;
        END IF;
        
        counter := counter + 1;
        
        -- Safety check to prevent infinite loop
        IF counter > 999 THEN
            new_number := 'RT' || date_prefix || '-' || LPAD(counter::TEXT, 4, '0');
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-generate route numbers if needed
CREATE OR REPLACE FUNCTION set_route_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.route_number IS NULL OR NEW.route_number = '' THEN
        NEW.route_number := generate_route_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_set_route_number ON routes;
CREATE TRIGGER trigger_set_route_number
    BEFORE INSERT ON routes
    FOR EACH ROW
    EXECUTE FUNCTION set_route_number();

-- Create indexes if they don't exist
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
        estimated_duration = (SELECT COALESCE(SUM(estimated_duration), 0) FROM route_stops WHERE route_id = COALESCE(NEW.route_id, OLD.route_id)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.route_id, OLD.route_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers if they don't exist
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

-- Enable RLS on route_stops if not already enabled
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for route_stops if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'route_stops' AND policyname = 'Users can view route stops for routes they have access to') THEN
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
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'route_stops' AND policyname = 'Admins can manage route stops') THEN
        CREATE POLICY "Admins can manage route stops" ON route_stops
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM user_profiles 
                    WHERE user_id = auth.uid() 
                    AND role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON route_stops TO authenticated;
