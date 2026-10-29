-- 乘客可選陸路隧道（獅子山、大老山、尖山等）
SET NAMES utf8mb4;

INSERT INTO booking_options (category_id, code, label_zh, label_en, icon_key, sort_order)
SELECT c.id, v.code, v.label_zh, v.label_en, v.icon_key, v.sort_order
FROM booking_option_categories c
JOIN (
  SELECT 'tunnel' AS cat, 'lion_rock' AS code, '獅隧' AS label_zh, 'Lion Rock Tunnel' AS label_en, 'tunnel_lion' AS icon_key, 45 AS sort_order
  UNION ALL SELECT 'tunnel', 'tate_cairn', '大老山', 'Tate''s Cairn Tunnel', 'tunnel_tate', 50
  UNION ALL SELECT 'tunnel', 'eagles_nest', '尖山', 'Eagle''s Nest Tunnel', 'tunnel_eagles', 55
  UNION ALL SELECT 'tunnel', 'shing_mun', '城門', 'Shing Mun Tunnel', 'tunnel_shing', 60
  UNION ALL SELECT 'tunnel', 'aberdeen', '香港仔', 'Aberdeen Tunnel', 'tunnel_aberdeen', 70
  UNION ALL SELECT 'tunnel', 'tseung_kwan_o', '將軍澳', 'Tseung Kwan O Tunnel', 'tunnel_tko', 75
  UNION ALL SELECT 'tunnel', 'tai_lam', '大欖', 'Tai Lam Tunnel', 'tunnel_tai_lam', 80
) v ON v.cat = c.code
ON DUPLICATE KEY UPDATE
  label_zh = VALUES(label_zh),
  label_en = VALUES(label_en),
  icon_key = VALUES(icon_key),
  sort_order = VALUES(sort_order);
