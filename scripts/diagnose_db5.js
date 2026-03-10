const supaUrl = "https://givaezdutmciqimmpdzg.supabase.co";
const supaRole = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpdmFlemR1dG1jaXltbXBkemciLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzMxNTA1MzkyLCJleHAiOjIwNDcwODEzOTJ9.s9j5wk2im7TfRjELmm9gw3g1mAwZ9WutoW7LQcTNQ_M";

async function fetchGroups() {
    console.log("== FETCHING ALL STUDY GROUPS ==");
    const res = await fetch(`${supaUrl}/rest/v1/study_groups?select=*`, {
        headers: {
            "apikey": supaRole,
            "Authorization": `Bearer ${supaRole}`
        }
    });

    const groups = await res.json();
    console.log(groups);

    if (groups.length === 0) {
        console.log("No groups exist!");
        return;
    }
}

fetchGroups().catch(console.error);
