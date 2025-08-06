-- First, let's check and fix the routes table structure
DO $$ 
BEGIN
    -- Make route_number nullable temporarily if it has NOT NULL constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'route_number' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE routes ALTER COLUMN route_number DROP NOT NULL;
        RAISE NOTICE 'Removed NOT NULL constraint from route_number';
    END IF;
    
    -- Add missing columns to routes table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'route_name') THEN
        ALTER TABLE routes ADD COLUMN route_name TEXT;
        RAISE NOTICE 'Added route_name column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'estimated_duration') THEN
        ALTER TABLE routes ADD COLUMN estimated_duration INTEGER DEFAULT 0;
        RAISE NOTICE 'Added estimated_duration column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'total_stops') THEN
        ALTER TABLE routes ADD COLUMN total_stops INTEGER DEFAULT 0;
        RAISE NOTICE 'Added total_stops column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'created_by') THEN
        ALTER TABLE routes ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added created_by column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'driver_id') THEN
        ALTER TABLE routes ADD COLUMN driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added driver_id column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'started_at') THEN
        ALTER TABLE routes ADD COLUMN started_at TIMESTAMPTZ;
        RAISE NOTICE 'Added started_at column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'routes' AND column_name = 'completed_at') THEN
        ALTER TABLE routes ADD COLUMN completed_at TIMESTAMPTZ;
        RAISE NOTICE 'Added completed_at column';
    END IF;
END $$;

-- Create route_stops table if it doesn't exist, or add missing columns
DO $$
BEGIN
    -- Create the table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'route_stops') THEN
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
        RAISE NOTICE 'Created route_stops table';
    ELSE
        -- Add missing columns to existing table
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'estimated_time') THEN
            ALTER TABLE route_stops ADD COLUMN estimated_time INTEGER DEFAULT 15;
            RAISE NOTICE 'Added estimated_time column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'distance_from_previous') THEN
            ALTER TABLE route_stops ADD COLUMN distance_from_previous DECIMAL(10,2) DEFAULT 0;
            RAISE NOTICE 'Added distance_from_previous column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'stop_label') THEN
            ALTER TABLE route_stops ADD COLUMN stop_label TEXT;
            RAISE NOTICE 'Added stop_label column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'latitude') THEN
            ALTER TABLE route_stops ADD COLUMN latitude DECIMAL(10,8);
            RAISE NOTICE 'Added latitude column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'longitude') THEN
            ALTER TABLE route_stops ADD COLUMN longitude DECIMAL(11,8);
            RAISE NOTICE 'Added longitude column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'sequence_order') THEN
            ALTER TABLE route_stops ADD COLUMN sequence_order INTEGER;
            RAISE NOTICE 'Added sequence_order column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'actual_arrival_time') THEN
            ALTER TABLE route_stops ADD COLUMN actual_arrival_time TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE 'Added actual_arrival_time column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'actual_departure_time') THEN
            ALTER TABLE route_stops ADD COLUMN actual_departure_time TIMESTAMP WITH TIME ZONE;
            RAISE NOTICE 'Added actual_departure_time column to route_stops';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'notes') THEN
            ALTER TABLE route_stops ADD COLUMN notes TEXT;
            RAISE NOTICE 'Added notes column to route_stops';
        END IF;
    END IF;
END $$;

-- Add route-related columns to orders table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'route_id') THEN
        ALTER TABLE orders ADD COLUMN route_id UUID REFERENCES routes(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added route_id column to orders';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'route_number') THEN
        ALTER TABLE orders ADD COLUMN route_number TEXT;
        RAISE NOTICE 'Added route_number column to orders';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'stop_number') THEN
        ALTER TABLE orders ADD COLUMN stop_number INTEGER;
        RAISE NOTICE 'Added stop_number column to orders';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assigned_driver_id') THEN
        ALTER TABLE orders ADD COLUMN assigned_driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added assigned_driver_id column to orders';
    END IF;
END $$;

-- Create a robust function to generate route numbers
CREATE OR REPLACE FUNCTION generate_route_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
    date_prefix TEXT;
    max_attempts INTEGER := 1000;
BEGIN
    -- Generate date prefix (YYYYMMDD)
    date_prefix := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    -- Loop until we find an unused route number
    WHILE counter <= max_attempts LOOP
        new_number := 'RT' || date_prefix || '-' || LPAD(counter::TEXT, 3, '0');
        
        -- Check if this route number already exists
        IF NOT EXISTS (SELECT 1 FROM routes WHERE route_number = new_number) THEN
            RETURN new_number;
        END IF;
        
        counter := counter + 1;
    END LOOP;
    
    -- If we've exhausted normal attempts, use timestamp
    new_number := 'RT' || date_prefix || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to auto-generate route numbers
CREATE OR REPLACE FUNCTION set_route_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set route_number if it's NULL or empty
    IF NEW.route_number IS NULL OR NEW.route_number = '' THEN
        NEW.route_number := generate_route_number();
        RAISE NOTICE 'Auto-generated route number: %', NEW.route_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and recreate it
DROP TRIGGER IF EXISTS trigger_set_route_number ON routes;
CREATE TRIGGER trigger_set_route_number
    BEFORE INSERT ON routes
    FOR EACH ROW
    EXECUTE FUNCTION set_route_number();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON route_stops(route_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);

-- Enable RLS on route_stops
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for route_stops
DROP POLICY IF EXISTS "route_stops_select_policy" ON route_stops;
CREATE POLICY "route_stops_select_policy" ON route_stops
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

DROP POLICY IF EXISTS "route_stops_modify_policy" ON route_stops;
CREATE POLICY "route_stops_modify_policy" ON route_stops
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Grant necessary permissions
GRANT ALL ON route_stops TO authenticated;
GRANT EXECUTE ON FUNCTION generate_route_number() TO authenticated;

-- Test the function
DO $$
DECLARE
    test_number TEXT;
BEGIN
    test_number := generate_route_number();
    RAISE NOTICE 'Test route number generated: %', test_number;
END $$;

-- Show current table structure for debugging
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Current route_stops table columns:';
    FOR rec IN 
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'route_stops' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable: %)', rec.column_name, rec.data_type, rec.is_nullable;
    END LOOP;
END $$;
