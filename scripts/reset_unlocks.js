const { Client } = require('pg');

const config = {
    user: 'postgres.givaezdutmciqimmpdzg',
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: 'AdaGlow@2025',
    port: 6543,
    ssl: { rejectUnauthorized: false }
};

async function resetUnlockStatus() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log('Connected to database.');

        const sql = "UPDATE public.profiles SET is_unlocked = false WHERE is_unlocked = true;";
        const res = await client.query(sql);
        console.log(`Successfully reset ${res.rowCount} student(s) to locked state.`);

    } catch (err) {
        console.error('Reset failed:', err.message);
    } finally {
        await client.end();
    }
}

resetUnlockStatus();
