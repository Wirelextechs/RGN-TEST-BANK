const { Client } = require('pg');

const configs = [
    {
        name: 'Transaction Pooler',
        user: 'postgres.givaezdutmciqimmpdzg',
        host: 'aws-1-eu-west-1.pooler.supabase.com',
        database: 'postgres',
        password: 'AdaGlow@2025',
        port: 6543,
        ssl: { rejectUnauthorized: false }
    }
];

async function testConnections() {
    for (const config of configs) {
        console.log(`Testing ${config.name}...`);
        const client = new Client(config);
        try {
            await client.connect();
            console.log(`✅ ${config.name} connected successfully!`);
            await client.end();
        } catch (err) {
            console.error(`❌ ${config.name} failed:`, err.message);
        }
    }
}

testConnections();
