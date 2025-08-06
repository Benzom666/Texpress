-- Create optimization_jobs table
CREATE TABLE IF NOT EXISTS optimization_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ids TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    settings JSONB DEFAULT '{}',
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_status ON optimization_jobs(status);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_created_at ON optimization_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_optimization_jobs_order_ids ON optimization_jobs USING GIN(order_ids);

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_optimization_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_optimization_jobs_updated_at
    BEFORE UPDATE ON optimization_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_optimization_jobs_updated_at();

-- Enable RLS
ALTER TABLE optimization_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "optimization_jobs_select_policy" ON optimization_jobs
    FOR SELECT USING (true);

CREATE POLICY "optimization_jobs_insert_policy" ON optimization_jobs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "optimization_jobs_update_policy" ON optimization_jobs
    FOR UPDATE USING (true);

CREATE POLICY "optimization_jobs_delete_policy" ON optimization_jobs
    FOR DELETE USING (true);
