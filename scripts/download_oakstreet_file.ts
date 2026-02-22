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
  const filePath = process.argv[2];
  const outputDir = process.argv[3] || '/tmp/oakstreet';
  if (!filePath) { console.error('Usage: script <file_path> [output_dir]'); process.exit(1); }
  
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  try {
    const { data } = await octokit.repos.getContent({
      owner: 'kishorsskumar', repo: 'oakstreet', path: filePath
    });
    
    if ('content' in data && data.encoding === 'base64') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const outPath = path.join(outputDir, filePath);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, content);
      console.log(`Downloaded: ${filePath} -> ${outPath} (${content.length} bytes)`);
    }
  } catch (err: any) {
    console.error(`Error downloading ${filePath}:`, err.message);
  }
}

main();
