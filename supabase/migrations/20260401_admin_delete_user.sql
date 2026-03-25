-- Admin delete user function
-- Clears all FK references then deletes the user

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_admin_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_admin public.users;
  v_user public.users;
  v_user_info TEXT;
BEGIN
  SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id AND is_admin = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_admin_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete an admin account');
  END IF;

  -- Save user info for audit log before deletion
  v_user_info := 'Deleted user: ' || COALESCE(v_user.username, v_user.first_name) || ' (TG: ' || v_user.telegram_id || ', Balance: ' || v_user.balance || ' DR)';

  -- Return user balance to treasury before deletion
  IF v_user.balance > 0 THEN
    PERFORM public.record_recycling(v_user.balance);
  END IF;

  -- Clear state_id to avoid ON DELETE RESTRICT
  UPDATE public.users SET state_id = NULL WHERE id = p_user_id;

  -- Nullify references that don't have CASCADE
  UPDATE public.activities SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.hackathons SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.redemption_requests SET processed_by = NULL WHERE processed_by = p_user_id;

  -- Clear audit log FK references to this user (so delete doesn't fail)
  UPDATE public.admin_audit_log SET target_user_id = NULL WHERE target_user_id = p_user_id;

  -- Delete user (cascades to activity_logs, transactions, checkins, etc.)
  DELETE FROM public.users WHERE id = p_user_id;

  -- Audit log AFTER deletion (target_user_id is NULL since user no longer exists)
  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, reason)
  VALUES (p_admin_id, 'delete_user', NULL, v_user_info);

  RETURN jsonb_build_object('success', true, 'deleted_user', COALESCE(v_user.username, v_user.first_name));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
