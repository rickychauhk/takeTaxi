INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('passenger_nearby_drivers_radius_km', '2')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
