const { Client } = require('pg');
const config = {
    user: 'postgres.givaezdutmciqimmpdzg',
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: 'AdaGlow@2025',
    port: 6543,
    ssl: { rejectUnauthorized: false }
};

async function run() {
    const client = new Client(config);
    await client.connect();

    // 1. Check columns exist
    console.log("=== PROFILES TABLE COLUMNS ===");
    const cols = await client.query(
        "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position"
    );
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (default: ${r.column_default})`));

    // 2. Check if any students have hands raised
    console.log("\n=== STUDENTS WITH HANDS RAISED ===");
    const hands = await client.query("SELECT id, full_name, is_hand_raised, is_unlocked FROM public.profiles WHERE is_hand_raised = true");
    console.log(`  Count: ${hands.rows.length}`);
    hands.rows.forEach(r => console.log(`  ${r.full_name}: raised=${r.is_hand_raised}, unlocked=${r.is_unlocked}`));

    // 3. Try a test update to verify write access
    console.log("\n=== TESTING WRITE ACCESS ===");
    const testUser = await client.query("SELECT id, full_name FROM public.profiles WHERE role='student' LIMIT 1");
    if (testUser.rows.length > 0) {
        const uid = testUser.rows[0].id;
        console.log(`  Test user: ${testUser.rows[0].full_name} (${uid})`);

        // Toggle is_hand_raised
        const upd = await client.query("UPDATE public.profiles SET is_hand_raised = true WHERE id = $1 RETURNING is_hand_raised", [uid]);
        console.log(`  After update: is_hand_raised = ${upd.rows[0].is_hand_raised}`);

        // Reset it
        await client.query("UPDATE public.profiles SET is_hand_raised = false WHERE id = $1", [uid]);
        console.log("  Reset successful");
    } else {
        console.log("  No students found for testing");
    }

    // 4. Check RLS is not blocking updates from anon/authenticated role
    console.log("\n=== RLS POLICIES ON PROFILES ===");
    const policies = await client.query("SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles'");
    policies.rows.forEach(r => console.log(`  ${r.policyname}: cmd=${r.cmd}, qual=${r.qual}, with_check=${r.with_check}`));

    // 5. Check if RLS is even enabled
    console.log("\n=== RLS ENABLED? ===");
    const rlsCheck = await client.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'profiles'");
    rlsCheck.rows.forEach(r => console.log(`  ${r.relname}: rls_enabled=${r.relrowsecurity}, force_rls=${r.relforcerowsecurity}`));

    await client.end();
}

run().catch(err => console.error("ERROR:", err));
