-- 1. Ensure the replica identity is FULL so that the `UPDATE` payload contains the new row data.
ALTER TABLE profiles REPLICA IDENTITY FULL;

-- 2. Ensure RLS allows the `admin-dashboard-sync` channel to read profiles.
-- If an admin logs in, they need to be able to read profile updates. If they only have a permissive SELECT policy, it should work.
-- If the problem is that standard non-admin users cannot see updates to their own profile, a policy like this handles it:
CREATE POLICY "Enable read access for own profile updates in realtime" ON profiles FOR SELECT USING (auth.uid() = id);

-- 3. Check if we need to explicitly grant realtime access. By default, granting SELECT to authenticated is enough.
GRANT SELECT ON profiles TO authenticated;
