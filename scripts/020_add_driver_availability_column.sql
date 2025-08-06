-- Add is_available column to user_profiles table for driver availability tracking
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

-- Add index for better performance on availability queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_availability 
ON user_profiles(role, is_available) 
WHERE role = 'driver';

-- Update existing drivers to be available by default
UPDATE user_profiles 
SET is_available = true 
WHERE role = 'driver' AND is_available IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.is_available IS 'Indicates if the driver is available for new route assignments';
