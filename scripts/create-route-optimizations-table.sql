-- Create route_optimizations table for storing optimization results
CREATE TABLE IF NOT EXISTS route_optimizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_ids UUID[] NOT NULL,
    optimization_parameters JSONB DEFAULT '{}',
    optimization_result JSONB DEFAULT '{}',
    optimization_type VARCHAR(50) DEFAULT 'google_address_based',
    api_calls_used INTEGER DEFAULT 0,
    total_routes INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_distance DECIMAL(10,2) DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_route_optimizations_admin_id ON route_optimizations(admin_id);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_created_at ON route_optimizations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_type ON route_optimizations(optimization_type);

-- Enable RLS
ALTER TABLE route_optimizations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own route optimizations" ON route_optimizations
    FOR ALL USING (auth.uid() = admin_id);

-- Add comments for documentation
COMMENT ON TABLE route_optimizations IS 'Stores route optimization results and parameters';
COMMENT ON COLUMN route_optimizations.admin_id IS 'ID of the admin who created the optimization';
COMMENT ON COLUMN route_optimizations.order_ids IS 'Array of order IDs that were optimized';
COMMENT ON COLUMN route_optimizations.optimization_parameters IS 'Parameters used for the optimization';
COMMENT ON COLUMN route_optimizations.optimization_result IS 'Complete optimization result including routes and metrics';
COMMENT ON COLUMN route_optimizations.optimization_type IS 'Type of optimization algorithm used';
COMMENT ON COLUMN route_optimizations.api_calls_used IS 'Number of external API calls made during optimization';
