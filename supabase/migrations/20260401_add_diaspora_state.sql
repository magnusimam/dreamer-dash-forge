-- Add Diaspora state for members outside Nigeria
INSERT INTO public.states (name) VALUES ('Diaspora')
ON CONFLICT (name) DO NOTHING;
