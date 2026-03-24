-- CustomCaseGuy Database Schema
-- Run this against Vercel Postgres (or Supabase)

-- Products table: case type + device combinations
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  case_type VARCHAR(50) NOT NULL,
  device_id VARCHAR(50) NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  case_name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  shopify_product_id VARCHAR(50),
  template_front VARCHAR(255),
  template_angle VARCHAR(255),
  template_lifestyle VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(case_type, device_id)
);

-- Designs table: artwork catalog
CREATE TABLE IF NOT EXISTS designs (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  collection VARCHAR(50) NOT NULL,
  tags TEXT[],
  colorway CHAR(1),
  colorway_group VARCHAR(100),
  source_file VARCHAR(255),
  visible_from VARCHAR(5),
  visible_until VARCHAR(5),
  status VARCHAR(20) DEFAULT 'active',
  featured BOOLEAN DEFAULT FALSE,
  new_until DATE,
  sort_priority INT DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mockups table: generated mockup images
CREATE TABLE IF NOT EXISTS mockups (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  design_id INT REFERENCES designs(id) ON DELETE CASCADE,
  angle VARCHAR(20) NOT NULL,
  image_url VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, design_id, angle)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_designs_collection ON designs(collection);
CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(status);
CREATE INDEX IF NOT EXISTS idx_designs_visibility ON designs(visible_from, visible_until);
CREATE INDEX IF NOT EXISTS idx_designs_featured ON designs(featured) WHERE featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_mockups_status ON mockups(status);
CREATE INDEX IF NOT EXISTS idx_mockups_design ON mockups(design_id);
CREATE INDEX IF NOT EXISTS idx_mockups_product ON mockups(product_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- Seed products for all case type + device combos
INSERT INTO products (case_type, device_id, device_name, case_name, price) VALUES
  ('symmetry', 'ip17pm', 'iPhone 17 Pro Max', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'ip17p', 'iPhone 17 Pro', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'ip17', 'iPhone 17', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'ip17a', 'iPhone 17 Air', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'ip16pm', 'iPhone 16 Pro Max', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'ip16p', 'iPhone 16 Pro', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'ip16', 'iPhone 16', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'gs25u', 'Galaxy S25 Ultra', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'gs25p', 'Galaxy S25+', 'OtterBox Symmetry', 79.99),
  ('symmetry', 'gs25', 'Galaxy S25', 'OtterBox Symmetry', 79.99),
  ('commuter', 'ip17pm', 'iPhone 17 Pro Max', 'OtterBox Commuter', 89.99),
  ('commuter', 'ip17p', 'iPhone 17 Pro', 'OtterBox Commuter', 89.99),
  ('commuter', 'ip17', 'iPhone 17', 'OtterBox Commuter', 89.99),
  ('commuter', 'ip17a', 'iPhone 17 Air', 'OtterBox Commuter', 89.99),
  ('commuter', 'ip16pm', 'iPhone 16 Pro Max', 'OtterBox Commuter', 89.99),
  ('commuter', 'ip16p', 'iPhone 16 Pro', 'OtterBox Commuter', 89.99),
  ('commuter', 'ip16', 'iPhone 16', 'OtterBox Commuter', 89.99),
  ('commuter', 'gs25u', 'Galaxy S25 Ultra', 'OtterBox Commuter', 89.99),
  ('commuter', 'gs25p', 'Galaxy S25+', 'OtterBox Commuter', 89.99),
  ('commuter', 'gs25', 'Galaxy S25', 'OtterBox Commuter', 89.99),
  ('defender', 'ip17pm', 'iPhone 17 Pro Max', 'OtterBox Defender', 99.99),
  ('defender', 'ip17p', 'iPhone 17 Pro', 'OtterBox Defender', 99.99),
  ('defender', 'ip17', 'iPhone 17', 'OtterBox Defender', 99.99),
  ('defender', 'ip17a', 'iPhone 17 Air', 'OtterBox Defender', 99.99),
  ('defender', 'ip16pm', 'iPhone 16 Pro Max', 'OtterBox Defender', 99.99),
  ('defender', 'ip16p', 'iPhone 16 Pro', 'OtterBox Defender', 99.99),
  ('defender', 'ip16', 'iPhone 16', 'OtterBox Defender', 99.99),
  ('defender', 'gs25u', 'Galaxy S25 Ultra', 'OtterBox Defender', 99.99),
  ('defender', 'gs25p', 'Galaxy S25+', 'OtterBox Defender', 99.99),
  ('defender', 'gs25', 'Galaxy S25', 'OtterBox Defender', 99.99),
  ('clear', 'ip17pm', 'iPhone 17 Pro Max', 'Clear MagSafe Case', 29.99),
  ('clear', 'ip17p', 'iPhone 17 Pro', 'Clear MagSafe Case', 29.99),
  ('clear', 'ip17', 'iPhone 17', 'Clear MagSafe Case', 29.99),
  ('clear', 'ip17a', 'iPhone 17 Air', 'Clear MagSafe Case', 29.99),
  ('clear', 'ip16pm', 'iPhone 16 Pro Max', 'Clear MagSafe Case', 29.99),
  ('clear', 'ip16p', 'iPhone 16 Pro', 'Clear MagSafe Case', 29.99),
  ('clear', 'ip16', 'iPhone 16', 'Clear MagSafe Case', 29.99),
  ('clear', 'gs25u', 'Galaxy S25 Ultra', 'Clear MagSafe Case', 29.99),
  ('clear', 'gs25p', 'Galaxy S25+', 'Clear MagSafe Case', 29.99),
  ('clear', 'gs25', 'Galaxy S25', 'Clear MagSafe Case', 29.99),
  ('magsafe', 'ip17pm', 'iPhone 17 Pro Max', 'MagSafe Tough Case', 39.99),
  ('magsafe', 'ip17p', 'iPhone 17 Pro', 'MagSafe Tough Case', 39.99),
  ('magsafe', 'ip17', 'iPhone 17', 'MagSafe Tough Case', 39.99),
  ('magsafe', 'ip17a', 'iPhone 17 Air', 'MagSafe Tough Case', 39.99),
  ('magsafe', 'ip16pm', 'iPhone 16 Pro Max', 'MagSafe Tough Case', 39.99),
  ('magsafe', 'ip16p', 'iPhone 16 Pro', 'MagSafe Tough Case', 39.99),
  ('magsafe', 'ip16', 'iPhone 16', 'MagSafe Tough Case', 39.99),
  ('ipad-defender', 'ipadpro13', 'iPad Pro 13"', 'iPad Defender', 74.99),
  ('ipad-defender', 'ipadpro11', 'iPad Pro 11"', 'iPad Defender', 74.99),
  ('ipad-defender', 'ipadair', 'iPad Air', 'iPad Defender', 74.99)
ON CONFLICT DO NOTHING;
