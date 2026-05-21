-- ============================================================
-- WOVO MEDIA PREMIUM ONBOARDING + REPORTING TABLES
-- Run in Supabase SQL Editor
-- ============================================================

-- Premium client invitations (sent before they have an account)
CREATE TABLE IF NOT EXISTS premium_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  stripe_payment_link TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'active', 'cancelled'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  client_id UUID REFERENCES clients(id),
  notes TEXT,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly reports sent to premium clients
CREATE TABLE IF NOT EXISTS client_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- '2025-06'
  title TEXT,
  views INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  posts_published INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  top_post_url TEXT,
  notes TEXT, -- internal notes from Payton
  summary TEXT, -- client-facing summary
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client stats history (for the client dashboard chart)
CREATE TABLE IF NOT EXISTS client_stats_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  views INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  posts INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE premium_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_stats_history ENABLE ROW LEVEL SECURITY;

-- Staff can see all
CREATE POLICY "staff_invitations" ON premium_invitations FOR ALL USING (is_wovo_staff());
CREATE POLICY "staff_reports" ON client_reports FOR ALL USING (is_wovo_staff());
CREATE POLICY "staff_stats" ON client_stats_history FOR ALL USING (is_wovo_staff());

-- Clients see their own reports
CREATE POLICY "client_own_reports" ON client_reports FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
);
CREATE POLICY "client_own_stats" ON client_stats_history FOR SELECT USING (
  client_id IN (SELECT id FROM clients WHERE profile_id = auth.uid())
);

SELECT 'Premium tables installed' AS status;
