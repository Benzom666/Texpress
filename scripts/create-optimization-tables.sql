-- Create optimization presets table
CREATE TABLE IF NOT EXISTS optimization_presets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parameters JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create optimization sessions table
CREATE TABLE IF NOT EXISTS optimization_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parameters JSONB NOT NULL,
    routes_count INTEGER NOT NULL DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_distance DECIMAL(10,2) DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- in minutes
    optimization_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order coordinates cache table
CREATE TABLE IF NOT EXISTS order_coordinates_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy VARCHAR(20) DEFAULT 'medium',
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(order_id)
);

-- Add route optimization fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS route_number INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stop_number INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS optimization_session_id UUID REFERENCES optimization_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS zone VARCHAR(50),
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_route_number ON orders(route_number);
CREATE INDEX IF NOT EXISTS idx_orders_stop_number ON orders(stop_number);
CREATE INDEX IF NOT EXISTS idx_orders_zone ON orders(zone);
CREATE INDEX IF NOT EXISTS idx_orders_postal_code ON orders(postal_code);
CREATE INDEX IF NOT EXISTS idx_optimization_presets_admin ON optimization_presets(created_by);
CREATE INDEX IF NOT EXISTS idx_optimization_sessions_admin ON optimization_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_coordinates_cache_order ON order_coordinates_cache(order_id);

-- Enable RLS
ALTER TABLE optimization_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_coordinates_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own optimization presets" ON optimization_presets
    FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Users can manage their own optimization sessions" ON optimization_sessions
    FOR ALL USING (auth.uid() = admin_id);

CREATE POLICY "Users can manage coordinates for their orders" ON order_coordinates_cache
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_coordinates_cache.order_id 
            AND orders.created_by = auth.uid()
        )
    );
