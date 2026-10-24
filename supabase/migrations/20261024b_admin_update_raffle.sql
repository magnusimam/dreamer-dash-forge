-- Raffles had no edit path: an admin who made a typo had to archive and recreate.
-- Entry fee is locked once anyone has entered, since entrants already paid the old fee.
-- Max entries can't drop below the current entry count.

CREATE OR REPLACE FUNCTION public.admin_update_raffle(
  p_init_data text,
  p_id uuid,
  p_title text DEFAULT NULL::text,
  p_description text DEFAULT NULL::text,
  p_entry_fee integer DEFAULT NULL::integer,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_max_entries integer DEFAULT NULL::integer,
  p_clear_max_entries boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_raffle public.raffles; v_entries integer;
BEGIN
  PERFORM public.app_admin_can(p_init_data, 'raffles');

  SELECT * INTO v_raffle FROM public.raffles WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raffle not found');
  END IF;
  IF v_raffle.status = 'ended' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This raffle has already ended');
  END IF;

  SELECT COUNT(*) INTO v_entries FROM public.raffle_entries WHERE raffle_id = p_id;

  IF p_entry_fee IS NOT NULL AND p_entry_fee <> v_raffle.entry_fee AND v_entries > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry fee can''t change after people have entered');
  END IF;
  IF p_entry_fee IS NOT NULL AND p_entry_fee < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry fee can''t be negative');
  END IF;
  IF p_max_entries IS NOT NULL AND p_max_entries < GREATEST(v_entries, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', format('Max entries can''t be below the current %s entries', v_entries));
  END IF;
  IF p_title IS NOT NULL AND btrim(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Title can''t be empty');
  END IF;

  UPDATE public.raffles SET
    title       = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    entry_fee   = COALESCE(p_entry_fee, entry_fee),
    end_date    = COALESCE(p_end_date, end_date),
    max_entries = CASE WHEN p_clear_max_entries THEN NULL ELSE COALESCE(p_max_entries, max_entries) END
  WHERE id = p_id;

  RETURN jsonb_build_object('success', true);
END; $function$;

REVOKE ALL ON FUNCTION public.admin_update_raffle(text, uuid, text, text, integer, timestamp with time zone, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_raffle(text, uuid, text, text, integer, timestamp with time zone, integer, boolean) TO anon, authenticated;
