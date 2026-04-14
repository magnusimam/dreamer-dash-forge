-- Allow users to leave their state
CREATE OR REPLACE FUNCTION public.leave_state(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.state_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in any state');
  END IF;

  UPDATE public.users SET state_id = NULL WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$func$;

-- Update join_state to allow re-joining (remove the "already joined" restriction)
CREATE OR REPLACE FUNCTION public.join_state(p_user_id UUID, p_state_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_user RECORD;
  v_state RECORD;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_state FROM public.states WHERE id = p_state_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'State not found');
  END IF;

  UPDATE public.users SET state_id = p_state_id WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true, 'state', v_state.name);
END;
$func$;
