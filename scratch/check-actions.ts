import "dotenv/config";

async function checkActions() {
  console.log("Fetching latest GitHub Actions runs...");
  const response = await fetch("https://api.github.com/repos/ThariqAzees/Hostel-Complaint-System/actions/runs?per_page=3", {
    headers: {
      "User-Agent": "Antigravity-Agent"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workflow runs: ${response.statusText}`);
  }

  const data = await response.json();
  const runs = data.workflow_runs || [];

  if (runs.length === 0) {
    console.log("No workflow runs found.");
    return;
  }

  console.log("\n--- LATEST WORKFLOW RUNS ---");
  for (const run of runs) {
    console.log(`Workflow: ${run.name}`);
    console.log(`ID: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Conclusion: ${run.conclusion}`);
    console.log(`Commit Message: ${run.head_commit?.message}`);
    console.log(`Commit SHA: ${run.head_sha}`);
    console.log(`URL: ${run.html_url}`);
    console.log("----------------------------");
  }
}

checkActions().catch(console.error);
