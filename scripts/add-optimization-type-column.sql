-- Add optimization_type and api_calls_used columns to route_optimizations table
ALTER TABLE route_optimizations 
ADD COLUMN IF NOT EXISTS optimization_type VARCHAR(50) DEFAULT 'google_address_based',
ADD COLUMN IF NOT EXISTS api_calls_used INTEGER DEFAULT 0;

-- Add index for optimization_type for faster queries
CREATE INDEX IF NOT EXISTS idx_route_optimizations_type ON route_optimizations(optimization_type);

-- Update existing records to have the new optimization type
UPDATE route_optimizations 
SET optimization_type = 'google_address_based' 
WHERE optimization_type IS NULL;

-- Add comment to document the change
COMMENT ON COLUMN route_optimizations.optimization_type IS 'Type of optimization algorithm used: google_address_based, google_coordinate_based, fallback';
COMMENT ON COLUMN route_optimizations.api_calls_used IS 'Number of Google API calls used during optimization';
