-- Add route_number to driver_routes table
ALTER TABLE driver_routes ADD COLUMN route_number VARCHAR(255);

-- Add an index for faster lookups
CREATE INDEX idx_route_number ON driver_routes(route_number);

-- Backfill existing routes with a default number (optional)
UPDATE driver_routes
SET route_number = CONCAT('R', TO_CHAR(created_at, 'YYYYMMDD'), '-LEGACY')
WHERE route_number IS NULL;
