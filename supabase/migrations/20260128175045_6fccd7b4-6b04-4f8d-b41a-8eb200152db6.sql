-- Assign admin role to info@locums.one
INSERT INTO public.user_roles (user_id, role)
VALUES ('60da04a4-b30b-4b6b-ad3d-c4b73230517f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;