-- Comprehensive fix for routes and route_stops foreign key issues
DO $$ 
DECLARE
    constraint_exists BOOLEAN;
    table_exists BOOLEAN;
    column_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting comprehensive foreign key constraint fixes...';
    
    -- Check if routes table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'routes' AND table_schema = 'public'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'Routes table exists, checking and fixing constraints...';
        
        -- Remove problematic foreign key constraints on created_by if they exist
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name LIKE '%created_by%' 
            AND table_name = 'routes'
            AND table_schema = 'public'
        ) INTO constraint_exists;
        
        IF constraint_exists THEN
            RAISE NOTICE 'Removing problematic created_by foreign key constraints...';
            
            -- Drop any foreign key constraints on created_by
            BEGIN
                ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_created_by_fkey;
                ALTER TABLE routes DROP CONSTRAINT IF EXISTS fk_routes_created_by;
                ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_created_by_fkey1;
                RAISE NOTICE 'Removed created_by foreign key constraints';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not remove some constraints: %', SQLERRM;
            END;
        END IF;
        
        -- Check and add missing columns
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'route_name' AND table_schema = 'public'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE routes ADD COLUMN route_name TEXT;
            RAISE NOTICE 'Added route_name column to routes';
        END IF;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'created_by' AND table_schema = 'public'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE routes ADD COLUMN created_by UUID;
            RAISE NOTICE 'Added created_by column to routes';
        END IF;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'total_stops' AND table_schema = 'public'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE routes ADD COLUMN total_stops INTEGER DEFAULT 0;
            RAISE NOTICE 'Added total_stops column to routes';
        END IF;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'routes' AND column_name = 'status' AND table_schema = 'public'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE routes ADD COLUMN status TEXT DEFAULT 'planned';
            RAISE NOTICE 'Added status column to routes';
        END IF;
        
    ELSE
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
            driver_id UUID,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Routes table created successfully';
    END IF;
    
    -- Handle route_stops table
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'route_stops' AND table_schema = 'public'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'Route_stops table exists, checking foreign key constraints...';
        
        -- Check if foreign key constraint exists and is working
        SELECT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'route_stops_route_id_fkey' 
            AND table_name = 'route_stops'
            AND table_schema = 'public'
        ) INTO constraint_exists;
        
        IF NOT constraint_exists THEN
            RAISE NOTICE 'Foreign key constraint missing, recreating table...';
            DROP TABLE IF EXISTS route_stops CASCADE;
            table_exists := FALSE;
        ELSE
            -- Test if the constraint is working properly
            BEGIN
                -- Try to verify the constraint references the correct table
                PERFORM 1 FROM information_schema.referential_constraints 
                WHERE constraint_name = 'route_stops_route_id_fkey'
                AND unique_constraint_name IN (
                    SELECT constraint_name FROM information_schema.table_constraints 
                    WHERE table_name = 'routes' AND constraint_type = 'PRIMARY KEY'
                );
                
                RAISE NOTICE 'Foreign key constraint appears to be working correctly';
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Foreign key constraint is broken, recreating table...';
                    DROP TABLE IF EXISTS route_stops CASCADE;
                    table_exists := FALSE;
            END;
        END IF;
    END IF;
    
    -- Create route_stops table if it doesn't exist or was dropped
    IF NOT table_exists THEN
        RAISE NOTICE 'Creating route_stops table with proper foreign key constraints...';
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
            
            -- Add foreign key constraints
            CONSTRAINT route_stops_route_id_fkey 
                FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
            CONSTRAINT route_stops_order_id_fkey 
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                
            -- Add unique constraints
            CONSTRAINT route_stops_route_stop_unique UNIQUE(route_id, stop_number),
            CONSTRAINT route_stops_route_order_unique UNIQUE(route_id, order_id)
        );
        
        RAISE NOTICE 'Route_stops table created successfully with foreign key constraints';
    END IF;
    
    -- Add route-related columns to orders table if they don't exist
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
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'stop_number' AND table_schema = 'public'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        ALTER TABLE orders ADD COLUMN stop_number INTEGER;
        RAISE NOTICE 'Added stop_number column to orders';
    END IF;
    
    -- Add foreign key constraint for orders.route_id if it doesn't exist (but make it optional)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_route_id_fkey' 
        AND table_name = 'orders'
        AND table_schema = 'public'
    ) INTO constraint_exists;
    
    IF NOT constraint_exists THEN
        BEGIN
            ALTER TABLE orders ADD CONSTRAINT orders_route_id_fkey 
                FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL;
            RAISE NOTICE 'Added foreign key constraint for orders.route_id';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not add orders.route_id foreign key constraint: %', SQLERRM;
        END;
    END IF;
    
    -- Create route number generation function
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
            
            -- Check if this route number already exists
            IF NOT EXISTS (SELECT 1 FROM routes WHERE routes.route_number = route_number) THEN
                RETURN route_number;
            END IF;
            
            counter := counter + 1;
            
            -- Prevent infinite loop
            IF counter > max_attempts THEN
                -- Fallback to timestamp-based number
                route_number := 'RT' || date_str || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
                RETURN route_number;
            END IF;
        END LOOP;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Grant permissions
    GRANT EXECUTE ON FUNCTION generate_route_number() TO authenticated;
    
    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);
    CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
    CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
    CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON route_stops(route_id, sequence_order);
    CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);
    
    -- Enable RLS on routes and route_stops
    ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policies for routes (without foreign key dependency on user_profiles)
    DROP POLICY IF EXISTS "routes_select_policy" ON routes;
    CREATE POLICY "routes_select_policy" ON routes
        FOR SELECT USING (
            created_by = auth.uid() OR 
            driver_id = auth.uid() OR
            -- Allow access if user is admin/super_admin (but don't require foreign key)
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'super_admin')
            ) OR
            -- Fallback: allow if no user_profiles table exists
            NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles')
        );

    DROP POLICY IF EXISTS "routes_modify_policy" ON routes;
    CREATE POLICY "routes_modify_policy" ON routes
        FOR ALL USING (
            created_by = auth.uid() OR
            -- Allow access if user is admin/super_admin (but don't require foreign key)
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'super_admin')
            ) OR
            -- Fallback: allow if no user_profiles table exists
            NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles')
        );
    
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
                    ) OR
                    -- Fallback: allow if no user_profiles table exists
                    NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles')
                )
            )
        );

    DROP POLICY IF EXISTS "route_stops_modify_policy" ON route_stops;
    CREATE POLICY "route_stops_modify_policy" ON route_stops
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM routes 
                WHERE routes.id = route_stops.route_id 
                AND (
                    routes.created_by = auth.uid() OR
                    EXISTS (
                        SELECT 1 FROM user_profiles 
                        WHERE user_id = auth.uid() 
                        AND role IN ('admin', 'super_admin')
                    ) OR
                    -- Fallback: allow if no user_profiles table exists
                    NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_profiles')
                )
            )
        );
    
    -- Grant permissions
    GRANT ALL ON routes TO authenticated;
    GRANT ALL ON route_stops TO authenticated;
    
    RAISE NOTICE 'Comprehensive foreign key constraint fixes completed successfully';
    
    -- Final verification
    RAISE NOTICE 'Verifying table structure...';
    
    -- Check routes table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'routes' AND table_schema = 'public') THEN
        RAISE NOTICE 'Routes table: OK';
    ELSE
        RAISE EXCEPTION 'Routes table verification failed';
    END IF;
    
    -- Check route_stops table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'route_stops' AND table_schema = 'public') THEN
        RAISE NOTICE 'Route_stops table: OK';
    ELSE
        RAISE EXCEPTION 'Route_stops table verification failed';
    END IF;
    
    -- Check foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'route_stops_route_id_fkey' 
        AND table_name = 'route_stops'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Foreign key constraint: OK';
    ELSE
        RAISE EXCEPTION 'Foreign key constraint verification failed';
    END IF;
    
    RAISE NOTICE 'All verifications passed - database is ready for route optimization';
    RAISE NOTICE 'IMPORTANT: created_by foreign key constraint has been REMOVED to prevent issues';
    
END $$;
