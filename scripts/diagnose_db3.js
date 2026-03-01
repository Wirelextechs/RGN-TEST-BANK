const { createClient } = require('@supabase/supabase-js');

// Parse .env
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1]] = match[2];
    }
});

const supaUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supaAnon = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supaRole = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supaUrl, supaRole);

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
    const { data: users, error: usersErr } = await supabase.from('profiles').select('id').limit(1);
    if (usersErr || users.length === 0) {
        console.error("Fetch users err:", usersErr);
        return;
    }
    const targetUser = users[0];
    console.log("Using user:", targetUser.id);

    console.log(`\n=== INSERTING MESSAGE INTO GROUP ${targetGroup.id} ===`);
    const { data: insData, error: insErr } = await supabase.from('study_group_messages').insert({
        group_id: targetGroup.id,
        user_id: targetUser.id,
        content: 'Test message from diagnostic script',
        message_type: 'text'
    }).select();

    if (insErr) {
        console.error("FAILED TO INSERT:", insErr);
        return;
    }
    console.log("Insert success:", insData);

    const msgId = insData[0].id;

    console.log(`\n=== DELETING MESSAGE ${msgId} ===`);
    const { data: delData, error: delErr } = await supabase.from('study_group_messages').delete().eq('id', msgId).select();

    if (delErr) {
        console.error("FAILED TO DELETE:", delErr);
        return;
    }
    console.log("Delete success:", delData);
}

run().catch(console.error);
