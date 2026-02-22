const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://givaezdutmciqimmpdzg.supabase.co';
const supabaseAnonKey = ''; // Not needed for internal DB check but I'll use PG instead to verify the join possibility

// Wait, I'll just use the PG script to see if a manual query works vs what Supabase expects.
// Actually, I'll use PG to ADD the foreign key.

const { Client } = require('pg');
const config = {
    user: 'postgres.givaezdutmciqimmpdzg',
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: 'AdaGlow@2025',
    port: 6543,
    ssl: { rejectUnauthorized: false }
};

async function fixForeignKey() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log('Connected to database.');

        console.log('Adding foreign key from messages(user_id) to profiles(id)...');
        // Check if constraint exists already (it shouldn't based on previous check)
        const sql = `
            ALTER TABLE public.messages
            ADD CONSTRAINT fk_messages_profiles
            FOREIGN KEY (user_id)
            REFERENCES public.profiles(id)
            ON DELETE CASCADE;
        `;
        await client.query(sql);
        console.log('Foreign key added successfully!');

    } catch (err) {
        console.error('Fix failed:', err.message);
    } finally {
        await client.end();
    }
}

fixForeignKey();
