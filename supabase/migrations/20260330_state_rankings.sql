-- State Rankings: community members join a state, states ranked by combined DR balance

-- States table
CREATE TABLE public.states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add state_id to users (nullable, set once, never changed)
ALTER TABLE public.users
  ADD COLUMN state_id UUID REFERENCES public.states(id) ON DELETE RESTRICT;

CREATE INDEX idx_users_state_id ON public.users(state_id);

-- RLS
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view states"
  ON public.states FOR SELECT
  USING (true);

CREATE POLICY "Admins can create states"
  ON public.states FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Admins can delete states"
  ON public.states FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE));

-- Join a state (permanent, one-time)
CREATE OR REPLACE FUNCTION public.join_state(p_user_id UUID, p_state_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user public.users;
  v_state public.states;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.state_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already joined a state. This cannot be changed.');
  END IF;

  SELECT * INTO v_state FROM public.states WHERE id = p_state_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'State not found');
  END IF;

  UPDATE public.users SET state_id = p_state_id WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'state', v_state.name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get state rankings (aggregated balance + member count)
CREATE OR REPLACE FUNCTION public.get_state_rankings()
RETURNS TABLE (
  state_id UUID,
  state_name TEXT,
  total_balance BIGINT,
  member_count BIGINT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS state_id,
    s.name AS state_name,
    COALESCE(SUM(u.balance), 0)::BIGINT AS total_balance,
    COUNT(u.id)::BIGINT AS member_count,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(u.balance), 0) DESC) AS rank
  FROM public.states s
  LEFT JOIN public.users u ON u.state_id = s.id
  GROUP BY s.id, s.name
  ORDER BY total_balance DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin delete state (only if no members)
CREATE OR REPLACE FUNCTION public.delete_state(p_admin_id UUID, p_state_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_admin public.users;
  v_member_count INTEGER;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT COUNT(*) INTO v_member_count FROM public.users WHERE state_id = p_state_id;
  IF v_member_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete a state that has members (' || v_member_count || ' members)');
  END IF;

  DELETE FROM public.states WHERE id = p_state_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed initial states
INSERT INTO public.states (name) VALUES
  ('Cross River'),
  ('Lagos'),
  ('Akwa Ibom'),
  ('Abuja');
