-- Fix the relationship between orders and user_profiles tables
-- This script ensures proper foreign key relationships and column names

-- First, let's check and fix the orders table structure
DO $$ 
BEGIN
    -- Add assigned_driver_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'assigned_driver_id') THEN
        ALTER TABLE orders ADD COLUMN assigned_driver_id UUID;
        RAISE NOTICE 'Added assigned_driver_id column to orders table';
    END IF;

    -- Ensure user_profiles table exists and has proper structure
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        CREATE TABLE user_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            role TEXT NOT NULL DEFAULT 'driver',
            status TEXT DEFAULT 'active',
            availability_status TEXT DEFAULT 'available',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created user_profiles table';
    END IF;
END $$;

-- Drop existing foreign key constraints if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'orders_assigned_driver_id_fkey') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_assigned_driver_id_fkey;
        RAISE NOTICE 'Dropped existing orders_assigned_driver_id_fkey constraint';
    END IF;
END $$;

-- Create proper foreign key relationships
-- Using user_profiles.id as the target (UUID primary key)
ALTER TABLE orders 
ADD CONSTRAINT orders_assigned_driver_id_fkey 
FOREIGN KEY (assigned_driver_id) REFERENCES user_profiles(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver_id ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Ensure proper data types and constraints
ALTER TABLE orders 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN priority SET DEFAULT 'normal',
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add check constraints for valid values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'orders_status_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'failed', 'cancelled'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'orders_priority_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_priority_check 
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'user_profiles_role_check') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
        CHECK (role IN ('driver', 'admin', 'super_admin'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'user_profiles_status_check') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_status_check 
        CHECK (status IN ('active', 'inactive', 'suspended'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'user_profiles_availability_check') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_availability_check 
        CHECK (availability_status IN ('available', 'assigned', 'offline', 'busy'));
    END IF;
END $$;

-- Update any existing NULL values to defaults
UPDATE orders SET status = 'pending' WHERE status IS NULL;
UPDATE orders SET priority = 'normal' WHERE priority IS NULL;
UPDATE orders SET created_at = NOW() WHERE created_at IS NULL;
UPDATE orders SET updated_at = NOW() WHERE updated_at IS NULL;

-- Insert some sample data if tables are empty
DO $$
BEGIN
    -- Add sample drivers if none exist
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE role = 'driver') THEN
        INSERT INTO user_profiles (first_name, last_name, email, role, status, availability_status) VALUES
        ('John', 'Doe', 'john.doe@example.com', 'driver', 'active', 'available'),
        ('Jane', 'Smith', 'jane.smith@example.com', 'driver', 'active', 'available'),
        ('Mike', 'Johnson', 'mike.johnson@example.com', 'driver', 'active', 'offline');
        RAISE NOTICE 'Added sample drivers';
    END IF;

    -- Add sample orders if none exist
    IF NOT EXISTS (SELECT 1 FROM orders) THEN
        INSERT INTO orders (order_number, customer_name, customer_email, delivery_address, status, priority) VALUES
        ('ORD-001', 'Alice Brown', 'alice@example.com', '123 Main St, City, State', 'pending', 'normal'),
        ('ORD-002', 'Bob Wilson', 'bob@example.com', '456 Oak Ave, City, State', 'pending', 'high'),
        ('ORD-003', 'Carol Davis', 'carol@example.com', '789 Pine Rd, City, State', 'assigned', 'urgent');
        RAISE NOTICE 'Added sample orders';
    END IF;
END $$;

RAISE NOTICE 'Fixed orders and user_profiles relationship successfully';
