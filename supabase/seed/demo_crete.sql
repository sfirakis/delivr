-- ============================================================
-- Demo data — Άγιος Νικόλαος / Ελούντα, Κρήτη
-- Idempotent: safe to run more than once.
-- QR codes to try after running this:
--   /qr/AEGEAN1   Villa Aegean Blue   (Ελούντα)
--   /qr/SUNSET2A  Sunset Apartment 2A (Άγιος Νικόλαος)
--   /qr/OLIVE3    Villa Olive Grove   (Καλό Χωριό)
-- ============================================================

INSERT INTO stores (name, slug, description, category, cuisine_tags, address, city, lat, lng,
  phone, email, order_email, order_whatsapp, delivery_fee, min_order_amount, free_delivery_above,
  avg_delivery_time, delivery_radius_km, pickup_radius_km, prep_time_min, pickup_discount_pct,
  is_open, is_active, is_promoted, rating, review_count, supports_delivery, supports_takeaway)
VALUES
 ('Ταβέρνα Μαρίνα','taverna-marina','Παραδοσιακή κρητική κουζίνα με θέα στο λιμάνι','restaurant',
  ARRAY['ελληνική','ψαροταβέρνα','κρητική'],'Ακτή Κουνδούρου 12','Άγιος Νικόλαος',35.1885,25.7150,
  '+302841022001','marina@example.com','marina@example.com','+306900000001',2.50,12.00,35.00,35,8,20,25,5,
  true,true,true,4.8,214,true,true),
 ('Souvlaki Corner','souvlaki-corner','Σουβλάκι, γύρος και μερίδες όλη μέρα','restaurant',
  ARRAY['σουβλάκι','γύρος','fast food'],'Ρούσου Καπετανάκη 5','Άγιος Νικόλαος',35.1901,25.7180,
  '+302841022002','souvlaki@example.com','souvlaki@example.com','+306900000002',1.50,8.00,25.00,25,10,20,15,10,
  true,true,false,4.6,489,true,true),
 ('Pizza Napoli','pizza-napoli','Ναπολιτάνικη πίτσα σε ξυλόφουρνο','pizza',
  ARRAY['πίτσα','ιταλική','ζυμαρικά'],'Λεωφ. Ελευθερίου Βενιζέλου 40','Άγιος Νικόλαος',35.1930,25.7120,
  '+302841022003','napoli@example.com','napoli@example.com','+306900000003',2.00,10.00,30.00,30,12,25,20,0,
  true,true,false,4.5,331,true,true),
 ('Blue Bay Café','blue-bay-cafe','Καφές specialty, brunch και γλυκά','cafe',
  ARRAY['καφές','brunch','γλυκά'],'Ακτή Ατλαντίδος 3','Άγιος Νικόλαος',35.1875,25.7195,
  '+302841022004','bluebay@example.com','bluebay@example.com','+306900000004',1.80,6.00,NULL,20,6,15,10,15,
  true,true,false,4.7,158,true,true),
 ('Mini Market Κρητικός','mini-market-kritikos','Σούπερ μάρκετ γειτονιάς — παραδόσεις καθημερινά','supermarket',
  ARRAY['σούπερ μάρκετ','τρόφιμα'],'Επιμενίδου 18','Άγιος Νικόλαος',35.1950,25.7100,
  '+302841022005','market@example.com','market@example.com','+306900000005',2.20,15.00,40.00,45,15,20,30,0,
  true,true,false,4.4,96,true,true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO store_zones (store_id, name, area, city, postal_code, delivery_fee, min_order, extra_minutes, free_above, sort_order)
SELECT s.id, z.name, z.area, z.city, z.pc, z.fee, z.mo, z.extra, z.fa, z.so
FROM stores s
JOIN (VALUES
  ('taverna-marina','Άγιος Νικόλαος - Κέντρο','Άγιος Νικόλαος','Άγιος Νικόλαος','72100',2.00,12.00,0,35.00,1),
  ('taverna-marina','Ελούντα','Ελούντα','Ελούντα','72053',4.50,25.00,15,60.00,2),
  ('souvlaki-corner','Άγιος Νικόλαος - Κέντρο','Άγιος Νικόλαος','Άγιος Νικόλαος','72100',1.50,8.00,0,25.00,1),
  ('souvlaki-corner','Ελούντα','Ελούντα','Ελούντα','72053',3.50,18.00,15,45.00,2),
  ('souvlaki-corner','Καλό Χωριό','Καλό Χωριό','Καλό Χωριό','72100',4.00,20.00,20,NULL,3),
  ('pizza-napoli','Άγιος Νικόλαος - Κέντρο','Άγιος Νικόλαος','Άγιος Νικόλαος','72100',2.00,10.00,0,30.00,1),
  ('pizza-napoli','Ελούντα','Ελούντα','Ελούντα','72053',4.00,22.00,15,50.00,2),
  ('blue-bay-cafe','Άγιος Νικόλαος - Κέντρο','Άγιος Νικόλαος','Άγιος Νικόλαος','72100',1.80,6.00,0,NULL,1),
  ('mini-market-kritikos','Άγιος Νικόλαος - Κέντρο','Άγιος Νικόλαος','Άγιος Νικόλαος','72100',2.20,15.00,0,40.00,1),
  ('mini-market-kritikos','Ελούντα','Ελούντα','Ελούντα','72053',5.00,30.00,20,70.00,2)
) AS z(slug,name,area,city,pc,fee,mo,extra,fa,so) ON z.slug = s.slug
WHERE NOT EXISTS (SELECT 1 FROM store_zones sz WHERE sz.store_id = s.id AND sz.name = z.name);

INSERT INTO properties (code, name, type, owner_name, contact_phone, whatsapp, address, city, area,
  postal_code, lat, lng, floor, doorbell, access_notes, welcome_message, billing_mode, billing_value, billing_direction)
VALUES
 ('AEGEAN1','Villa Aegean Blue','villa','Γιώργος Σ.','+306900000010','+306900000010',
  'Οδός Σχίσμα 14, Ελούντα','Ελούντα','Ελούντα','72053',35.2600,25.7220,NULL,'Aegean Blue',
  'Λευκή πύλη στα δεξιά μετά το ξενοδοχείο. Parking μέσα.',
  'Καλώς ήρθατε στη Villa Aegean Blue! Παραγγείλτε φαγητό απευθείας στη βίλα.','inherit',0,'inherit'),
 ('SUNSET2A','Sunset Apartment 2A','apartment','Μαρία Κ.','+306900000011','+306900000011',
  'Ρούσου Καπετανάκη 22, Άγιος Νικόλαος','Άγιος Νικόλαος','Άγιος Νικόλαος','72100',35.1890,25.7160,'2ος','Kapetanaki 2A',
  'Κουδούνι 2Α, ασανσέρ στο βάθος.','Καλώς ήρθατε! Δείτε τι παραδίδει στη γειτονιά μας.','inherit',0,'inherit'),
 ('OLIVE3','Villa Olive Grove','villa','Νίκος Π.','+306900000012','+306900000012',
  'Επαρχιακή Οδός Καλού Χωριού 5','Καλό Χωριό','Καλό Χωριό','72100',35.1600,25.8000,NULL,'Olive Grove',
  'Χωματόδρομος 200μ μετά το εκκλησάκι.','Καλή διαμονή! Delivery & take away κοντά σας.','commission',8.00,'payout')
ON CONFLICT (code) DO NOTHING;

INSERT INTO menu_categories (store_id, name, sort_order)
SELECT s.id, c.name, c.so FROM stores s
JOIN (VALUES
 ('taverna-marina','Ορεκτικά',1),('taverna-marina','Θαλασσινά',2),('taverna-marina','Κυρίως',3),('taverna-marina','Σαλάτες',4),('taverna-marina','Ποτά',5),
 ('souvlaki-corner','Πίτες',1),('souvlaki-corner','Μερίδες',2),('souvlaki-corner','Ορεκτικά',3),('souvlaki-corner','Αναψυκτικά',4),
 ('pizza-napoli','Πίτσες',1),('pizza-napoli','Ζυμαρικά',2),('pizza-napoli','Σαλάτες',3),('pizza-napoli','Ποτά',4),
 ('blue-bay-cafe','Καφέδες',1),('blue-bay-cafe','Brunch',2),('blue-bay-cafe','Γλυκά',3),
 ('mini-market-kritikos','Βασικά',1),('mini-market-kritikos','Ποτά & Αναψυκτικά',2),('mini-market-kritikos','Σνακ',3)
) AS c(slug,name,so) ON c.slug = s.slug
WHERE NOT EXISTS (SELECT 1 FROM menu_categories mc WHERE mc.store_id = s.id AND mc.name = c.name);

INSERT INTO menu_items (store_id, category_id, name, description, price, emoji, is_popular, is_vegetarian, sort_order)
SELECT s.id, mc.id, i.name, i.descr, i.price, i.emoji, i.pop, i.veg, i.so
FROM stores s
JOIN (VALUES
 ('taverna-marina','Ορεκτικά','Ντάκος Κρήτης','Παξιμάδι, ντομάτα, ξινομυζήθρα, ρίγανη',6.50,'🍅',true,true,1),
 ('taverna-marina','Ορεκτικά','Τζατζίκι','Στραγγιστό γιαούρτι, αγγούρι, σκόρδο',4.50,'🥒',false,true,2),
 ('taverna-marina','Ορεκτικά','Καλιτσούνια','Τυρένια κρητικά πιτάκια (4τμχ)',7.00,'🥟',true,true,3),
 ('taverna-marina','Θαλασσινά','Καλαμαράκια τηγανητά','Φρέσκα, με λεμόνι',12.50,'🦑',true,false,4),
 ('taverna-marina','Θαλασσινά','Χταπόδι ξιδάτο','Στη σχάρα με ξίδι και ρίγανη',14.00,'🐙',true,false,5),
 ('taverna-marina','Κυρίως','Αρνί αντικριστό','Παραδοσιακό κρητικό, μερίδα',18.50,'🍖',true,false,6),
 ('taverna-marina','Κυρίως','Μουσακάς','Σπιτικός, με κρέμα',11.00,'🍆',false,false,7),
 ('taverna-marina','Σαλάτες','Χωριάτικη','Ντομάτα, αγγούρι, φέτα, ελιές',8.50,'🥗',false,true,8),
 ('taverna-marina','Ποτά','Κρασί χύμα 500ml','Λευκό ή κόκκινο',7.00,'🍷',false,true,9),
 ('taverna-marina','Ποτά','Νερό 1.5L','',1.00,'💧',false,true,10),
 ('souvlaki-corner','Πίτες','Πίτα γύρο χοιρινό','Πατάτες, ντομάτα, κρεμμύδι, τζατζίκι',4.20,'🌯',true,false,1),
 ('souvlaki-corner','Πίτες','Πίτα γύρο κοτόπουλο','Πατάτες, ντομάτα, κρεμμύδι, σως γιαουρτιού',4.40,'🌯',true,false,2),
 ('souvlaki-corner','Πίτες','Πίτα σουβλάκι χοιρινό','Καλαμάκι, πατάτες, τζατζίκι',4.00,'🍢',true,false,3),
 ('souvlaki-corner','Πίτες','Πίτα λαχανικών','Ψητά λαχανικά, τζατζίκι',3.80,'🥬',false,true,4),
 ('souvlaki-corner','Μερίδες','Μερίδα γύρο χοιρινό','450γρ με πατάτες και πίτα',11.50,'🍽️',true,false,5),
 ('souvlaki-corner','Μερίδες','Μπιφτέκι σχάρας','Με πατάτες τηγανητές',9.50,'🍔',false,false,6),
 ('souvlaki-corner','Ορεκτικά','Πατάτες τηγανητές','Φρέσκιες, με ρίγανη',3.50,'🍟',true,true,7),
 ('souvlaki-corner','Ορεκτικά','Τζατζίκι','Μερίδα',3.00,'🥒',false,true,8),
 ('souvlaki-corner','Αναψυκτικά','Coca-Cola 330ml','',1.80,'🥤',false,true,9),
 ('souvlaki-corner','Αναψυκτικά','Νερό 500ml','',0.60,'💧',false,true,10),
 ('pizza-napoli','Πίτσες','Margherita','Ντομάτα, μοτσαρέλα, βασιλικός',9.50,'🍕',true,true,1),
 ('pizza-napoli','Πίτσες','Prosciutto e Funghi','Ζαμπόν, μανιτάρια, μοτσαρέλα',12.00,'🍕',true,false,2),
 ('pizza-napoli','Πίτσες','Diavola','Πικάντικο σαλάμι, μοτσαρέλα',12.50,'🌶️',true,false,3),
 ('pizza-napoli','Πίτσες','Quattro Formaggi','Τέσσερα τυριά',13.00,'🧀',false,true,4),
 ('pizza-napoli','Ζυμαρικά','Carbonara','Guanciale, αυγό, pecorino',11.50,'🍝',true,false,5),
 ('pizza-napoli','Ζυμαρικά','Penne Arrabbiata','Πικάντικη σάλτσα ντομάτας',9.50,'🍝',false,true,6),
 ('pizza-napoli','Σαλάτες','Caprese','Ντομάτα, μοτσαρέλα, βασιλικός',9.00,'🥗',false,true,7),
 ('pizza-napoli','Ποτά','Peroni 330ml','',3.50,'🍺',false,true,8),
 ('blue-bay-cafe','Καφέδες','Espresso','Single ή double',2.20,'☕',true,true,1),
 ('blue-bay-cafe','Καφέδες','Freddo Cappuccino','',3.50,'🧊',true,true,2),
 ('blue-bay-cafe','Καφέδες','Filter V60','Specialty single origin',4.00,'☕',false,true,3),
 ('blue-bay-cafe','Brunch','Avocado Toast','Ψωμί προζύμης, αβοκάντο, αυγό ποσέ',9.50,'🥑',true,true,4),
 ('blue-bay-cafe','Brunch','Pancakes','Με σιρόπι σφενδάμου και φρούτα',8.00,'🥞',true,true,5),
 ('blue-bay-cafe','Brunch','Club Sandwich','Κοτόπουλο, μπέικον, πατάτες',9.00,'🥪',false,false,6),
 ('blue-bay-cafe','Γλυκά','Cheesecake','Φράουλα ή σοκολάτα',5.50,'🍰',false,true,7),
 ('blue-bay-cafe','Γλυκά','Μπουγάτσα','Κρέμα, ζάχαρη άχνη',4.00,'🥐',false,true,8),
 ('mini-market-kritikos','Βασικά','Ψωμί χωριάτικο 500γρ','',1.80,'🍞',true,true,1),
 ('mini-market-kritikos','Βασικά','Γάλα φρέσκο 1L','',1.60,'🥛',true,true,2),
 ('mini-market-kritikos','Βασικά','Αυγά 6τμχ','',2.90,'🥚',false,true,3),
 ('mini-market-kritikos','Βασικά','Φέτα ΠΟΠ 400γρ','',5.50,'🧀',false,true,4),
 ('mini-market-kritikos','Ποτά & Αναψυκτικά','Νερό 6x1.5L','',2.40,'💧',true,true,5),
 ('mini-market-kritikos','Ποτά & Αναψυκτικά','Μπύρα Mythos 6x330ml','',6.50,'🍺',true,true,6),
 ('mini-market-kritikos','Ποτά & Αναψυκτικά','Χυμός πορτοκάλι 1L','',2.20,'🧃',false,true,7),
 ('mini-market-kritikos','Σνακ','Πατατάκια 130γρ','',2.10,'🥔',false,true,8),
 ('mini-market-kritikos','Σνακ','Παγωτό οικογενειακό','',4.80,'🍨',false,true,9)
) AS i(slug,cat,name,descr,price,emoji,pop,veg,so) ON i.slug = s.slug
JOIN menu_categories mc ON mc.store_id = s.id AND mc.name = i.cat
WHERE NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.store_id = s.id AND m.name = i.name);

-- Extras on the pita items, to exercise modifier pricing end to end
INSERT INTO item_modifier_groups (item_id, name, is_required, min_select, max_select, sort_order)
SELECT mi.id, 'Extras', false, 0, 5, 1 FROM menu_items mi
JOIN stores s ON s.id = mi.store_id AND s.slug = 'souvlaki-corner'
WHERE mi.name LIKE 'Πίτα%'
  AND NOT EXISTS (SELECT 1 FROM item_modifier_groups g WHERE g.item_id = mi.id AND g.name = 'Extras');

INSERT INTO item_modifiers (group_id, name, price, sort_order)
SELECT g.id, m.name, m.price, m.so FROM item_modifier_groups g
JOIN menu_items mi ON mi.id = g.item_id
JOIN stores s ON s.id = mi.store_id AND s.slug = 'souvlaki-corner'
JOIN (VALUES ('Έξτρα τζατζίκι',0.50,1),('Έξτρα πατάτες',0.70,2),('Τυρί φέτα',0.80,3),('Χωρίς κρεμμύδι',0.00,4),('Καυτερή σως',0.30,5))
  AS m(name,price,so) ON true
WHERE g.name = 'Extras'
  AND NOT EXISTS (SELECT 1 FROM item_modifiers im WHERE im.group_id = g.id AND im.name = m.name);
