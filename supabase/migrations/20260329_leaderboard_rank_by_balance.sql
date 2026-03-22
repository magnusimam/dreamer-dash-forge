-- ============================================================
-- Fix leaderboard to rank by current balance instead of total_earned
-- so that spending DR causes users to drop in rank dynamically
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  total_earned INTEGER,
  balance INTEGER,
  streak INTEGER,
  status TEXT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.username,
    u.photo_url,
    u.total_earned,
    u.balance,
    u.streak,
    u.status,
    ROW_NUMBER() OVER (ORDER BY u.balance DESC) AS rank
  FROM public.users u
  ORDER BY u.balance DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
