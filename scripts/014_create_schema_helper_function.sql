-- Create schema helper function for getting table structure information
CREATE OR REPLACE FUNCTION get_table_schema(table_name TEXT)
RETURNS TABLE(
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT,
    column_default TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.is_nullable::TEXT,
        c.column_default::TEXT
    FROM information_schema.columns c
    WHERE c.table_name = $1
    AND c.table_schema = 'public'
    ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_table_schema(TEXT) TO authenticated;

-- Create SQL execution function for constraint management
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS TEXT AS $$
BEGIN
    EXECUTE sql;
    RETURN 'SUCCESS';
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
