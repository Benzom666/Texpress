-- Add missing columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_window_start TIME,
ADD COLUMN IF NOT EXISTS delivery_window_end TIME,
ADD COLUMN IF NOT EXISTS special_instructions TEXT,
ADD COLUMN IF NOT EXISTS package_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS package_dimensions VARCHAR(100),
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE;

-- Update existing orders to have default values
UPDATE orders 
SET 
  delivery_instructions = COALESCE(delivery_instructions, ''),
  customer_phone = COALESCE(customer_phone, ''),
  delivery_notes = COALESCE(delivery_notes, ''),
  special_instructions = COALESCE(special_instructions, ''),
  package_weight = COALESCE(package_weight, 0.00),
  package_dimensions = COALESCE(package_dimensions, ''),
  delivery_fee = COALESCE(delivery_fee, 0.00),
  is_fragile = COALESCE(is_fragile, FALSE),
  requires_signature = COALESCE(requires_signature, FALSE),
  delivery_attempts = COALESCE(delivery_attempts, 0)
WHERE 
  delivery_instructions IS NULL 
  OR customer_phone IS NULL 
  OR delivery_notes IS NULL 
  OR special_instructions IS NULL 
  OR package_weight IS NULL 
  OR package_dimensions IS NULL 
  OR delivery_fee IS NULL 
  OR is_fragile IS NULL 
  OR requires_signature IS NULL 
  OR delivery_attempts IS NULL;
