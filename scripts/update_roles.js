const { Client } = require('pg');

async function runMigration() {
    const client = new Client({
        user: 'postgres.givaezdutmciqimmpdzg',
        host: 'aws-1-eu-west-1.pooler.supabase.com',
        database: 'postgres',
        password: 'AdaGlow@2025',
        port: 6543,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL');

        const sql = `
            ALTER TABLE public.profiles 
            DROP CONSTRAINT IF EXISTS profiles_role_check;

            ALTER TABLE public.profiles 
            ADD CONSTRAINT profiles_role_check 
            CHECK (role IN ('admin', 'ta', 'student'));
        `;

        await client.query(sql);
        console.log('Migration successful: "ta" role added to profiles_role_check constraint.');
    } catch (err) {
        console.error('Migration failed:', err.stack);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
