-- Fix route_stops table schema to handle sequence_order column
-- This script addresses the null value constraint error

-- First, check if sequence_order column exists and add it if missing
DO $$ 
BEGIN
    -- Add sequence_order column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'route_stops' AND column_name = 'sequence_order'
    ) THEN
        ALTER TABLE route_stops ADD COLUMN sequence_order INTEGER;
    END IF;
END $$;

-- Update existing records to have sequence_order values
UPDATE route_stops 
SET sequence_order = stop_number 
WHERE sequence_order IS NULL;

-- Make sequence_order NOT NULL with a default value
ALTER TABLE route_stops 
ALTER COLUMN sequence_order SET NOT NULL,
ALTER COLUMN sequence_order SET DEFAULT 1;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence_order 
ON route_stops(route_id, sequence_order);

-- Add constraint to ensure sequence_order is positive
ALTER TABLE route_stops 
ADD CONSTRAINT chk_route_stops_sequence_order_positive 
CHECK (sequence_order > 0);

-- Update the table comment
COMMENT ON TABLE route_stops IS 'Stores individual stops within delivery routes with proper sequencing';
COMMENT ON COLUMN route_stops.sequence_order IS 'Order of this stop in the route sequence (1-based)';
COMMENT ON COLUMN route_stops.stop_number IS 'Display number for the stop';
