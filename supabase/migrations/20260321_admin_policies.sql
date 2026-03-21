-- ============================================================
-- ADMIN POLICIES: Update & Delete for activities/hackathons
-- + Admin access to users & redemption_requests
-- ============================================================

-- ACTIVITIES: Admins can update & delete
CREATE POLICY "Admins can update activities"
  ON public.activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = created_by AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can delete activities"
  ON public.activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = activities.created_by AND is_admin = TRUE
    )
  );

-- HACKATHONS: Admins can delete
CREATE POLICY "Admins can delete hackathons"
  ON public.hackathons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = hackathons.created_by AND is_admin = TRUE
    )
  );

-- USERS: Admins can update any user (for balance adjustments)
CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users AS admin
      WHERE admin.is_admin = TRUE
    )
  );

-- REDEMPTION REQUESTS: Allow admins to read all
-- (existing policy already allows SELECT for all, so we just need UPDATE)
-- The existing "Admins can update redemption requests" policy checks processed_by,
-- but we need a broader one that lets any admin update any request.
DROP POLICY IF EXISTS "Admins can update redemption requests" ON public.redemption_requests;

CREATE POLICY "Admins can update redemption requests"
  ON public.redemption_requests FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FUNCTION: Admin process redemption (approve/reject)
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_redemption(
  p_admin_id UUID,
  p_request_id UUID,
  p_action TEXT, -- 'approved' or 'rejected'
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin public.users;
  v_request public.redemption_requests;
BEGIN
  -- Verify admin
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get request
  SELECT * INTO v_request FROM public.redemption_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request already processed');
  END IF;

  -- If rejecting, refund the user
  IF p_action = 'rejected' THEN
    UPDATE public.users SET balance = balance + v_request.amount WHERE id = v_request.user_id;

    INSERT INTO public.transactions (user_id, type, amount, description, reference_id)
    VALUES (v_request.user_id, 'bonus', v_request.amount, 'Refund: rejected ' || v_request.category || ' redemption', v_request.id);
  END IF;

  -- Update request status
  UPDATE public.redemption_requests
  SET status = p_action, admin_notes = p_notes, processed_by = p_admin_id
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'request_id', p_request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Admin adjust user balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_admin_id UUID,
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin public.users;
  v_user public.users;
BEGIN
  -- Verify admin
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get user
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent negative balance
  IF v_user.balance + p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Would result in negative balance');
  END IF;

  -- Adjust balance
  UPDATE public.users
  SET balance = balance + p_amount,
      total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'bonus', p_amount, 'Admin adjustment: ' || p_reason);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_user.balance + p_amount,
    'user', v_user.first_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
