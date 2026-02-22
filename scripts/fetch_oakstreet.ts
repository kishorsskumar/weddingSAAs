import { Octokit } from '@octokit/rest';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');
  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) throw new Error('GitHub not connected');
  return accessToken;
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  // List branches
  const { data: branches } = await octokit.repos.listBranches({ owner: 'kishorsskumar', repo: 'oakstreet' });
  console.log('Available branches:');
  branches.forEach(b => console.log(`  - ${b.name}`));
  
  if (branches.length === 0) {
    console.log('No branches found - repo may be empty');
    return;
  }
  
  const branchName = branches[0].name;
  console.log(`\nUsing branch: ${branchName}`);
  
  const { data: tree } = await octokit.git.getTree({ 
    owner: 'kishorsskumar', repo: 'oakstreet', 
    tree_sha: branches[0].commit.sha, recursive: 'true' 
  });
  
  const files = tree.tree.filter(f => f.type === 'blob' && f.path && !f.path.includes('node_modules'));
  files.forEach(f => console.log(`${f.path} (${f.size} bytes)`));
  console.log(`\nTotal files: ${files.length}`);
}

main().catch(e => console.error(e.message));
