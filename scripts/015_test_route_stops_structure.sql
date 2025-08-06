-- Test script to verify route and route_stops table structure and functionality
DO $$ 
DECLARE
    test_route_id UUID;
    test_order_id UUID;
    routes_count INTEGER;
    stops_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting comprehensive route structure test...';
    
    -- Test 1: Check if routes table exists and is accessible
    BEGIN
        SELECT COUNT(*) INTO routes_count FROM routes LIMIT 1;
        RAISE NOTICE 'Routes table: ACCESSIBLE (% existing routes)', routes_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Routes table test FAILED: %', SQLERRM;
    END;
    
    -- Test 2: Check if route_stops table exists and is accessible
    BEGIN
        SELECT COUNT(*) INTO stops_count FROM route_stops LIMIT 1;
        RAISE NOTICE 'Route_stops table: ACCESSIBLE (% existing stops)', stops_count;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Route_stops table test FAILED: %', SQLERRM;
    END;
    
    -- Test 3: Check if orders table exists and has some data
    BEGIN
        SELECT id INTO test_order_id FROM orders LIMIT 1;
        IF test_order_id IS NULL THEN
            RAISE NOTICE 'Orders table: ACCESSIBLE but EMPTY - creating test order';
            INSERT INTO orders (
                order_number, 
                customer_name, 
                customer_email, 
                delivery_address, 
                status, 
                priority,
                created_by
            ) VALUES (
                'TEST-ORDER-001',
                'Test Customer',
                'test@example.com',
                '123 Test Street, Test City',
                'pending',
                'normal',
                '00000000-0000-0000-0000-000000000000'
            ) RETURNING id INTO test_order_id;
            RAISE NOTICE 'Created test order: %', test_order_id;
        ELSE
            RAISE NOTICE 'Orders table: ACCESSIBLE with existing data';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Orders table test FAILED: %', SQLERRM;
    END;
    
    -- Test 4: Try to create a test route
    BEGIN
        INSERT INTO routes (
            route_number,
            route_name,
            status,
            total_distance,
            estimated_duration,
            created_by,
            total_stops
        ) VALUES (
            'TEST-ROUTE-001',
            'Test Route for Structure Verification',
            'planned',
            10.5,
            60,
            '00000000-0000-0000-0000-000000000000',
            1
        ) RETURNING id INTO test_route_id;
        
        RAISE NOTICE 'Test route creation: SUCCESS (ID: %)', test_route_id;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Test route creation FAILED: %', SQLERRM;
    END;
    
    -- Test 5: Try to create a test route stop
    BEGIN
        INSERT INTO route_stops (
            route_id,
            order_id,
            stop_number,
            sequence_order,
            stop_label,
            address,
            latitude,
            longitude,
            estimated_time,
            distance_from_previous,
            status
        ) VALUES (
            test_route_id,
            test_order_id,
            1,
            1,
            'Test Stop 1',
            '123 Test Street, Test City',
            43.6532,
            -79.3832,
            15,
            0,
            'pending'
        );
        
        RAISE NOTICE 'Test route stop creation: SUCCESS';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Test route stop creation FAILED: %', SQLERRM;
    END;
    
    -- Test 6: Verify foreign key relationships work
    BEGIN
        SELECT COUNT(*) INTO stops_count 
        FROM route_stops rs 
        JOIN routes r ON rs.route_id = r.id 
        WHERE r.id = test_route_id;
        
        IF stops_count > 0 THEN
            RAISE NOTICE 'Foreign key relationship test: SUCCESS (% stops found)', stops_count;
        ELSE
            RAISE EXCEPTION 'Foreign key relationship test FAILED: No stops found for route';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Foreign key relationship test FAILED: %', SQLERRM;
    END;
    
    -- Cleanup test data
    BEGIN
        DELETE FROM route_stops WHERE route_id = test_route_id;
        DELETE FROM routes WHERE id = test_route_id;
        DELETE FROM orders WHERE order_number = 'TEST-ORDER-001';
        RAISE NOTICE 'Test data cleanup: SUCCESS';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Test data cleanup WARNING: %', SQLERRM;
    END;
    
    RAISE NOTICE 'All structure tests PASSED - Database is ready for route operations';
    
END $$;
