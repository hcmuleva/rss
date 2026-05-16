-- Demo seed for RSS hierarchy and assignments
-- DB: host=localhost port=5432 dbname=rss user=postgres password=postgres
-- All demo user passwords are: welcome

BEGIN;

-- 1) Clean old demo rows only
DELETE FROM module_assignments WHERE id LIKE 'demo-asg-%';
DELETE FROM activities WHERE id LIKE 'demo-act-%';
DELETE FROM project_tasks WHERE id LIKE 'demo-proj-%';
DELETE FROM ayam_entries WHERE id LIKE 'demo-ayam-%';
DELETE FROM master_lists WHERE id LIKE 'demo-ml-%';
DELETE FROM users WHERE id LIKE 'demo-u-%' OR id = 'hcm1222';
DELETE FROM hierarchy_nodes WHERE id LIKE 'demo-h-%';

-- 1.1) Demo master list values for Project assignment key dropdown
INSERT INTO master_lists (id, list_type, name_hi, name_en) VALUES
('demo-ml-proj-edu', 'ProjectCategories', 'शिक्षा', 'Education'),
('demo-ml-proj-it', 'ProjectCategories', 'आईटी', 'IT'),
('demo-ml-proj-stich', 'ProjectCategories', 'सिलाई', 'Stiching')
ON CONFLICT (id) DO UPDATE SET
  list_type = EXCLUDED.list_type,
  name_hi = EXCLUDED.name_hi,
  name_en = EXCLUDED.name_en;

-- 2) Hierarchy (L1 -> L5A3/L5B3)
INSERT INTO hierarchy_nodes (id, name_hi, name_en, level, branch, parent_id, address, address_details, lat, long) VALUES
('demo-h-l1-1', 'मालवा प्रांत', 'Malwa Prant', 'PRANT', 'rural', NULL, 'Madhya Pradesh', NULL, 23.1765, 75.7885),

('demo-h-l2-ujj', 'उज्जैन संभाग', 'Ujjain Sambhag', 'SAMBHAG', 'rural', 'demo-h-l1-1', 'Ujjain Division', NULL, 23.1765, 75.7885),
('demo-h-l2-ind', 'इंदौर संभाग', 'Indore Sambhag', 'SAMBHAG', 'rural', 'demo-h-l1-1', 'Indore Division', NULL, 22.7196, 75.8577),

('demo-h-l3-ujj-seva', 'सेवा विभाग', 'Seva Vibhag', 'VIBHAG', 'rural', 'demo-h-l2-ujj', 'Ujjain Seva', NULL, 23.1765, 75.7885),
('demo-h-l3-ujj-sampark', 'संपर्क विभाग', 'Sampark Vibhag', 'VIBHAG', 'rural', 'demo-h-l2-ujj', 'Ujjain Sampark', NULL, 23.2000, 75.9000),
('demo-h-l3-ind-dharma', 'धर्म विभाग', 'Dharma Vibhag', 'VIBHAG', 'rural', 'demo-h-l2-ind', 'Indore Dharma', NULL, 22.8000, 75.9000),
('demo-h-l3-ind-sangathan', 'संगठन विभाग', 'Sangathan Vibhag', 'VIBHAG', 'rural', 'demo-h-l2-ind', 'Indore Sangathan', NULL, 22.6000, 75.6000),

('demo-h-l4-ujj', 'उज्जैन जिला', 'Ujjain Jila', 'DISTRICT', 'rural', 'demo-h-l3-ujj-seva', 'Ujjain', NULL, 23.1765, 75.7885),
('demo-h-l4-dewas', 'देवास जिला', 'Dewas Jila', 'DISTRICT', 'rural', 'demo-h-l3-ujj-sampark', 'Dewas', NULL, 22.9676, 76.0534),
('demo-h-l4-indore', 'इंदौर जिला', 'Indore Jila', 'DISTRICT', 'rural', 'demo-h-l3-ind-dharma', 'Indore', NULL, 22.7196, 75.8577),
('demo-h-l4-dhar', 'धार जिला', 'Dhar Jila', 'DISTRICT', 'rural', 'demo-h-l3-ind-sangathan', 'Dhar', NULL, 22.6013, 75.3025),

('demo-h-l5a1-ind', 'देपालपुर खंड', 'Depalpur Khand', 'KHAND', 'rural', 'demo-h-l4-indore', 'Depalpur', NULL, 22.8501, 75.5422),
('demo-h-l5a2-ind', 'सांवेर मंडल', 'Sanwer Mandal', 'MANDAL', 'rural', 'demo-h-l5a1-ind', 'Sanwer', NULL, 22.9734, 75.8278),
('demo-h-l5a3-ind', 'बिछोली ग्राम', 'Bicholi Gram', 'GRAM', 'rural', 'demo-h-l5a2-ind', 'Bicholi', NULL, 22.6983, 75.9054),
('demo-h-l5b1-ind', 'इंदौर नगर', 'Indore Nagar', 'NAGAR', 'urban', 'demo-h-l4-indore', 'Indore City', NULL, 22.7196, 75.8577),
('demo-h-l5b2-ind', 'राजवाड़ा बस्ती', 'Rajwada Basti', 'BASTI', 'urban', 'demo-h-l5b1-ind', 'Rajwada', NULL, 22.7178, 75.8545),
('demo-h-l5b3-ind', 'नंदलालपुरा मोहल्ला', 'Nandlalpura Mohalla', 'MOHALLA', 'urban', 'demo-h-l5b2-ind', 'Nandlalpura', NULL, 22.7128, 75.8477),

('demo-h-l5a1-ujj', 'घट्टिया खंड', 'Ghattiya Khand', 'KHAND', 'rural', 'demo-h-l4-ujj', 'Ghattiya', NULL, 23.2885, 75.9223),
('demo-h-l5a2-ujj', 'तराना मंडल', 'Tarana Mandal', 'MANDAL', 'rural', 'demo-h-l5a1-ujj', 'Tarana', NULL, 23.3308, 76.0437),
('demo-h-l5a3-ujj', 'कचनारिया ग्राम', 'Kachnariya Gram', 'GRAM', 'rural', 'demo-h-l5a2-ujj', 'Kachnariya', NULL, 23.3020, 76.0500),
('demo-h-l5b1-ujj', 'उज्जैन नगर', 'Ujjain Nagar', 'NAGAR', 'urban', 'demo-h-l4-ujj', 'Ujjain City', NULL, 23.1765, 75.7885),
('demo-h-l5b2-ujj', 'फ्रीगंज बस्ती', 'Freeganj Basti', 'BASTI', 'urban', 'demo-h-l5b1-ujj', 'Freeganj', NULL, 23.1802, 75.7849),
('demo-h-l5b3-ujj', 'रामघाट मोहल्ला', 'Ramghat Mohalla', 'MOHALLA', 'urban', 'demo-h-l5b2-ujj', 'Ramghat', NULL, 23.1811, 75.7684)
ON CONFLICT (id) DO UPDATE SET
  name_hi = EXCLUDED.name_hi,
  name_en = EXCLUDED.name_en,
  level = EXCLUDED.level,
  branch = EXCLUDED.branch,
  parent_id = EXCLUDED.parent_id,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  long = EXCLUDED.long;

-- 3) Users (members at every level) - all passwords are welcome
INSERT INTO users (id, name, phone, password, role, assigned_node_id, photo_url, is_active, is_full_time) VALUES
('demo-u-sa', 'MaheshSharma_L1_MalwaPrant', '9000000001', 'welcome', 'SUPER_ADMIN', 'demo-h-l1-1', 'https://i.pravatar.cc/150?img=11', TRUE, FALSE),
('demo-u-prant-admin', 'RaghavJoshi_L1_MalwaPrant', '9000000002', 'welcome', 'ADMIN', 'demo-h-l1-1', 'https://i.pravatar.cc/150?img=12', TRUE, FALSE),

('demo-u-ujj-admin', 'VikramPurohit_L2_UjjainSambhag', '9000000003', 'welcome', 'ADMIN', 'demo-h-l2-ujj', 'https://i.pravatar.cc/150?img=13', TRUE, FALSE),
('demo-u-ind-admin', 'AnirudhTrivedi_L2_IndoreSambhag', '9000000004', 'welcome', 'ADMIN', 'demo-h-l2-ind', 'https://i.pravatar.cc/150?img=14', TRUE, FALSE),

('demo-u-l3-ujj-seva', 'SureshPandey_L3_SevaVibhag', '9000000005', 'welcome', 'USER', 'demo-h-l3-ujj-seva', 'https://i.pravatar.cc/150?img=15', TRUE, FALSE),
('demo-u-l3-ujj-sampark', 'DineshShukla_L3_SamparkVibhag', '9000000006', 'welcome', 'USER', 'demo-h-l3-ujj-sampark', 'https://i.pravatar.cc/150?img=16', TRUE, FALSE),
('hcm1222', 'HarshVyas_L3_DharmaVibhag', '9000000007', 'welcome', 'USER', 'demo-h-l3-ind-dharma', 'https://i.pravatar.cc/150?img=17', TRUE, FALSE),
('demo-u-l3-ind-sangathan', 'PrakashDubey_L3_SangathanVibhag', '9000000008', 'welcome', 'USER', 'demo-h-l3-ind-sangathan', 'https://i.pravatar.cc/150?img=18', TRUE, FALSE),

('demo-u-l4-ujj', 'RameshParmar_L4_UjjainJila', '9000000009', 'welcome', 'USER', 'demo-h-l4-ujj', 'https://i.pravatar.cc/150?img=19', TRUE, FALSE),
('demo-u-l4-dewas', 'LokeshPatidar_L4_DewasJila', '9000000010', 'welcome', 'USER', 'demo-h-l4-dewas', 'https://i.pravatar.cc/150?img=20', TRUE, FALSE),
('demo-u-l4-indore', 'AjayChouhan_L4_IndoreJila', '9000000011', 'welcome', 'USER', 'demo-h-l4-indore', 'https://i.pravatar.cc/150?img=21', TRUE, FALSE),
('demo-u-l4-dhar', 'NitinSolanki_L4_DharJila', '9000000012', 'welcome', 'USER', 'demo-h-l4-dhar', 'https://i.pravatar.cc/150?img=22', TRUE, FALSE),

('demo-u-l5a1-ind', 'KailashSisodiya_L5a1_DepalpurKhand', '9000000013', 'welcome', 'USER', 'demo-h-l5a1-ind', 'https://i.pravatar.cc/150?img=23', TRUE, FALSE),
('demo-u-l5a2-ind', 'GopalMishra_L5a2_SanwerMandal', '9000000014', 'welcome', 'USER', 'demo-h-l5a2-ind', 'https://i.pravatar.cc/150?img=24', TRUE, FALSE),
('demo-u-l5a3-ind', 'MohanPrajapati_L5a3_BicholiGram', '9000000015', 'welcome', 'USER', 'demo-h-l5a3-ind', 'https://i.pravatar.cc/150?img=25', TRUE, FALSE),
('demo-u-l5b1-ind', 'RohitTiwari_L5b1_IndoreNagar', '9000000016', 'welcome', 'USER', 'demo-h-l5b1-ind', 'https://i.pravatar.cc/150?img=26', TRUE, FALSE),
('demo-u-l5b2-ind', 'BhaveshYadav_L5b2_RajwadaBasti', '9000000017', 'welcome', 'USER', 'demo-h-l5b2-ind', 'https://i.pravatar.cc/150?img=27', TRUE, FALSE),
('demo-u-l5b3-ind', 'HemantBairagi_L5b3_NandlalpuraMohalla', '9000000018', 'welcome', 'USER', 'demo-h-l5b3-ind', 'https://i.pravatar.cc/150?img=28', TRUE, FALSE),
('demo-u-l5b3-ujj', 'SunilSharma_L5b3_RamghatMohalla', '9000000019', 'welcome', 'USER', 'demo-h-l5b3-ujj', 'https://i.pravatar.cc/150?img=29', TRUE, FALSE),

('demo-u-l5a1-ujj', 'BhanuTomar_L5a1_GhattiyaKhand', '9000000020', 'welcome', 'USER', 'demo-h-l5a1-ujj', 'https://i.pravatar.cc/150?img=30', TRUE, FALSE),
('demo-u-l5a2-ujj', 'UmeshJat_L5a2_TaranaMandal', '9000000021', 'welcome', 'USER', 'demo-h-l5a2-ujj', 'https://i.pravatar.cc/150?img=31', TRUE, FALSE),
('demo-u-l5a3-ujj', 'RaviGurjar_L5a3_KachnariyaGram', '9000000022', 'welcome', 'USER', 'demo-h-l5a3-ujj', 'https://i.pravatar.cc/150?img=32', TRUE, FALSE),
('demo-u-l5b1-ujj', 'PankajMaheshwari_L5b1_UjjainNagar', '9000000023', 'welcome', 'USER', 'demo-h-l5b1-ujj', 'https://i.pravatar.cc/150?img=33', TRUE, FALSE),
('demo-u-l5b2-ujj', 'SanjayDixit_L5b2_FreeganjBasti', '9000000024', 'welcome', 'USER', 'demo-h-l5b2-ujj', 'https://i.pravatar.cc/150?img=34', TRUE, FALSE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  assigned_node_id = EXCLUDED.assigned_node_id,
  photo_url = EXCLUDED.photo_url,
  is_active = EXCLUDED.is_active,
  is_full_time = EXCLUDED.is_full_time;

-- 4) Module assignments (users in Indore-Dharma subtree include hcm1222)
INSERT INTO module_assignments (id, module_type, assignment_key, node_id, assigned_user_ids) VALUES
('demo-asg-1', 'Activities', 'DailyVisits', 'demo-h-l4-indore', ARRAY['hcm1222','demo-u-l4-indore','demo-u-l5a1-ind']),
('demo-asg-2', 'Project', 'EducationDrive', 'demo-h-l5a2-ind', ARRAY['hcm1222','demo-u-l5a2-ind','demo-u-l5a3-ind']),
('demo-asg-3', 'Ayam', 'MatraShakti', 'demo-h-l5b2-ind', ARRAY['hcm1222','demo-u-l5b2-ind','demo-u-l5b3-ind']),
('demo-asg-4', 'Activities', 'UjjainUrbanCheck', 'demo-h-l5b1-ujj', ARRAY['demo-u-l3-ujj-seva','demo-u-l4-ujj','demo-u-l5b3-ujj'])
ON CONFLICT (module_type, assignment_key, node_id) DO UPDATE SET
  assigned_user_ids = EXCLUDED.assigned_user_ids;

-- 5) Activities (hcm1222 sees only entries where assigned)
INSERT INTO activities (
  id, node_id, category, date, description,
  male_old, male_young, male_kids, female_old, female_young, female_kids,
  assigned_user_ids, media_urls
) VALUES
('demo-act-1', 'demo-h-l4-indore', 'Baithak', '2026-05-01', 'L4 coordination meeting at Indore Jila', 3, 7, 4, 2, 6, 3, ARRAY['hcm1222','demo-u-l4-indore'], ARRAY[]::text[]),
('demo-act-2', 'demo-h-l5a3-ind', 'Gram Sabha', '2026-05-03', 'Village outreach in Bicholi Gram', 4, 9, 6, 3, 8, 5, ARRAY['hcm1222','demo-u-l5a3-ind'], ARRAY[]::text[]),
('demo-act-3', 'demo-h-l5b3-ind', 'Mohalla Samanvay', '2026-05-06', 'Urban mohalla coordination', 2, 8, 3, 2, 7, 4, ARRAY['hcm1222','demo-u-l5b3-ind'], ARRAY[]::text[]),
('demo-act-4', 'demo-h-l4-dhar', 'Dhar Camp', '2026-05-07', 'Outside Dharma subtree (should not be visible to hcm1222)', 2, 5, 2, 2, 4, 1, ARRAY['demo-u-l4-dhar'], ARRAY[]::text[])
ON CONFLICT (id) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  category = EXCLUDED.category,
  date = EXCLUDED.date,
  description = EXCLUDED.description,
  male_old = EXCLUDED.male_old,
  male_young = EXCLUDED.male_young,
  male_kids = EXCLUDED.male_kids,
  female_old = EXCLUDED.female_old,
  female_young = EXCLUDED.female_young,
  female_kids = EXCLUDED.female_kids,
  assigned_user_ids = EXCLUDED.assigned_user_ids,
  media_urls = EXCLUDED.media_urls;

-- 6) Project tasks
INSERT INTO project_tasks (
  id, project_category, task_name, status, date, description, assigned_user_ids, media_urls
) VALUES
('demo-proj-1', 'Education', 'Tuition mapping in Indore rural belt', 'InProgress', '2026-05-04', 'Map students in Sanwer and Bicholi', ARRAY['hcm1222','demo-u-l5a2-ind','demo-u-l5a3-ind'], ARRAY[]::text[]),
('demo-proj-2', 'Seva', 'Health camp Rajwada basti', 'Assigned', '2026-05-05', 'Prepare volunteers and beneficiary list', ARRAY['hcm1222','demo-u-l5b2-ind'], ARRAY[]::text[]),
('demo-proj-3', 'Organization', 'Dhar volunteer sync', 'Assigned', '2026-05-08', 'Task belongs to Dhar subtree', ARRAY['demo-u-l4-dhar'], ARRAY[]::text[]),
('demo-proj-4', 'Leadership', 'Prant strategy review', 'InProgress', '2026-05-09', 'Monthly prant review task', ARRAY['demo-u-prant-admin'], ARRAY[]::text[]),
('demo-proj-5', 'Coordination', 'Ujjain Sambhag outreach', 'Assigned', '2026-05-10', 'Sambhag level outreach planning', ARRAY['demo-u-ujj-admin'], ARRAY[]::text[]),
('demo-proj-6', 'Coordination', 'Indore Sambhag planning', 'Assigned', '2026-05-10', 'Sambhag level meeting planning', ARRAY['demo-u-ind-admin'], ARRAY[]::text[]),
('demo-proj-7', 'Seva', 'Seva Vibhag volunteer list', 'InProgress', '2026-05-11', 'Create active volunteer roster', ARRAY['demo-u-l3-ujj-seva'], ARRAY[]::text[]),
('demo-proj-8', 'Operations', 'Ujjain Jila ward mapping', 'Assigned', '2026-05-11', 'District ward segmentation', ARRAY['demo-u-l4-ujj'], ARRAY[]::text[]),
('demo-proj-9', 'Rural', 'Depalpur khand household survey', 'InProgress', '2026-05-12', 'Survey khand level families', ARRAY['demo-u-l5a1-ind'], ARRAY[]::text[]),
('demo-proj-10', 'Urban', 'Indore Nagar booth mapping', 'Assigned', '2026-05-12', 'Urban booth geo tagging', ARRAY['demo-u-l5b1-ind'], ARRAY[]::text[]),
('demo-proj-11', 'Urban', 'Nandlalpura mohalla roster', 'Assigned', '2026-05-13', 'Mohalla volunteer roster build', ARRAY['demo-u-l5b3-ind'], ARRAY[]::text[]),
('demo-proj-12', 'Vibhag', 'Sangathan process audit', 'InProgress', '2026-05-13', 'Audit sangathan workflows', ARRAY['demo-u-l3-ind-sangathan'], ARRAY[]::text[]),
('demo-proj-13', 'CrossLevel', 'Cross level assignment matrix', 'Assigned', '2026-05-14', 'Ensures each seeded user has at least one project assignment', ARRAY[
  'demo-u-sa','demo-u-prant-admin','demo-u-ujj-admin','demo-u-ind-admin','demo-u-l3-ujj-seva','demo-u-l3-ujj-sampark','hcm1222','demo-u-l3-ind-sangathan',
  'demo-u-l4-ujj','demo-u-l4-dewas','demo-u-l4-indore','demo-u-l4-dhar','demo-u-l5a1-ind','demo-u-l5a2-ind','demo-u-l5a3-ind','demo-u-l5b1-ind',
  'demo-u-l5b2-ind','demo-u-l5b3-ind','demo-u-l5b3-ujj','demo-u-l5a1-ujj','demo-u-l5a2-ujj','demo-u-l5a3-ujj','demo-u-l5b1-ujj','demo-u-l5b2-ujj'
], ARRAY[]::text[])
ON CONFLICT (id) DO UPDATE SET
  project_category = EXCLUDED.project_category,
  task_name = EXCLUDED.task_name,
  status = EXCLUDED.status,
  date = EXCLUDED.date,
  description = EXCLUDED.description,
  assigned_user_ids = EXCLUDED.assigned_user_ids,
  media_urls = EXCLUDED.media_urls;

-- 7) Ayam entries
INSERT INTO ayam_entries (
  id, sub_category, node_id, description, worked_for, who_worked, date, assigned_user_ids, media_urls, document_urls
) VALUES
('demo-ayam-1', 'MatraShakti', 'demo-h-l5b2-ind', 'MatraShakti workshop at Rajwada Basti', 'Women Self Help Group', 'Local team + hcm1222', '2026-05-02', ARRAY['hcm1222','demo-u-l5b2-ind'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-2', 'Vidhi Aayam', 'demo-h-l5a1-ind', 'Legal awareness in Depalpur', 'Village committee', 'Legal cell', '2026-05-03', ARRAY['hcm1222','demo-u-l5a1-ind'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-3', 'Sanskriti', 'demo-h-l5b3-ujj', 'Cultural event in Ramghat Mohalla', 'Local residents', 'Ujjain team', '2026-05-09', ARRAY['demo-u-l3-ujj-seva','demo-u-l5b3-ujj'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-4', 'Vidhi Aayam', 'demo-h-l1-1', 'Prant legal and policy briefing', 'Prant team', 'demo-u-prant-admin', '2026-05-10', ARRAY['demo-u-prant-admin'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-5', 'Sanskriti', 'demo-h-l2-ujj', 'Ujjain sambhag sanskriti samvad', 'Sambhag workers', 'demo-u-ujj-admin', '2026-05-10', ARRAY['demo-u-ujj-admin'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-6', 'MatraShakti', 'demo-h-l2-ind', 'Indore sambhag matra shakti baithak', 'Women coordinators', 'demo-u-ind-admin', '2026-05-10', ARRAY['demo-u-ind-admin'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-7', 'Sanskriti', 'demo-h-l3-ujj-seva', 'Seva vibhag cultural connect', 'Vibhag members', 'demo-u-l3-ujj-seva', '2026-05-11', ARRAY['demo-u-l3-ujj-seva'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-8', 'Nidhi', 'demo-h-l4-ujj', 'Ujjain jila nidhi follow-up', 'District donors', 'demo-u-l4-ujj', '2026-05-11', ARRAY['demo-u-l4-ujj'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-9', 'Vidhi Aayam', 'demo-h-l5a1-ind', 'Khand legal awareness round 2', 'Khand committee', 'demo-u-l5a1-ind', '2026-05-12', ARRAY['demo-u-l5a1-ind'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-10', 'MatraShakti', 'demo-h-l5b1-ind', 'Nagar matra shakti mobilization', 'Urban women group', 'demo-u-l5b1-ind', '2026-05-12', ARRAY['demo-u-l5b1-ind'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-11', 'Sanskriti', 'demo-h-l5b3-ind', 'Mohalla sanskriti event planning', 'Mohalla families', 'demo-u-l5b3-ind', '2026-05-13', ARRAY['demo-u-l5b3-ind'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-12', 'Nidhi', 'demo-h-l3-ind-sangathan', 'Sangathan nidhi collection review', 'Vibhag donor base', 'demo-u-l3-ind-sangathan', '2026-05-13', ARRAY['demo-u-l3-ind-sangathan'], ARRAY[]::text[], ARRAY[]::text[]),
('demo-ayam-13', 'Sanskriti', 'demo-h-l1-1', 'Cross level sanskriti onboarding', 'All level workers', 'Central training team', '2026-05-14', ARRAY[
  'demo-u-sa','demo-u-prant-admin','demo-u-ujj-admin','demo-u-ind-admin','demo-u-l3-ujj-seva','demo-u-l3-ujj-sampark','hcm1222','demo-u-l3-ind-sangathan',
  'demo-u-l4-ujj','demo-u-l4-dewas','demo-u-l4-indore','demo-u-l4-dhar','demo-u-l5a1-ind','demo-u-l5a2-ind','demo-u-l5a3-ind','demo-u-l5b1-ind',
  'demo-u-l5b2-ind','demo-u-l5b3-ind','demo-u-l5b3-ujj','demo-u-l5a1-ujj','demo-u-l5a2-ujj','demo-u-l5a3-ujj','demo-u-l5b1-ujj','demo-u-l5b2-ujj'
], ARRAY[]::text[], ARRAY[]::text[])
ON CONFLICT (id) DO UPDATE SET
  sub_category = EXCLUDED.sub_category,
  node_id = EXCLUDED.node_id,
  description = EXCLUDED.description,
  worked_for = EXCLUDED.worked_for,
  who_worked = EXCLUDED.who_worked,
  date = EXCLUDED.date,
  assigned_user_ids = EXCLUDED.assigned_user_ids,
  media_urls = EXCLUDED.media_urls,
  document_urls = EXCLUDED.document_urls;

COMMIT;

-- ======================================================
-- TABLE VIEW QUERIES (run after seed)
-- ======================================================

-- A) All demo users with level and default password
SELECT
  u.id AS user_id,
  u.name AS login_name,
  u.phone,
  u.password,
  u.role,
  h.level,
  h.name_en AS assigned_level_name
FROM users u
JOIN hierarchy_nodes h ON h.id = u.assigned_node_id
WHERE u.id LIKE 'demo-u-%' OR u.id = 'hcm1222'
ORDER BY h.level, u.id;

-- B) Users visible to hcm1222 (L3 Dharma -> only L4/L5 nodes under same tree path)
WITH RECURSIVE subtree AS (
  SELECT id FROM hierarchy_nodes WHERE id = (SELECT assigned_node_id FROM users WHERE id = 'hcm1222')
  UNION ALL
  SELECT n.id
  FROM hierarchy_nodes n
  JOIN subtree s ON n.parent_id = s.id
)
SELECT
  u.id AS visible_user_id,
  u.name,
  h.level,
  h.name_en AS node_name
FROM users u
JOIN hierarchy_nodes h ON h.id = u.assigned_node_id
WHERE u.assigned_node_id IN (SELECT id FROM subtree)
ORDER BY h.level, u.id;

-- C) Work visible to hcm1222 (Project + Activities + Ayam)
SELECT 'Activities' AS source, id, node_id AS scope, category AS title, date, assigned_user_ids
FROM activities
WHERE 'hcm1222' = ANY(assigned_user_ids)
UNION ALL
SELECT 'Project' AS source, id, NULL AS scope, task_name AS title, date, assigned_user_ids
FROM project_tasks
WHERE 'hcm1222' = ANY(assigned_user_ids)
UNION ALL
SELECT 'Ayam' AS source, id, node_id AS scope, sub_category AS title, date, assigned_user_ids
FROM ayam_entries
WHERE 'hcm1222' = ANY(assigned_user_ids)
ORDER BY date, source;
