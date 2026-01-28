-- Insert user into public.users table (sync from auth.users)
INSERT INTO public.users (id, email, name, role)
VALUES ('29889bd7-b967-45ca-9efa-f010e97febb1', 'a@locums.one', 'Azaan Subhani', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin', name = 'Azaan Subhani';

-- Add admin role to user_roles table
INSERT INTO public.user_roles (user_id, role)
VALUES ('29889bd7-b967-45ca-9efa-f010e97febb1', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;