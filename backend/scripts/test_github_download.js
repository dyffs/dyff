import https from 'https';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: '' // repo read permissions required
});

async function getPRMediaLinks(owner, repo, prNumber) {
  const { data: pr } = await octokit.request(`GET /repos/${owner}/${repo}/pulls/${prNumber}`, {
    owner: owner,
    repo: repo,
    pull_number: prNumber,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
      'Accept': 'application/vnd.github.full+json'
    }
  })

  console.log(pr);

  const body = pr.body || '';
  const regex = /(https:\/\/github\.com\/user-attachments\/[^\s)]+)/g;
  return [...body.matchAll(regex)].map(match => match[1]);
}

function httpsReq(fileUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(fileUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };

    const req = https.request(options, res => {
      console.log(res.statusCode);
      console.log(url.hostname, url.pathname + url.search)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsReq(res.headers.location));
      }
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    });

    req.on('error', reject);
    req.end();
  });
}

async function downloadMedia(owner, repo, prNumber) {
  const links = await getPRMediaLinks(owner, repo, prNumber);

  console.log(links);

  for (let i = 0; i < links.length; i++) {
    const buffer = await httpsReq(links[i]);
    const savePath = path.join(process.cwd(), `image-${i}.png`);
    fs.writeFileSync(savePath, buffer);
    console.log(`Saved ${savePath} (${buffer.length} bytes)`);
  }
}

// Example run
downloadMedia('khanhhuy', 'codebreeze-frontend', 5);