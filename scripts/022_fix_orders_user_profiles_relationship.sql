-- Fix the relationship between orders and user_profiles tables
-- This script ensures proper foreign key relationships exist

-- First, let's check if the columns exist and add them if they don't
DO $$
BEGIN
    -- Add assigned_driver_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'assigned_driver_id') THEN
        ALTER TABLE orders ADD COLUMN assigned_driver_id UUID;
        RAISE NOTICE 'Added assigned_driver_id column to orders table';
    END IF;

    -- Add driver_id column if it doesn't exist (for backward compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'driver_id') THEN
        ALTER TABLE orders ADD COLUMN driver_id UUID;
        RAISE NOTICE 'Added driver_id column to orders table';
    END IF;

    -- Add route_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'route_id') THEN
        ALTER TABLE orders ADD COLUMN route_id UUID;
        RAISE NOTICE 'Added route_id column to orders table';
    END IF;

    -- Add route_number column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'route_number') THEN
        ALTER TABLE orders ADD COLUMN route_number TEXT;
        RAISE NOTICE 'Added route_number column to orders table';
    END IF;
END $$;

-- Drop existing foreign key constraints if they exist (to recreate them properly)
DO $$
BEGIN
    -- Drop existing foreign key for assigned_driver_id
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'orders_assigned_driver_id_fkey' 
               AND table_name = 'orders') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_assigned_driver_id_fkey;
        RAISE NOTICE 'Dropped existing orders_assigned_driver_id_fkey constraint';
    END IF;

    -- Drop existing foreign key for driver_id
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'orders_driver_id_fkey' 
               AND table_name = 'orders') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_driver_id_fkey;
        RAISE NOTICE 'Dropped existing orders_driver_id_fkey constraint';
    END IF;

    -- Drop existing foreign key for route_id
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'orders_route_id_fkey' 
               AND table_name = 'orders') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_route_id_fkey;
        RAISE NOTICE 'Dropped existing orders_route_id_fkey constraint';
    END IF;
END $$;

-- Create proper foreign key relationships
ALTER TABLE orders 
ADD CONSTRAINT orders_assigned_driver_id_fkey 
FOREIGN KEY (assigned_driver_id) 
REFERENCES user_profiles(user_id) 
ON DELETE SET NULL;

ALTER TABLE orders 
ADD CONSTRAINT orders_driver_id_fkey 
FOREIGN KEY (driver_id) 
REFERENCES user_profiles(user_id) 
ON DELETE SET NULL;

-- Create routes table if it doesn't exist
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_number TEXT UNIQUE NOT NULL,
    route_name TEXT NOT NULL,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    total_distance DECIMAL(10,2) DEFAULT 0,
    estimated_duration INTEGER DEFAULT 0, -- in minutes
    total_stops INTEGER DEFAULT 0,
    driver_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for route_id if routes table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'routes') THEN
        ALTER TABLE orders 
        ADD CONSTRAINT orders_route_id_fkey 
        FOREIGN KEY (route_id) 
        REFERENCES routes(id) 
        ON DELETE SET NULL;
        RAISE NOTICE 'Added foreign key constraint for route_id';
    END IF;
END $$;

-- Create route_stops table if it doesn't exist
CREATE TABLE IF NOT EXISTS route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stop_number INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL,
    stop_label TEXT,
    address TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    estimated_time INTEGER DEFAULT 15, -- in minutes
    distance_from_previous DECIMAL(10,2) DEFAULT 0, -- in km
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'cancelled')),
    actual_arrival_time TIMESTAMPTZ,
    actual_departure_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(route_id, stop_number),
    UNIQUE(route_id, order_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver_id ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON route_stops(route_id, sequence_order);

-- Update existing orders to have proper status values
UPDATE orders 
SET status = 'pending' 
WHERE status IS NULL OR status NOT IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');

-- Update existing orders to have proper priority values
UPDATE orders 
SET priority = 'normal' 
WHERE priority IS NULL OR priority NOT IN ('urgent', 'high', 'normal', 'low');

-- Add check constraints for orders if they don't exist
DO $$
BEGIN
    -- Add status constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'orders_status_check' 
                   AND table_name = 'orders') THEN
        ALTER TABLE orders 
        ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled'));
        RAISE NOTICE 'Added status check constraint to orders table';
    END IF;

    -- Add priority constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'orders_priority_check' 
                   AND table_name = 'orders') THEN
        ALTER TABLE orders 
        ADD CONSTRAINT orders_priority_check 
        CHECK (priority IN ('urgent', 'high', 'normal', 'low'));
        RAISE NOTICE 'Added priority check constraint to orders table';
    END IF;
END $$;

-- Create a function to generate route numbers
CREATE OR REPLACE FUNCTION generate_route_number()
RETURNS TEXT AS $$
DECLARE
    date_str TEXT;
    counter INTEGER;
    route_number TEXT;
BEGIN
    -- Get current date in YYYYMMDD format
    date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Find the next available counter for today
    SELECT COALESCE(MAX(
        CASE 
            WHEN route_number ~ ('^RT' || date_str || '-[0-9]+$') 
            THEN CAST(SUBSTRING(route_number FROM LENGTH('RT' || date_str || '-') + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO counter
    FROM routes
    WHERE route_number LIKE 'RT' || date_str || '-%';
    
    -- Generate the route number
    route_number := 'RT' || date_str || '-' || LPAD(counter::TEXT, 3, '0');
    
    RETURN route_number;
END;
$$ LANGUAGE plpgsql;

-- Create sample data for testing (only if tables are empty)
DO $$
BEGIN
    -- Insert sample drivers if user_profiles table is empty
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE role = 'driver' LIMIT 1) THEN
        INSERT INTO user_profiles (user_id, email, first_name, last_name, role, phone, availability_status)
        VALUES 
            (gen_random_uuid(), 'driver1@example.com', 'John', 'Smith', 'driver', '+1-555-0101', 'available'),
            (gen_random_uuid(), 'driver2@example.com', 'Jane', 'Johnson', 'driver', '+1-555-0102', 'available'),
            (gen_random_uuid(), 'driver3@example.com', 'Mike', 'Wilson', 'driver', '+1-555-0103', 'busy'),
            (gen_random_uuid(), 'admin1@example.com', 'Admin', 'User', 'admin', '+1-555-0201', 'available');
        
        RAISE NOTICE 'Inserted sample users';
    END IF;

    -- Insert sample orders if orders table is empty
    IF NOT EXISTS (SELECT 1 FROM orders LIMIT 1) THEN
        WITH sample_admin AS (
            SELECT user_id FROM user_profiles WHERE role = 'admin' LIMIT 1
        ),
        sample_driver AS (
            SELECT user_id FROM user_profiles WHERE role = 'driver' AND availability_status = 'available' LIMIT 1
        )
        INSERT INTO orders (
            order_number, customer_name, customer_phone, customer_email,
            pickup_address, delivery_address, delivery_notes,
            priority, status, created_by, assigned_driver_id,
            coordinates, estimated_delivery_time
        )
        SELECT 
            'ORD-' || LPAD((ROW_NUMBER() OVER())::TEXT, 6, '0'),
            customer_data.name,
            customer_data.phone,
            customer_data.email,
            '123 Warehouse St, Toronto, ON M5V 3A8',
            customer_data.address,
            customer_data.notes,
            customer_data.priority,
            customer_data.status,
            sample_admin.user_id,
            CASE WHEN customer_data.status = 'assigned' THEN sample_driver.user_id ELSE NULL END,
            customer_data.coords,
            NOW() + (customer_data.delivery_hours || ' hours')::INTERVAL
        FROM sample_admin, sample_driver,
        (VALUES 
            ('Alice Johnson', '+1-416-555-0101', 'alice@example.com', '456 Queen St W, Toronto, ON M5V 2A9', 'Please ring doorbell twice', 'urgent', 'assigned', POINT(-79.3957, 43.6426), '2'),
            ('Bob Smith', '+1-416-555-0102', 'bob@example.com', '789 King St E, Toronto, ON M5A 1M2', 'Leave at front desk', 'high', 'pending', POINT(-79.3676, 43.6514), '4'),
            ('Carol Davis', '+1-416-555-0103', 'carol@example.com', '321 Spadina Ave, Toronto, ON M5T 2E7', 'Apartment 5B', 'normal', 'pending', POINT(-79.3957, 43.6532), '6'),
            ('David Wilson', '+1-416-555-0104', 'david@example.com', '654 Bloor St W, Toronto, ON M6G 1K4', 'Business hours only', 'normal', 'pending', POINT(-79.4103, 43.6626), '3'),
            ('Eva Brown', '+1-416-555-0105', 'eva@example.com', '987 Yonge St, Toronto, ON M4W 2K2', 'Call upon arrival', 'low', 'pending', POINT(-79.3832, 43.6762), '8')
        ) AS customer_data(name, phone, email, address, notes, priority, status, coords, delivery_hours);
        
        RAISE NOTICE 'Inserted sample orders';
    END IF;
END $$;

-- Create RLS policies if they don't exist
DO $$
BEGIN
    -- Enable RLS on orders table
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "orders_select_policy" ON orders;
    DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
    DROP POLICY IF EXISTS "orders_update_policy" ON orders;
    DROP POLICY IF EXISTS "orders_delete_policy" ON orders;
    
    -- Create new policies
    CREATE POLICY "orders_select_policy" ON orders
        FOR SELECT USING (
            auth.uid() = created_by OR 
            auth.uid() = assigned_driver_id OR 
            auth.uid() = driver_id OR
            EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
        );
    
    CREATE POLICY "orders_insert_policy" ON orders
        FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
        );
    
    CREATE POLICY "orders_update_policy" ON orders
        FOR UPDATE USING (
            auth.uid() = created_by OR 
            auth.uid() = assigned_driver_id OR 
            auth.uid() = driver_id OR
            EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
        );
    
    CREATE POLICY "orders_delete_policy" ON orders
        FOR DELETE USING (
            EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
        );
    
    RAISE NOTICE 'Created RLS policies for orders table';
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON routes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON route_stops TO authenticated;
GRANT SELECT ON user_profiles TO authenticated;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_routes_updated_at ON routes;
CREATE TRIGGER update_routes_updated_at
    BEFORE UPDATE ON routes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_route_stops_updated_at ON route_stops;
CREATE TRIGGER update_route_stops_updated_at
    BEFORE UPDATE ON route_stops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Final verification
DO $$
DECLARE
    orders_count INTEGER;
    drivers_count INTEGER;
    routes_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orders_count FROM orders;
    SELECT COUNT(*) INTO drivers_count FROM user_profiles WHERE role = 'driver';
    SELECT COUNT(*) INTO routes_count FROM routes;
    
    RAISE NOTICE 'Database setup complete:';
    RAISE NOTICE '- Orders: %', orders_count;
    RAISE NOTICE '- Drivers: %', drivers_count;
    RAISE NOTICE '- Routes: %', routes_count;
    RAISE NOTICE 'Foreign key relationships established successfully';
END $$;
