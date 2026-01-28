-- Add admin role for the primary user
INSERT INTO user_roles (user_id, role)
VALUES ('5b671146-4658-448d-88c3-fe8db78e9328', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;