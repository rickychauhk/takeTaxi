SET NAMES utf8mb4;

-- 029 若在未設 utf8mb4 的 session 下插入，label 會變成「100 ç©  åˆ†」類亂碼
UPDATE driver_point_packages SET label = '100 積分' WHERE points = 100;
UPDATE driver_point_packages SET label = '500 積分' WHERE points = 500;
UPDATE driver_point_packages SET label = '1000 積分' WHERE points = 1000;
