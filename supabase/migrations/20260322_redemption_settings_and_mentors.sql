-- ============================================================
-- Redemption category settings (admin-editable costs)
-- ============================================================

CREATE TABLE IF NOT EXISTS redemption_categories (
  id TEXT PRIMARY KEY,               -- e.g. 'airtime', 'data', 'cash', ...
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 0,   -- min DR needed
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the default categories
INSERT INTO redemption_categories (id, title, description, cost) VALUES
  ('airtime',    'Airtime',          'Recharge your phone with airtime',       500),
  ('data',       'Data',             'Purchase mobile data bundles',           800),
  ('cash',       'Cash',             'Transfer cash to your bank account',     1000),
  ('books',      'Books',            'Get physical or digital books',          600),
  ('mentorship', 'Mentorship',       'Book a session with our mentors',        1500),
  ('courses',    'Pay for Courses',  'Fund your online learning',              2000),
  ('other',      'Other',            'Custom redemption request',              100)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public), only admins can update
ALTER TABLE redemption_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view redemption categories"
  ON redemption_categories FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update redemption categories"
  ON redemption_categories FOR UPDATE
  USING (true);

-- ============================================================
-- Mentors table
-- ============================================================

CREATE TABLE IF NOT EXISTS mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',       -- e.g. 'Business', 'Tech', 'Career'
  contact_info TEXT NOT NULL DEFAULT '',    -- how the user reaches the mentor (admin-only visible until approved)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mentors ENABLE ROW LEVEL SECURITY;

-- Anyone can see active mentors (name + specialty only — contact_info is filtered in app)
CREATE POLICY "Anyone can view mentors"
  ON mentors FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert mentors"
  ON mentors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update mentors"
  ON mentors FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete mentors"
  ON mentors FOR DELETE
  USING (true);
