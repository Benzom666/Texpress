-- Fix database schema and relationships for proper data fetching

-- Ensure user_profiles table has proper structure
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Create proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_availability ON user_profiles(availability_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_route ON orders(route_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_driver ON routes(driver_id);

-- Ensure proper foreign key constraints
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_assigned_driver_id_fkey,
ADD CONSTRAINT orders_assigned_driver_id_fkey 
  FOREIGN KEY (assigned_driver_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

ALTER TABLE routes 
DROP CONSTRAINT IF EXISTS routes_driver_id_fkey,
ADD CONSTRAINT routes_driver_id_fkey 
  FOREIGN KEY (driver_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Update any existing data to have proper status values
UPDATE user_profiles 
SET availability_status = 'available' 
WHERE availability_status IS NULL AND role = 'driver';

UPDATE user_profiles 
SET status = 'active' 
WHERE status IS NULL;

-- Ensure orders have proper status values
UPDATE orders 
SET status = 'pending' 
WHERE status IS NULL OR status NOT IN ('pending', 'assigned', 'in_transit', 'delivered', 'failed');

-- Ensure orders have proper priority values
UPDATE orders 
SET priority = 'normal' 
WHERE priority IS NULL OR priority NOT IN ('low', 'normal', 'high', 'urgent');

-- Create RLS policies if they don't exist
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON routes;

-- Create new policies
CREATE POLICY "Enable read access for authenticated users" ON user_profiles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON orders
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON routes
  FOR ALL USING (auth.role() = 'authenticated');
