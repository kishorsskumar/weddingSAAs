import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');
  const cs = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);
  return cs?.settings?.access_token || cs?.settings?.oauth?.credentials?.access_token;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) { console.error('Usage: script <file_path>'); process.exit(1); }
  
  const token = await getAccessToken();
  const octokit = new Octokit({ auth: token });
  
  // Get the tree to find blob SHA
  const { data: branches } = await octokit.repos.listBranches({ owner: 'kishorsskumar', repo: 'oakstreet' });
  const { data: tree } = await octokit.git.getTree({ 
    owner: 'kishorsskumar', repo: 'oakstreet', 
    tree_sha: branches[0].commit.sha, recursive: 'true' 
  });
  
  const fileEntry = tree.tree.find(f => f.path === filePath);
  if (!fileEntry || !fileEntry.sha) { console.error('File not found in tree'); process.exit(1); }
  
  // Get blob content
  const { data: blob } = await octokit.git.getBlob({
    owner: 'kishorsskumar', repo: 'oakstreet', file_sha: fileEntry.sha
  });
  
  const content = Buffer.from(blob.content, 'base64').toString('utf-8');
  const outPath = path.join('/tmp/oakstreet', filePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  console.log(`Downloaded: ${filePath} (${content.length} bytes)`);
}

main().catch(e => console.error(e.message));
