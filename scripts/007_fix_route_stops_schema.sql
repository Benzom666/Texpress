-- Fix route_stops table schema to match the code expectations

-- First, let's check and add missing columns to route_stops table
DO $$ 
BEGIN
    -- Add missing columns to route_stops table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'stop_label') THEN
        ALTER TABLE route_stops ADD COLUMN stop_label TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'estimated_arrival') THEN
        ALTER TABLE route_stops ADD COLUMN estimated_arrival TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'actual_arrival') THEN
        ALTER TABLE route_stops ADD COLUMN actual_arrival TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'actual_departure') THEN
        ALTER TABLE route_stops ADD COLUMN actual_departure TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'notes') THEN
        ALTER TABLE route_stops ADD COLUMN notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'distance_from_previous') THEN
        ALTER TABLE route_stops ADD COLUMN distance_from_previous DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'route_stops' AND column_name = 'estimated_duration') THEN
        ALTER TABLE route_stops ADD COLUMN estimated_duration INTEGER DEFAULT 15; -- minutes
    END IF;
    
    -- Update the status column to include all expected values
    ALTER TABLE route_stops 
    DROP CONSTRAINT IF EXISTS route_stops_status_check;

    ALTER TABLE route_stops 
    ADD CONSTRAINT route_stops_status_check 
    CHECK (status IN ('pending', 'arrived', 'completed', 'skipped', 'failed'));

    -- Make sure we have proper indexes
    CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
    CREATE INDEX IF NOT EXISTS idx_route_stops_status ON route_stops(status);

    -- Update any existing route_stops to have proper stop_label if null
    UPDATE route_stops 
    SET stop_label = 'Stop ' || stop_number 
    WHERE stop_label IS NULL;

    -- Add missing columns to routes table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'total_stops') THEN
        ALTER TABLE routes ADD COLUMN total_stops INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'total_distance') THEN
        ALTER TABLE routes ADD COLUMN total_distance DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'routes' AND column_name = 'estimated_duration') THEN
        ALTER TABLE routes ADD COLUMN estimated_duration INTEGER DEFAULT 0; -- minutes
    END IF;
    
    -- Add missing columns to orders table for coordinates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'latitude') THEN
        ALTER TABLE orders ADD COLUMN latitude DECIMAL(10,8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'longitude') THEN
        ALTER TABLE orders ADD COLUMN longitude DECIMAL(11,8);
    END IF;
    
    -- Create index on coordinates for better performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_coordinates') THEN
        CREATE INDEX idx_orders_coordinates ON orders(latitude, longitude);
    END IF;
    
    -- Update existing routes to have correct total_stops count
    UPDATE routes 
    SET total_stops = (
        SELECT COUNT(*) 
        FROM route_stops 
        WHERE route_stops.route_id = routes.id
    )
    WHERE total_stops = 0 OR total_stops IS NULL;
    
END $$;
