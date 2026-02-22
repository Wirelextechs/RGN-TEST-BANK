const { Client } = require('pg');

const config = {
    user: 'postgres.givaezdutmciqimmpdzg',
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: 'AdaGlow@2025',
    port: 6543,
    ssl: { rejectUnauthorized: false }
};

async function checkMessages() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log('Connected to database.');

        // Check if table exists
        const tableCheck = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages');");
        console.log(`Table 'messages' exists: ${tableCheck.rows[0].exists}`);

        if (tableCheck.rows[0].exists) {
            // Check count
            const countRes = await client.query("SELECT count(*) FROM public.messages;");
            console.log(`Total messages in DB: ${countRes.rows[0].count}`);

            // Sample messages
            const sampleRes = await client.query("SELECT * FROM public.messages ORDER BY created_at DESC LIMIT 5;");
            console.log('Latest 5 messages:', sampleRes.rows);

            // Check if profiles are linked correctly
            const joinRes = await client.query("SELECT m.content, p.full_name FROM public.messages m JOIN public.profiles p ON m.user_id = p.id LIMIT 5;");
            console.log('Sample joins with profiles:', joinRes.rows);
        }

    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        await client.end();
    }
}

checkMessages();
