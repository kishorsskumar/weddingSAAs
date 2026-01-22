import { getUncachableGitHubClient } from './github-client';

export async function createGitHubRepo(repoName: string, isPrivate: boolean = true) {
  const octokit = await getUncachableGitHubClient();
  
  try {
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      description: 'Wedding SaaS Platform - Multi-tenant event management system',
      auto_init: false,
    });
    
    return {
      success: true,
      repoUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
    };
  } catch (error: any) {
    if (error.status === 422) {
      return { success: false, error: 'Repository already exists' };
    }
    throw error;
  }
}

export async function listUserRepos() {
  const octokit = await getUncachableGitHubClient();
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 10,
  });
  return repos.map(r => ({ name: r.name, url: r.html_url, private: r.private }));
}
