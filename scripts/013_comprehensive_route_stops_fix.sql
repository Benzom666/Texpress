-- Comprehensive fix for route_stops table structure
-- This script will work regardless of current table state

DO $$ 
DECLARE
    table_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    -- Check if routes table exists and has required columns
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'routes') THEN
        CREATE TABLE routes (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            route_number TEXT,
            route_name TEXT,
            status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'assigned', 'in_progress', 'completed', 'cancelled')),
            total_distance DECIMAL(10,2) DEFAULT 0,
            estimated_duration INTEGER DEFAULT 0,
            total_stops INTEGER DEFAULT 0,
            created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created routes table';
    END IF;

    -- Add missing columns to routes table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'route_name') THEN
        ALTER TABLE routes ADD COLUMN route_name TEXT;
        RAISE NOTICE 'Added route_name column to routes';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'estimated_duration') THEN
        ALTER TABLE routes ADD COLUMN estimated_duration INTEGER DEFAULT 0;
        RAISE NOTICE 'Added estimated_duration column to routes';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'total_stops') THEN
        ALTER TABLE routes ADD COLUMN total_stops INTEGER DEFAULT 0;
        RAISE NOTICE 'Added total_stops column to routes';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'created_by') THEN
        ALTER TABLE routes ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added created_by column to routes';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'driver_id') THEN
        ALTER TABLE routes ADD COLUMN driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added driver_id column to routes';
    END IF;

    -- Check if route_stops table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'route_stops'
    ) INTO table_exists;

    IF NOT table_exists THEN
        -- Create the table from scratch with all required columns
        CREATE TABLE route_stops (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
            order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            stop_number INTEGER NOT NULL,
            sequence_order INTEGER NOT NULL,
            stop_label TEXT,
            address TEXT,
            latitude DECIMAL(10,8),
            longitude DECIMAL(11,8),
            estimated_time INTEGER DEFAULT 15,
            distance_from_previous DECIMAL(10,2) DEFAULT 0,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed', 'skipped', 'failed')),
            actual_arrival_time TIMESTAMPTZ,
            actual_departure_time TIMESTAMPTZ,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(route_id, stop_number),
            UNIQUE(route_id, order_id)
        );
        RAISE NOTICE 'Created route_stops table with all columns';
    ELSE
        -- Table exists, check and modify constraints
        RAISE NOTICE 'route_stops table exists, checking for missing columns and constraints...';
        
        -- Remove NOT NULL constraint from address if it exists
        BEGIN
            ALTER TABLE route_stops ALTER COLUMN address DROP NOT NULL;
            RAISE NOTICE 'Removed NOT NULL constraint from address column';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Address column constraint modification not needed or failed: %', SQLERRM;
        END;
        
        -- Add missing columns one by one
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'estimated_time') THEN
            ALTER TABLE route_stops ADD COLUMN estimated_time INTEGER DEFAULT 15;
            RAISE NOTICE 'Added estimated_time column';
        ELSE
            RAISE NOTICE 'estimated_time column already exists';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'distance_from_previous') THEN
            ALTER TABLE route_stops ADD COLUMN distance_from_previous DECIMAL(10,2) DEFAULT 0;
            RAISE NOTICE 'Added distance_from_previous column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'stop_label') THEN
            ALTER TABLE route_stops ADD COLUMN stop_label TEXT;
            RAISE NOTICE 'Added stop_label column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'address') THEN
            ALTER TABLE route_stops ADD COLUMN address TEXT;
            RAISE NOTICE 'Added address column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'latitude') THEN
            ALTER TABLE route_stops ADD COLUMN latitude DECIMAL(10,8);
            RAISE NOTICE 'Added latitude column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'longitude') THEN
            ALTER TABLE route_stops ADD COLUMN longitude DECIMAL(11,8);
            RAISE NOTICE 'Added longitude column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'sequence_order') THEN
            ALTER TABLE route_stops ADD COLUMN sequence_order INTEGER;
            RAISE NOTICE 'Added sequence_order column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'actual_arrival_time') THEN
            ALTER TABLE route_stops ADD COLUMN actual_arrival_time TIMESTAMPTZ;
            RAISE NOTICE 'Added actual_arrival_time column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'actual_departure_time') THEN
            ALTER TABLE route_stops ADD COLUMN actual_departure_time TIMESTAMPTZ;
            RAISE NOTICE 'Added actual_departure_time column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'notes') THEN
            ALTER TABLE route_stops ADD COLUMN notes TEXT;
            RAISE NOTICE 'Added notes column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'created_at') THEN
            ALTER TABLE route_stops ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
            RAISE NOTICE 'Added created_at column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'updated_at') THEN
            ALTER TABLE route_stops ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column';
        END IF;
    END IF;

    -- Add route-related columns to orders table if they don't exist
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

-- Create route number generation function
CREATE OR REPLACE FUNCTION generate_route_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
    date_prefix TEXT;
    max_attempts INTEGER := 1000;
BEGIN
    date_prefix := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    WHILE counter <= max_attempts LOOP
        new_number := 'RT' || date_prefix || '-' || LPAD(counter::TEXT, 3, '0');
        
        IF NOT EXISTS (SELECT 1 FROM routes WHERE route_number = new_number) THEN
            RETURN new_number;
        END IF;
        
        counter := counter + 1;
    END LOOP;
    
    new_number := 'RT' || date_prefix || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for route numbers
CREATE OR REPLACE FUNCTION set_route_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.route_number IS NULL OR NEW.route_number = '' THEN
        NEW.route_number := generate_route_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_route_number ON routes;
CREATE TRIGGER trigger_set_route_number
    BEFORE INSERT ON routes
    FOR EACH ROW
    EXECUTE FUNCTION set_route_number();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON route_stops(route_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);

-- Enable RLS
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Grant permissions
GRANT ALL ON route_stops TO authenticated;
GRANT EXECUTE ON FUNCTION generate_route_number() TO authenticated;

-- Show final table structure
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== Final route_stops table structure ===';
    FOR rec IN 
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'route_stops' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable: %, default: %)', rec.column_name, rec.data_type, rec.is_nullable, rec.column_default;
    END LOOP;
    
    RAISE NOTICE '=== Final routes table structure ===';
    FOR rec IN 
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'routes' 
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable: %, default: %)', rec.column_name, rec.data_type, rec.is_nullable, rec.column_default;
    END LOOP;
END $$;
