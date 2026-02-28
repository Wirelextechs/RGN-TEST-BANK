const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1]] = match[2].trim();
    }
});

console.log("Keys found:", Object.keys(envVars));
console.log("URL:", envVars['NEXT_PUBLIC_SUPABASE_URL']);
console.log("Key length:", (envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '').length);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    envVars['NEXT_PUBLIC_SUPABASE_URL'],
    envVars['SUPABASE_SERVICE_ROLE_KEY'] || envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']
);

async function check() {
    const { data: settings, error } = await supabase.from('platform_settings').select('*');
    console.log("Settings:", JSON.stringify(settings, null, 2));
    console.log("Error:", error);
}

check();
