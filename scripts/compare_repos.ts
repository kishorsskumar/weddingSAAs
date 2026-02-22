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
  
  const { data: branches } = await octokit.repos.listBranches({ owner: 'kishorsskumar', repo: 'oakstreet' });
  const branchName = branches[0].name;
  
  const { data: tree } = await octokit.git.getTree({ 
    owner: 'kishorsskumar', repo: 'oakstreet', 
    tree_sha: branches[0].commit.sha, recursive: 'true' 
  });
  
  const remoteFiles = tree.tree.filter(f => 
    f.type === 'blob' && f.path && 
    !f.path.includes('node_modules') &&
    !f.path.startsWith('attached_assets/') &&
    !f.path.startsWith('.') &&
    !f.path.endsWith('.md') &&
    !f.path.endsWith('.lock') &&
    (f.path.endsWith('.ts') || f.path.endsWith('.tsx') || f.path.endsWith('.css') || 
     f.path.endsWith('.html') || f.path.endsWith('.json') || f.path.endsWith('.sql'))
  );
  
  const workspace = '/home/runner/workspace';
  const results = {
    onlyInOakstreet: [] as string[],
    onlyInThis: [] as string[],
    sizeDifferences: [] as {path: string, oakSize: number, localSize: number, diff: number}[],
    same: [] as string[],
  };
  
  for (const file of remoteFiles) {
    const localPath = path.join(workspace, file.path!);
    if (!fs.existsSync(localPath)) {
      results.onlyInOakstreet.push(file.path!);
    } else {
      const localSize = fs.statSync(localPath).size;
      const sizeDiff = Math.abs((file.size || 0) - localSize);
      if (sizeDiff > 100) {
        results.sizeDifferences.push({
          path: file.path!,
          oakSize: file.size || 0,
          localSize,
          diff: sizeDiff,
        });
      } else {
        results.same.push(file.path!);
      }
    }
  }
  
  // Check local files not in remote
  const localKeyDirs = ['client/src', 'server', 'shared'];
  for (const dir of localKeyDirs) {
    const fullDir = path.join(workspace, dir);
    if (!fs.existsSync(fullDir)) continue;
    const walkDir = (d: string): string[] => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      let files: string[] = [];
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) files = files.concat(walkDir(full));
        else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx') || e.name.endsWith('.css')) {
          files.push(path.relative(workspace, full));
        }
      }
      return files;
    };
    const localFiles = walkDir(fullDir);
    for (const lf of localFiles) {
      const inRemote = remoteFiles.find(rf => rf.path === lf);
      if (!inRemote) results.onlyInThis.push(lf);
    }
  }
  
  // Sort size differences by diff descending
  results.sizeDifferences.sort((a, b) => b.diff - a.diff);
  
  console.log('=== FILES ONLY IN OAKSTREET (not in this project) ===');
  results.onlyInOakstreet.forEach(f => console.log(`  + ${f}`));
  console.log(`  Total: ${results.onlyInOakstreet.length}`);
  
  console.log('\n=== FILES ONLY IN THIS PROJECT (not in oakstreet) ===');
  results.onlyInThis.forEach(f => console.log(`  + ${f}`));
  console.log(`  Total: ${results.onlyInThis.length}`);
  
  console.log('\n=== FILES WITH SIGNIFICANT SIZE DIFFERENCES (>100 bytes) ===');
  results.sizeDifferences.forEach(f => 
    console.log(`  ${f.path}: oak=${f.oakSize}b, local=${f.localSize}b, diff=${f.diff}b`)
  );
  console.log(`  Total: ${results.sizeDifferences.length}`);
  
  console.log(`\n=== SAME (within 100 bytes): ${results.same.length} files ===`);
}

main().catch(e => console.error(e.message));
