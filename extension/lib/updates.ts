// Checking whether a newer extension build exists.
//
// Distributed builds come from the Extension Build workflow's runs on main
// (.github/workflows/extension-build.yml). Each build bakes in that run's
// GITHUB_RUN_NUMBER (CONFIG.buildNumber) and short SHA; here we ask the public
// GitHub API for the latest successful main run and compare run numbers. No auth
// (public repo) and no host permission — the GitHub API sends permissive CORS.

const REPO = "fredrivett/abode";
const WORKFLOW_FILE = "extension-build.yml";

// Latest successful run on main = the newest build that produced an artifact.
// Both push and manual dispatch on main build the artifact, so we don't filter
// by event. PR runs are already excluded: their head branch is the PR source,
// not main, so branch=main leaves them out.
const LATEST_RUN_URL =
  `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}` +
  `/runs?branch=main&status=success&per_page=1`;

export interface LatestBuild {
  number: number;
  sha: string;
  /** The workflow run page — where the artifact is downloaded. */
  url: string;
}

export async function fetchLatestBuild(): Promise<LatestBuild> {
  const res = await fetch(LATEST_RUN_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  return parseLatestRun(await res.json());
}

/** True when a build with `latest` supersedes the running `current`. */
export function isNewerBuild(current: number, latest: number): boolean {
  return latest > current;
}

interface WorkflowRun {
  run_number: number;
  head_sha: string;
  html_url: string;
}

function isWorkflowRun(value: unknown): value is WorkflowRun {
  return (
    typeof value === "object" &&
    value !== null &&
    "run_number" in value &&
    typeof value.run_number === "number" &&
    "head_sha" in value &&
    typeof value.head_sha === "string" &&
    "html_url" in value &&
    typeof value.html_url === "string"
  );
}

export function parseLatestRun(data: unknown): LatestBuild {
  if (
    typeof data !== "object" ||
    data === null ||
    !("workflow_runs" in data) ||
    !Array.isArray(data.workflow_runs)
  ) {
    throw new Error("Unexpected GitHub API response");
  }
  const [run] = data.workflow_runs;
  if (!isWorkflowRun(run)) throw new Error("No successful build found");
  return {
    number: run.run_number,
    sha: run.head_sha.slice(0, 7),
    url: run.html_url,
  };
}
