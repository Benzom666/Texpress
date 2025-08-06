-- Add coordinates columns to orders table
DO $$ 
BEGIN
    -- Add latitude column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'latitude') THEN
        ALTER TABLE orders ADD COLUMN latitude DECIMAL(10,8);
    END IF;
    
    -- Add longitude column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'longitude') THEN
        ALTER TABLE orders ADD COLUMN longitude DECIMAL(11,8);
    END IF;
    
    -- Create index on coordinates for better performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_coordinates') THEN
        CREATE INDEX idx_orders_coordinates ON orders(latitude, longitude);
    END IF;
    
    -- Create function to get next route number if it doesn't exist
    CREATE OR REPLACE FUNCTION get_next_route_number()
    RETURNS TEXT AS $$
    DECLARE
        next_num INTEGER;
        route_number TEXT;
    BEGIN
        -- Get the highest route number and increment
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(route_number FROM 2) AS INTEGER)), 
            0
        ) + 1 INTO next_num
        FROM routes 
        WHERE route_number ~ '^R[0-9]+$';
        
        -- Format as R001, R002, etc.
        route_number := 'R' || LPAD(next_num::TEXT, 3, '0');
        
        RETURN route_number;
    END;
    $$ LANGUAGE plpgsql;
    
END $$;
