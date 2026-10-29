SET NAMES utf8mb4;
UPDATE ratings SET comment = 'Demo：乘客評司機' WHERE order_id = 90001 AND direction = 'passenger_to_driver';
UPDATE ratings SET comment = 'Demo：司機評乘客' WHERE order_id = 90001 AND direction = 'driver_to_passenger';
