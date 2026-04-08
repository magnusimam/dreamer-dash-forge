-- Single query to get all community stats instead of N+1 queries per user
CREATE OR REPLACE FUNCTION public.get_community_stats()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  balance INTEGER,
  total_earned INTEGER,
  streak INTEGER,
  last_active TIMESTAMPTZ,
  missions BIGINT,
  raffles BIGINT,
  raffle_wins BIGINT,
  activities BIGINT,
  promos BIGINT,
  checkins BIGINT,
  transfers BIGINT,
  redeems BIGINT,
  hackathons BIGINT,
  engagement BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.username,
    u.photo_url,
    u.balance,
    u.total_earned,
    u.streak,
    u.last_active,
    COALESCE(mc.cnt, 0) AS missions,
    COALESCE(re.cnt, 0) AS raffles,
    COALESCE(rw.cnt, 0) AS raffle_wins,
    COALESCE(al.cnt, 0) AS activities,
    COALESCE(pc.cnt, 0) AS promos,
    COALESCE(dc.cnt, 0) AS checkins,
    COALESCE(tr.cnt, 0) AS transfers,
    COALESCE(rd.cnt, 0) AS redeems,
    COALESCE(hr.cnt, 0) AS hackathons,
    (COALESCE(mc.cnt, 0) * 3 + COALESCE(al.cnt, 0) * 2 + COALESCE(re.cnt, 0) + COALESCE(rw.cnt, 0) * 5 + COALESCE(pc.cnt, 0) * 2 + COALESCE(dc.cnt, 0) + COALESCE(tr.cnt, 0) + COALESCE(hr.cnt, 0) * 3) AS engagement
  FROM public.users u
  LEFT JOIN (SELECT user_id, COUNT(*)::BIGINT AS cnt FROM public.mission_completions WHERE status = 'approved' GROUP BY user_id) mc ON mc.user_id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*)::BIGINT AS cnt FROM public.raffle_entries GROUP BY user_id) re ON re.user_id = u.id
  LEFT JOIN (SELECT winner_id, COUNT(*)::BIGINT AS cnt FROM public.raffles WHERE winner_id IS NOT NULL GROUP BY winner_id) rw ON rw.winner_id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*)::BIGINT AS cnt FROM public.activity_logs GROUP BY user_id) al ON al.user_id = u.id
  LEFT JOIN (SELECT claimed_by, COUNT(*)::BIGINT AS cnt FROM public.promo_codes WHERE is_used = TRUE AND claimed_by IS NOT NULL GROUP BY claimed_by) pc ON pc.claimed_by = u.id
  LEFT JOIN (SELECT user_id, COUNT(*)::BIGINT AS cnt FROM public.daily_checkins GROUP BY user_id) dc ON dc.user_id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*)::BIGINT AS cnt FROM public.transactions WHERE type = 'transfer_out' GROUP BY user_id) tr ON tr.user_id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*)::BIGINT AS cnt FROM public.redemption_requests GROUP BY user_id) rd ON rd.user_id = u.id
  LEFT JOIN (SELECT user_id, COUNT(*)::BIGINT AS cnt FROM public.hackathon_registrations GROUP BY user_id) hr ON hr.user_id = u.id
  ORDER BY engagement DESC;
END;
$func$;
