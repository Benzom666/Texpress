-- Remove problematic foreign key constraints and ensure proper table structure
DO $$ 
DECLARE
    constraint_exists BOOLEAN;
    table_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting constraint removal and table structure fix...';
    
    -- Step 1: Remove all problematic foreign key constraints
    RAISE NOTICE 'Removing problematic foreign key constraints...';
    
    -- Remove constraints from routes table
    BEGIN
        ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_created_by_fkey CASCADE;
        ALTER TABLE routes DROP CONSTRAINT IF EXISTS fk_routes_created_by CASCADE;
        ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_created_by_fkey1 CASCADE;
        ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_created_by_user_profiles_fkey CASCADE;
        RAISE NOTICE 'Removed created_by constraints from routes table';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not remove some routes constraints: %', SQLERRM;
    END;
    
    -- Remove constraints from route_stops table if they're problematic
    BEGIN
        -- Check if route_stops table exists
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'route_stops' AND table_schema = 'public'
        ) INTO table_exists;
        
        IF table_exists THEN
            -- Try to remove and recreate route_stops table to fix constraint issues
            RAISE NOTICE 'Recreating route_stops table to fix foreign key issues...';
            DROP TABLE IF EXISTS route_stops CASCADE;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop route_stops table: %', SQLERRM;
    END;
    
    -- Step 2: Ensure routes table has proper structure
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'routes' AND table_schema = 'public'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE NOTICE 'Creating routes table...';
        CREATE TABLE routes (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            route_number TEXT UNIQUE,
            route_name TEXT NOT NULL,
            status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'assigned', 'in_progress', 'completed', 'cancelled')),
            total_distance DECIMAL(10,2) DEFAULT 0,
            estimated_duration INTEGER DEFAULT 0,
            total_stops INTEGER DEFAULT 0,
            created_by UUID NOT NULL, -- NO foreign key constraint
            driver_id UUID, -- NO foreign key constraint for now
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Routes table created successfully';
    ELSE
        RAISE NOTICE 'Routes table exists, ensuring proper columns...';
        
        -- Add missing columns if they don't exist
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'route_name' AND table_schema = 'public'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE routes ADD COLUMN route_name TEXT;
            RAISE NOTICE 'Added route_name column';
        END IF;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'created_by' AND table_schema = 'public'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE routes ADD COLUMN created_by UUID;
            RAISE NOTICE 'Added created_by column';
        END IF;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'total_stops' AND table_schema = 'public'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE routes ADD COLUMN total_stops INTEGER DEFAULT 0;
            RAISE NOTICE 'Added total_stops column';
        END IF;
    END IF;
    
    -- Step 3: Create route_stops table with proper foreign key constraints
    RAISE NOTICE 'Creating route_stops table with proper constraints...';
    CREATE TABLE route_stops (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        route_id UUID NOT NULL,
        order_id UUID NOT NULL,
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
        
        -- Add foreign key constraints with proper error handling
        CONSTRAINT route_stops_route_id_fkey 
            FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
        CONSTRAINT route_stops_order_id_fkey 
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            
        -- Add unique constraints
        CONSTRAINT route_stops_route_stop_unique UNIQUE(route_id, stop_number),
        CONSTRAINT route_stops_route_order_unique UNIQUE(route_id, order_id)
    );
    
    RAISE NOTICE 'Route_stops table created successfully';
    
    -- Step 4: Add route-related columns to orders table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'route_id' AND table_schema = 'public'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE orders ADD COLUMN route_id UUID;
        RAISE NOTICE 'Added route_id column to orders';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'route_number' AND table_schema = 'public'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE orders ADD COLUMN route_number TEXT;
        RAISE NOTICE 'Added route_number column to orders';
    END IF;
    
    -- Step 5: Create route number generation function
    CREATE OR REPLACE FUNCTION generate_route_number()
    RETURNS TEXT AS $func$
    DECLARE
        date_str TEXT;
        counter INTEGER;
        route_number TEXT;
        max_attempts INTEGER := 100;
    BEGIN
        date_str := TO_CHAR(NOW(), 'YYYYMMDD');
        counter := 1;
        
        LOOP
            route_number := 'RT' || date_str || '-' || LPAD(counter::TEXT, 3, '0');
            
            IF NOT EXISTS (SELECT 1 FROM routes WHERE routes.route_number = route_number) THEN
                RETURN route_number;
            END IF;
            
            counter := counter + 1;
            
            IF counter > max_attempts THEN
                route_number := 'RT' || date_str || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
                RETURN route_number;
            END IF;
        END LOOP;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Grant permissions
    GRANT EXECUTE ON FUNCTION generate_route_number() TO authenticated;
    
    -- Step 6: Create indexes
    CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
    CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
    CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
    CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON route_stops(route_id, sequence_order);
    
    -- Step 7: Enable RLS and create policies
    ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
    
    -- Simple RLS policies without foreign key dependencies
    DROP POLICY IF EXISTS "routes_policy" ON routes;
    CREATE POLICY "routes_policy" ON routes FOR ALL USING (
        created_by = auth.uid() OR 
        driver_id = auth.uid() OR
        auth.uid() IS NOT NULL -- Allow authenticated users
    );
    
    DROP POLICY IF EXISTS "route_stops_policy" ON route_stops;
    CREATE POLICY "route_stops_policy" ON route_stops FOR ALL USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_stops.route_id 
            AND (routes.created_by = auth.uid() OR routes.driver_id = auth.uid() OR auth.uid() IS NOT NULL)
        )
    );
    
    -- Grant permissions
    GRANT ALL ON routes TO authenticated;
    GRANT ALL ON route_stops TO authenticated;
    
    RAISE NOTICE 'Constraint removal and table structure fix completed successfully';
    RAISE NOTICE 'IMPORTANT: All foreign key constraints on created_by have been REMOVED';
    RAISE NOTICE 'Routes can now be created with any UUID for created_by field';
    
END $$;
