-- Create GraphHopper routes and optimization tables
-- This schema supports persistent route storage with stop sequences

-- Routes table - stores optimized routes
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    
    -- Route metadata
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    vehicle_id VARCHAR(100),
    
    -- Route optimization data
    optimization_id VARCHAR(100), -- GraphHopper job ID
    total_distance DECIMAL(10,2), -- in kilometers
    total_duration INTEGER, -- in seconds
    total_driving_time INTEGER, -- in seconds
    total_service_time INTEGER, -- in seconds
    total_waiting_time INTEGER, -- in seconds
    
    -- Route geometry and waypoints
    route_geometry JSONB, -- GeoJSON LineString
    waypoints JSONB, -- Array of coordinate pairs
    
    -- Route configuration
    optimization_settings JSONB, -- Settings used for optimization
    vehicle_constraints JSONB, -- Vehicle capacity, time windows, etc.
    
    -- Route status and assignment
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'optimized', 'assigned', 'in_progress', 'completed', 'cancelled')),
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT routes_route_number_key UNIQUE (route_number)
);

-- Route stops table - stores individual stops with sequence numbers
CREATE TABLE IF NOT EXISTS route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Stop sequence and identification
    stop_number INTEGER NOT NULL, -- 1, 2, 3, etc.
    stop_type VARCHAR(50) DEFAULT 'delivery' CHECK (stop_type IN ('start', 'delivery', 'pickup', 'break', 'end')),
    
    -- Location data
    address TEXT NOT NULL,
    coordinates POINT, -- PostGIS point (lat, lng)
    location_name VARCHAR(255),
    
    -- Timing information
    estimated_arrival_time TIMESTAMP WITH TIME ZONE,
    estimated_departure_time TIMESTAMP WITH TIME ZONE,
    service_duration INTEGER DEFAULT 300, -- seconds (5 minutes default)
    time_window_start TIME,
    time_window_end TIME,
    
    -- Actual timing (filled by driver)
    actual_arrival_time TIMESTAMP WITH TIME ZONE,
    actual_departure_time TIMESTAMP WITH TIME ZONE,
    actual_service_duration INTEGER,
    
    -- Stop details
    instructions TEXT, -- Special delivery instructions
    priority INTEGER DEFAULT 1, -- 1=low, 2=normal, 3=high, 4=urgent
    size_requirements JSONB, -- Package dimensions, weight, etc.
    special_requirements JSONB, -- Fragile, refrigerated, etc.
    
    -- Stop status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'en_route', 'arrived', 'completed', 'failed', 'skipped')),
    completion_notes TEXT,
    failure_reason TEXT,
    
    -- Proof of delivery
    pod_signature_url TEXT,
    pod_photo_urls JSONB, -- Array of photo URLs
    recipient_name VARCHAR(255),
    recipient_signature_timestamp TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(route_id, stop_number),
    UNIQUE(route_id, order_id) -- Each order can only be on a route once
);

-- Route optimization history - track optimization attempts
CREATE TABLE IF NOT EXISTS route_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    
    -- Optimization metadata
    optimization_type VARCHAR(50) DEFAULT 'graphhopper' CHECK (optimization_type IN ('graphhopper', 'manual', 'vroom', 'osrm')),
    graphhopper_job_id VARCHAR(100),
    
    -- Input parameters
    input_orders JSONB, -- Array of order IDs that were optimized
    input_settings JSONB, -- Optimization settings used
    vehicle_config JSONB, -- Vehicle configuration
    
    -- Results
    optimization_status VARCHAR(50) DEFAULT 'pending' CHECK (optimization_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    result_data JSONB, -- Full GraphHopper response
    error_message TEXT,
    
    -- Performance metrics
    processing_time_ms INTEGER,
    api_cost DECIMAL(10,4), -- Cost in credits/dollars
    
    -- Quality metrics
    total_distance_before DECIMAL(10,2),
    total_distance_after DECIMAL(10,2),
    total_time_before INTEGER,
    total_time_after INTEGER,
    improvement_percentage DECIMAL(5,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Route assignments - track driver assignments over time
CREATE TABLE IF NOT EXISTS route_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Assignment details
    assignment_type VARCHAR(50) DEFAULT 'manual' CHECK (assignment_type IN ('manual', 'automatic', 'self_assigned')),
    assignment_reason TEXT,
    
    -- Assignment period
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unassigned_at TIMESTAMP WITH TIME ZONE,
    unassignment_reason TEXT,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'reassigned')),
    
    -- Performance tracking
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    stops_completed INTEGER DEFAULT 0,
    stops_failed INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Route labels - for printing and tracking
CREATE TABLE IF NOT EXISTS route_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    
    -- Label configuration
    label_type VARCHAR(50) DEFAULT 'route_summary' CHECK (label_type IN ('route_summary', 'stop_list', 'driver_manifest', 'customer_notification')),
    format VARCHAR(20) DEFAULT 'pdf' CHECK (format IN ('pdf', 'png', 'html')),
    size VARCHAR(20) DEFAULT 'a4' CHECK (size IN ('a4', 'letter', 'label_4x6', 'label_2x1')),
    
    -- Label content
    title VARCHAR(255),
    subtitle VARCHAR(255),
    include_map BOOLEAN DEFAULT true,
    include_qr_code BOOLEAN DEFAULT true,
    include_barcode BOOLEAN DEFAULT true,
    include_stop_details BOOLEAN DEFAULT true,
    include_customer_info BOOLEAN DEFAULT false,
    
    -- Generated files
    file_url TEXT,
    file_size INTEGER,
    qr_code_data TEXT, -- JSON data encoded in QR code
    barcode_data TEXT, -- Route number or tracking code
    
    -- Generation metadata
    generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Print tracking
    print_count INTEGER DEFAULT 0,
    last_printed_at TIMESTAMP WITH TIME ZONE,
    last_printed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at);
CREATE INDEX IF NOT EXISTS idx_routes_route_number ON routes(route_number);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_number ON route_stops(route_id, stop_number);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON route_stops(status);
CREATE INDEX IF NOT EXISTS idx_route_stops_coordinates ON route_stops USING GIST(coordinates);

CREATE INDEX IF NOT EXISTS idx_route_optimizations_route_id ON route_optimizations(route_id);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_status ON route_optimizations(optimization_status);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_created_at ON route_optimizations(created_at);

CREATE INDEX IF NOT EXISTS idx_route_assignments_route_id ON route_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_driver_id ON route_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_status ON route_assignments(status);

CREATE INDEX IF NOT EXISTS idx_route_labels_route_id ON route_labels(route_id);
CREATE INDEX IF NOT EXISTS idx_route_labels_generated_by ON route_labels(generated_by);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_stops_updated_at BEFORE UPDATE ON route_stops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_assignments_updated_at BEFORE UPDATE ON route_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_route_labels_updated_at BEFORE UPDATE ON route_labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routes
CREATE POLICY "Users can view their own routes" ON routes
    FOR SELECT USING (created_by = auth.uid() OR driver_id = auth.uid());

CREATE POLICY "Users can create routes" ON routes
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own routes" ON routes
    FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own routes" ON routes
    FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for route_stops
CREATE POLICY "Users can view stops for their routes" ON route_stops
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_stops.route_id 
            AND (routes.created_by = auth.uid() OR routes.driver_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage stops for their routes" ON route_stops
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_stops.route_id 
            AND routes.created_by = auth.uid()
        )
    );

-- RLS Policies for route_optimizations
CREATE POLICY "Users can view optimizations for their routes" ON route_optimizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_optimizations.route_id 
            AND routes.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create optimizations for their routes" ON route_optimizations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_optimizations.route_id 
            AND routes.created_by = auth.uid()
        )
    );

-- RLS Policies for route_assignments
CREATE POLICY "Users can view assignments for their routes" ON route_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_assignments.route_id 
            AND (routes.created_by = auth.uid() OR routes.driver_id = auth.uid())
        )
        OR driver_id = auth.uid()
    );

CREATE POLICY "Admins can manage route assignments" ON route_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_assignments.route_id 
            AND routes.created_by = auth.uid()
        )
    );

-- RLS Policies for route_labels
CREATE POLICY "Users can view labels for their routes" ON route_labels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_labels.route_id 
            AND (routes.created_by = auth.uid() OR routes.driver_id = auth.uid())
        )
    );

CREATE POLICY "Users can create labels for their routes" ON route_labels
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM routes 
            WHERE routes.id = route_labels.route_id 
            AND routes.created_by = auth.uid()
        )
        AND generated_by = auth.uid()
    );

-- Add route_id column to orders table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'route_id') THEN
        ALTER TABLE orders ADD COLUMN route_id UUID REFERENCES routes(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_orders_route_id ON orders(route_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'stop_number') THEN
        ALTER TABLE orders ADD COLUMN stop_number INTEGER;
        CREATE INDEX IF NOT EXISTS idx_orders_route_stop ON orders(route_id, stop_number);
    END IF;
END $$;

-- Create a function to generate route numbers
CREATE OR REPLACE FUNCTION generate_route_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        new_number := 'RT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 3, '0');
        
        IF NOT EXISTS (SELECT 1 FROM routes WHERE route_number = new_number) THEN
            RETURN new_number;
        END IF;
        
        counter := counter + 1;
        
        -- Prevent infinite loop
        IF counter > 999 THEN
            new_number := 'RT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || LPAD((RANDOM() * 999)::INTEGER::TEXT, 3, '0');
            RETURN new_number;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a function to calculate route statistics
CREATE OR REPLACE FUNCTION calculate_route_stats(route_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    total_stops INTEGER;
    completed_stops INTEGER;
    pending_stops INTEGER;
    failed_stops INTEGER;
BEGIN
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status IN ('pending', 'en_route', 'arrived')) as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
    INTO total_stops, completed_stops, pending_stops, failed_stops
    FROM route_stops 
    WHERE route_id = route_uuid;
    
    stats := jsonb_build_object(
        'total_stops', total_stops,
        'completed_stops', completed_stops,
        'pending_stops', pending_stops,
        'failed_stops', failed_stops,
        'completion_percentage', 
        CASE 
            WHEN total_stops > 0 THEN ROUND((completed_stops::DECIMAL / total_stops::DECIMAL) * 100, 2)
            ELSE 0 
        END
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Insert some sample vehicle types for GraphHopper optimization
INSERT INTO public.vehicle_types (type_id, profile, capacity, speed_factor, service_time_factor) VALUES
('small_truck', 'driving', ARRAY[1000], 1.0, 1.0),
('medium_truck', 'driving', ARRAY[2000], 0.9, 1.1),
('large_truck', 'driving', ARRAY[5000], 0.8, 1.2),
('van', 'driving', ARRAY[800], 1.1, 0.9),
('motorcycle', 'driving', ARRAY[50], 1.3, 0.7)
ON CONFLICT (type_id) DO NOTHING;

COMMENT ON TABLE routes IS 'Stores optimized delivery routes with GraphHopper integration';
COMMENT ON TABLE route_stops IS 'Individual stops within routes with sequence numbers and timing';
COMMENT ON TABLE route_optimizations IS 'History of route optimization attempts and results';
COMMENT ON TABLE route_assignments IS 'Driver assignments to routes over time';
COMMENT ON TABLE route_labels IS 'Generated labels and documents for routes';
