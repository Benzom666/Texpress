-- Fix optimization tables to handle decimal values properly
-- This addresses the "invalid input syntax for type integer" error

-- Drop existing optimization tables if they exist
DROP TABLE IF EXISTS optimization_sessions CASCADE;
DROP TABLE IF EXISTS optimization_presets CASCADE;
DROP TABLE IF EXISTS order_coordinates_cache CASCADE;

-- Create optimization_presets table if not exists
CREATE TABLE IF NOT EXISTS optimization_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parameters JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    is_default BOOLEAN DEFAULT FALSE
);

-- Create optimization_sessions table with DECIMAL fields if not exists
CREATE TABLE IF NOT EXISTS optimization_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    parameters JSONB NOT NULL,
    routes_count INTEGER NOT NULL,
    total_orders INTEGER NOT NULL,
    total_distance DECIMAL(10,2) NOT NULL,
    total_duration DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create order_coordinates_cache table
CREATE TABLE IF NOT EXISTS order_coordinates_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    latitude DECIMAL(10,6) NOT NULL,
    longitude DECIMAL(10,6) NOT NULL,
    accuracy VARCHAR(20) DEFAULT 'high',
    cached_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(order_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_route_number ON orders(route_number);
CREATE INDEX IF NOT EXISTS idx_orders_optimization_session ON orders(optimization_session_id);
CREATE INDEX IF NOT EXISTS idx_optimization_presets_admin ON optimization_presets(created_by);
CREATE INDEX IF NOT EXISTS idx_coordinates_cache_order ON order_coordinates_cache(order_id);

-- Enable RLS
ALTER TABLE optimization_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_coordinates_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for optimization_presets
CREATE POLICY "Users can view their own optimization presets" ON optimization_presets
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create their own optimization presets" ON optimization_presets
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own optimization presets" ON optimization_presets
    FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own optimization presets" ON optimization_presets
    FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for optimization_sessions
CREATE POLICY "Users can view their own optimization sessions" ON optimization_sessions
    FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "Users can create their own optimization sessions" ON optimization_sessions
    FOR INSERT WITH CHECK (admin_id = auth.uid());

-- RLS Policies for order_coordinates_cache
CREATE POLICY "Users can view coordinates for their orders" ON order_coordinates_cache
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_coordinates_cache.order_id 
            AND orders.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can cache coordinates for their orders" ON order_coordinates_cache
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_coordinates_cache.order_id 
            AND orders.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update coordinates for their orders" ON order_coordinates_cache
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_coordinates_cache.order_id 
            AND orders.created_by = auth.uid()
        )
    );

-- Update orders table to handle route optimization data
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS route_number INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stop_number INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS optimization_session_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zone VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10) DEFAULT NULL;

-- Grant necessary permissions
GRANT ALL ON optimization_presets TO authenticated;
GRANT ALL ON optimization_sessions TO authenticated;
GRANT ALL ON order_coordinates_cache TO authenticated;

COMMENT ON TABLE optimization_presets IS 'Stores saved optimization parameter presets for admins';
COMMENT ON TABLE optimization_sessions IS 'Tracks route optimization sessions and results';
COMMENT ON TABLE order_coordinates_cache IS 'Caches geocoded coordinates for orders to improve performance';
