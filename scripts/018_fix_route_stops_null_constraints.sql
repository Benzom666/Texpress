-- Fix route_stops table constraints and schema issues
-- This script removes NOT NULL constraints that are causing insertion failures

BEGIN;

-- Drop existing route_stops table if it exists and recreate with proper schema
DROP TABLE IF EXISTS route_stops CASCADE;

-- Create route_stops table with nullable address column
CREATE TABLE route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL,
    order_id UUID NOT NULL,
    stop_number INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    stop_label TEXT,
    address TEXT, -- Made nullable to prevent insertion errors
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    estimated_time INTEGER DEFAULT 15,
    distance_from_previous DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    actual_arrival_time TIMESTAMPTZ,
    actual_departure_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints (without CASCADE to prevent issues)
ALTER TABLE route_stops 
ADD CONSTRAINT route_stops_route_id_fkey 
FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;

ALTER TABLE route_stops 
ADD CONSTRAINT route_stops_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX idx_route_stops_order_id ON route_stops(order_id);
CREATE INDEX idx_route_stops_sequence ON route_stops(route_id, sequence_order);

-- Add unique constraint to prevent duplicate stops
ALTER TABLE route_stops 
ADD CONSTRAINT unique_route_stop_number 
UNIQUE (route_id, stop_number);

-- Enable RLS
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view route_stops for their routes" ON route_stops
    FOR SELECT USING (
        route_id IN (
            SELECT id FROM routes 
            WHERE created_by = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert route_stops for their routes" ON route_stops
    FOR INSERT WITH CHECK (
        route_id IN (
            SELECT id FROM routes 
            WHERE created_by = auth.uid()::text
        )
    );

CREATE POLICY "Users can update route_stops for their routes" ON route_stops
    FOR UPDATE USING (
        route_id IN (
            SELECT id FROM routes 
            WHERE created_by = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete route_stops for their routes" ON route_stops
    FOR DELETE USING (
        route_id IN (
            SELECT id FROM routes 
            WHERE created_by = auth.uid()::text
        )
    );

-- Fix user_profiles table to add missing columns
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Update full_name from existing data
UPDATE user_profiles 
SET full_name = COALESCE(
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
    SPLIT_PART(email, '@', 1)
)
WHERE full_name IS NULL;

COMMIT;
