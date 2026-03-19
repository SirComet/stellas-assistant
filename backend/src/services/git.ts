import { simpleGit, type SimpleGit, type CommitResult } from "simple-git";
import path from "path";
import fs from "fs";
import { config } from "../config/index";
import { Octokit } from "@octokit/rest";

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface CommitOptions {
  message: string;
  files?: string[];
  push?: boolean;
  authorName?: string;
  authorEmail?: string;
}

export async function getGitStatus(localPath: string): Promise<GitStatus> {
  const git = simpleGit(localPath);
  const status = await git.status();
  const branch = await git.branch();

  return {
    branch: branch.current,
    ahead: status.ahead,
    behind: status.behind,
    modified: status.modified,
    added: status.created,
    deleted: status.deleted,
    untracked: status.not_added,
  };
}

export async function commitAndPush(
  localPath: string,
  options: CommitOptions,
  token?: string
): Promise<CommitResult> {
  const git = simpleGit(localPath);

  // Configure author
  await git.addConfig("user.name", options.authorName ?? config.git.defaultAuthorName);
  await git.addConfig("user.email", options.authorEmail ?? config.git.defaultAuthorEmail);

  // Stage files
  if (options.files && options.files.length > 0) {
    await git.add(options.files);
  } else {
    await git.add(".");
  }

  // Create commit
  const result = await git.commit(options.message);

  // Push if requested
  if (options.push) {
    const remotes = await git.getRemotes(true);
    if (remotes.length > 0) {
      const remote = remotes[0];
      if (remote && token) {
        // Set remote URL with token for authentication
        const repoUrl = remote.refs.push;
        const authenticatedUrl = injectTokenIntoUrl(repoUrl, token);
        await git.remote(["set-url", "origin", authenticatedUrl]);
      }
      await git.push("origin", (await git.branch()).current);
    }
  }

  return result;
}

export async function cloneOrInit(
  localPath: string,
  repoUrl?: string,
  branch?: string
): Promise<void> {
  if (fs.existsSync(path.join(localPath, ".git"))) {
    // Already initialized
    return;
  }

  fs.mkdirSync(localPath, { recursive: true });

  if (repoUrl) {
    await simpleGit().clone(repoUrl, localPath, ["--branch", branch ?? "main"]);
  } else {
    const git = simpleGit(localPath);
    await git.init();
    await git.checkout(["-b", branch ?? "main"]);
  }
}

export async function getRecentCommits(
  localPath: string,
  limit = 20
): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
  const git = simpleGit(localPath);
  const log = await git.log({ maxCount: limit });

  return log.all.map((commit) => ({
    hash: commit.hash.substring(0, 7),
    message: commit.message,
    author: commit.author_name,
    date: commit.date,
  }));
}

export async function createGithubRepo(
  token: string,
  name: string,
  description?: string,
  isPrivate = false
): Promise<{ url: string; cloneUrl: string; sshUrl: string }> {
  const octokit = new Octokit({ auth: token });

  const response = await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
    auto_init: false,
  });

  return {
    url: response.data.html_url,
    cloneUrl: response.data.clone_url,
    sshUrl: response.data.ssh_url,
  };
}

export async function setupWebhook(
  token: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret?: string,
  events: string[] = ["push", "release"]
): Promise<{ id: number; url: string }> {
  const octokit = new Octokit({ auth: token });

  const response = await octokit.repos.createWebhook({
    owner,
    repo,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret,
    },
    events,
    active: true,
  });

  return {
    id: response.data.id,
    url: webhookUrl,
  };
}

function injectTokenIntoUrl(url: string, token: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = token;
    parsed.password = "x-oauth-basic";
    return parsed.toString();
  } catch {
    return url;
  }
}
