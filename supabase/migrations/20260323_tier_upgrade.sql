-- ============================================================
-- AUTO TIER UPGRADE: Bronze → Silver → Gold → Diamond
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.total_earned >= 50000 THEN 'Diamond'
    WHEN NEW.total_earned >= 20000 THEN 'Gold'
    WHEN NEW.total_earned >= 5000  THEN 'Silver'
    ELSE 'Bronze'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_update_tier ON public.users;
CREATE TRIGGER auto_update_tier
  BEFORE UPDATE OF total_earned ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_user_tier();

-- Backfill existing users
UPDATE public.users SET status = CASE
  WHEN total_earned >= 50000 THEN 'Diamond'
  WHEN total_earned >= 20000 THEN 'Gold'
  WHEN total_earned >= 5000  THEN 'Silver'
  ELSE 'Bronze'
END;

-- ============================================================
-- USER REDEMPTION HISTORY (for status tracking)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_redemptions(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  category TEXT,
  amount INTEGER,
  details JSONB,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.category, r.amount, r.details, r.status, r.admin_notes, r.created_at, r.updated_at
  FROM public.redemption_requests r
  WHERE r.user_id = p_user_id
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
