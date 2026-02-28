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

    console.log("=== CHECKING STUDY_GROUPS CONSTRAINTS ===");
    const cols = await client.query(
        "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='study_groups'"
    );
    cols.rows.forEach(r => console.log(`  ${r.column_name}: nullable=${r.is_nullable}`));

    console.log("\n=== RLS POLICIES ON DIRECT_MESSAGES ===");
    const dmPolicies = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'direct_messages'");
    dmPolicies.rows.forEach(r => console.log(`  ${r.policyname}: cmd=${r.cmd}`));

    console.log("\n=== RLS POLICIES ON STUDY_GROUP_MESSAGES ===");
    const sgmPolicies = await client.query("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'study_group_messages'");
    sgmPolicies.rows.forEach(r => console.log(`  ${r.policyname}: cmd=${r.cmd}`));

    console.log("\n=== STUDY_GROUPS ROWS ===");
    const groups = await client.query("SELECT * FROM study_groups");
    groups.rows.forEach(g => console.log(`  Group: id=${g.id}, school=${g.school_name}, course=${g.course_name}, type=${g.group_type}`));

    await client.end();
}

run().catch(err => console.error("ERROR:", err));
