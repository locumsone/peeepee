-- Sync all missing auth.users to public.users
INSERT INTO public.users (id, email, name, created_at)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Drop the auth.users constraints and add public.users constraints
DO $$
BEGIN
  -- Drop if exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_assignments_user_id_fkey') THEN
    ALTER TABLE public.job_assignments DROP CONSTRAINT job_assignments_user_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_assignments_assigned_by_fkey') THEN
    ALTER TABLE public.job_assignments DROP CONSTRAINT job_assignments_assigned_by_fkey;
  END IF;
  
  -- Add new constraints
  ALTER TABLE public.job_assignments
  ADD CONSTRAINT job_assignments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  
  ALTER TABLE public.job_assignments
  ADD CONSTRAINT job_assignments_assigned_by_fkey 
  FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
END $$;