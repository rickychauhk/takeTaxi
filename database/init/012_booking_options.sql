-- 乘客叫車「更多選項」分類與選項（CRM 可 CRUD）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS booking_option_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  label_zh VARCHAR(128) NOT NULL,
  label_en VARCHAR(128) NOT NULL,
  selection_mode ENUM('single', 'multi') NOT NULL DEFAULT 'single',
  display_style ENUM('chip', 'tunnel', 'vehicle') NOT NULL DEFAULT 'chip',
  screen_group ENUM('preferences', 'extras') NOT NULL DEFAULT 'preferences',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  code VARCHAR(64) NOT NULL,
  label_zh VARCHAR(128) NOT NULL,
  label_en VARCHAR(128) NOT NULL,
  icon_key VARCHAR(64) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_booking_opt_cat_code (category_id, code),
  FOREIGN KEY (category_id) REFERENCES booking_option_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO booking_option_categories (code, label_zh, label_en, selection_mode, display_style, screen_group, sort_order)
VALUES
  ('tunnel', '隧道', 'Tunnels', 'multi', 'tunnel', 'preferences', 10),
  ('stops', '停站', 'Stops', 'single', 'chip', 'preferences', 20),
  ('seats', '座位', 'Seats', 'single', 'chip', 'preferences', 30),
  ('vehicle_type', '車類', 'Vehicle', 'single', 'vehicle', 'preferences', 40),
  ('booking_time', '用車時間', 'Time', 'single', 'chip', 'preferences', 50),
  ('other', '其他', 'Other', 'multi', 'chip', 'extras', 60)
ON DUPLICATE KEY UPDATE label_zh = VALUES(label_zh), label_en = VALUES(label_en);

INSERT INTO booking_options (category_id, code, label_zh, label_en, icon_key, sort_order)
SELECT c.id, v.code, v.label_zh, v.label_en, v.icon_key, v.sort_order
FROM booking_option_categories c
JOIN (
  SELECT 'tunnel' AS cat, 'cht' AS code, '紅隧' AS label_zh, 'Cross-Harbour Tunnel' AS label_en, 'tunnel_red' AS icon_key, 10 AS sort_order
  UNION ALL SELECT 'tunnel', 'wht', '西隧', 'Western Harbour Crossing', 'tunnel_west', 20
  UNION ALL SELECT 'tunnel', 'eht', '東隧', 'Eastern Harbour Crossing', 'tunnel_east', 30
  UNION ALL SELECT 'tunnel', 'tunnel_single_fare', '收單程隧道費', 'Single-trip tunnel fee', 'tunnel_single', 40
  UNION ALL SELECT 'tunnel', 'lion_rock', '獅隧', 'Lion Rock Tunnel', 'tunnel_lion', 45
  UNION ALL SELECT 'tunnel', 'tate_cairn', '大老山', 'Tate''s Cairn Tunnel', 'tunnel_tate', 50
  UNION ALL SELECT 'tunnel', 'eagles_nest', '尖山', 'Eagle''s Nest Tunnel', 'tunnel_eagles', 55
  UNION ALL SELECT 'tunnel', 'shing_mun', '城門', 'Shing Mun Tunnel', 'tunnel_shing', 60
  UNION ALL SELECT 'tunnel', 'aberdeen', '香港仔', 'Aberdeen Tunnel', 'tunnel_aberdeen', 70
  UNION ALL SELECT 'tunnel', 'tseung_kwan_o', '將軍澳', 'Tseung Kwan O Tunnel', 'tunnel_tko', 75
  UNION ALL SELECT 'tunnel', 'tai_lam', '大欖', 'Tai Lam Tunnel', 'tunnel_tai_lam', 80
  UNION ALL SELECT 'stops', 'stops_2', '2站', '2 stops', NULL, 10
  UNION ALL SELECT 'stops', 'stops_3', '3站', '3 stops', NULL, 20
  UNION ALL SELECT 'stops', 'stops_4', '4站', '4 stops', NULL, 30
  UNION ALL SELECT 'seats', 'seats_5', '5座', '5 seats', NULL, 10
  UNION ALL SELECT 'seats', 'seats_6', '6座', '6 seats', NULL, 20
  UNION ALL SELECT 'vehicle_type', 'hybrid', '混電', 'Hybrid', 'vehicle_hybrid', 10
  UNION ALL SELECT 'vehicle_type', 'wheelchair', '輪椅', 'Wheelchair', 'vehicle_wheelchair', 20
  UNION ALL SELECT 'vehicle_type', 'large_trunk', '大尾箱', 'Large trunk', 'vehicle_luggage', 30
  UNION ALL SELECT 'booking_time', 'now', '現在', 'Now', NULL, 10
  UNION ALL SELECT 'booking_time', 'scheduled', '預約', 'Scheduled', NULL, 20
  UNION ALL SELECT 'other', 'no_luggage_fee', '免行李費', 'No luggage fee', NULL, 10
  UNION ALL SELECT 'other', 'no_airport_parking', '免機場停車場費', 'No airport parking fee', NULL, 20
  UNION ALL SELECT 'other', 'no_pet_fee', '免寵物費', 'No pet fee', NULL, 30
  UNION ALL SELECT 'other', 'receipt', '要收據', 'Receipt required', NULL, 40
  UNION ALL SELECT 'other', 'wheelchair_other', '輪椅', 'Wheelchair', NULL, 50
) v ON v.cat = c.code
ON DUPLICATE KEY UPDATE
  label_zh = VALUES(label_zh),
  label_en = VALUES(label_en),
  icon_key = VALUES(icon_key),
  sort_order = VALUES(sort_order);
