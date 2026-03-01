const { createClient } = require('@supabase/supabase-js');

const supaUrl = "https://givaezdutmciqimmpdzg.supabase.co";
const supaRole = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdmFlemR1dG1jaXltbXBkemciLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzMxNTA1MzkyLCJleHAiOjIwNDcwODEzOTJ9.s9j5wk2im7TfRjELmm9gw3g1mAwZ9WutoW7LQcTNQ_M";

const supabase = createClient(supaUrl, supaRole);
const supabaseAnon = createClient(supaUrl, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdmFlemR1dG1jaXltbXBkemciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMTUwNTM5MiwiZXhwIjoyMDQ3MDgxMzkyfQ.s9j5wk2im7TfRjELmm9gw3g1mAwZ9WutoW7LQcTNQ_M");

async function run() {
    console.log("=== TESTING STUDY GROUPS ===");
    const { data: groups, error: groupsErr } = await supabase.from('study_groups').select('*').limit(3);
    if (groupsErr) {
        console.error("Fetch groups error:", groupsErr);
        return;
    }

    console.log("Found groups:", groups);

    if (groups.length === 0) {
        console.log("No groups found.");
        return;
    }

    const targetGroup = groups[0];

    console.log("\n=== FINDING A USER ===");
    const { data: users, error: usersErr } = await supabase.from('profiles').select('id, role').limit(2);
    if (usersErr || users.length === 0) {
        console.error("Fetch users err:", usersErr);
        return;
    }
    const targetUser = users[0];
    console.log("Using user:", targetUser);

    console.log(`\n=== INSERTING MESSAGE INTO GROUP ${targetGroup.id} AS ADMIN (SERVICE ROLE) ===`);
    const { data: insData, error: insErr } = await supabase.from('study_group_messages').insert({
        group_id: targetGroup.id,
        user_id: targetUser.id,
        content: 'Test message from diagnostic script',
        message_type: 'text'
    }).select();

    if (insErr) {
        console.error("FAILED TO INSERT WITH SERVICE ROLE:", insErr);
    } else {
        console.log("Insert success WITH SERVICE ROLE:", insData);
        const msgId = insData[0].id;

        console.log(`\n=== DELETING MESSAGE ${msgId} WITH SERVICE ROLE ===`);
        const { data: delData, error: delErr } = await supabase.from('study_group_messages').delete().eq('id', msgId).select();

        if (delErr) {
            console.error("FAILED TO DELETE:", delErr);
        } else {
            console.log("Delete success:", delData);
        }
    }

    console.log(`\n=== TESTING RLS FOR STUDY GROUP MESSAGES ===`);

    // We need an auth token to test user RLS properly, or we can just examine the policies via SQL:
    const { data: policies, error: polErr } = await supabase.rpc('get_policies_for_table', { table_name: 'study_group_messages' });
    if (polErr) {
        console.log("\nChecking raw pg_policies");
        const { data: rawPol } = await supabase.from('pg_policies').select('*').eq('tablename', 'study_group_messages');
        console.log(rawPol);
    } else {
        console.log(policies);
    }
}

run().catch(console.error);
