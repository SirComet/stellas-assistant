import { NodeSSH } from "node-ssh";
import SftpClient from "ssh2-sftp-client";
import path from "path";
import fs from "fs";
import type { DeployTarget } from "../types/index.js";

export interface SshConnectionConfig {
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  privateKey?: string;
  password?: string;
}

export interface SftpTransferResult {
  success: boolean;
  filesTransferred: number;
  errors: string[];
  duration: number;
}

export async function testSshConnection(
  target: Pick<DeployTarget, "host" | "port" | "username" | "authType" | "privateKey" | "password">
): Promise<{ success: boolean; message: string; latency?: number }> {
  const ssh = new NodeSSH();
  const start = Date.now();

  try {
    const connectConfig: Parameters<typeof ssh.connect>[0] = {
      host: target.host,
      port: target.port,
      username: target.username,
      readyTimeout: 10000,
    };

    if (target.authType === "key" && target.privateKey) {
      connectConfig.privateKey = target.privateKey;
    } else if (target.authType === "password" && target.password) {
      connectConfig.password = target.password;
    }

    await ssh.connect(connectConfig);
    const result = await ssh.execCommand("echo OK");
    ssh.dispose();

    const latency = Date.now() - start;
    return {
      success: result.stdout.trim() === "OK",
      message: "Connection successful",
      latency,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      message: error.message,
    };
  }
}

export async function deployViaSftp(
  target: DeployTarget,
  localBuildDir: string,
  onProgress?: (percent: number, file: string) => void
): Promise<SftpTransferResult> {
  const sftp = new SftpClient();
  const start = Date.now();
  const errors: string[] = [];
  let filesTransferred = 0;

  try {
    const connectConfig: Parameters<typeof sftp.connect>[0] = {
      host: target.host,
      port: target.port,
      username: target.username,
      readyTimeout: 15000,
    };

    if (target.authType === "key" && target.privateKey) {
      connectConfig.privateKey = target.privateKey;
    } else if (target.authType === "password" && target.password) {
      connectConfig.password = target.password;
    }

    await sftp.connect(connectConfig);

    // Ensure remote directory exists
    await sftp.mkdir(target.remotePath, true);

    // Upload all files
    const files = getAllFiles(localBuildDir);
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const localFile = files[i];
      if (!localFile) continue;

      const relativePath = path.relative(localBuildDir, localFile);
      const remoteFile = path.posix.join(target.remotePath, relativePath.split(path.sep).join("/"));
      const remoteDir = path.posix.dirname(remoteFile);

      try {
        await sftp.mkdir(remoteDir, true);
        await sftp.put(localFile, remoteFile);
        filesTransferred++;
        if (onProgress) {
          onProgress(Math.round((i / total) * 100), relativePath);
        }
      } catch (err) {
        const error = err as Error;
        errors.push(`Failed to upload ${relativePath}: ${error.message}`);
      }
    }

    await sftp.end();

    return {
      success: errors.length === 0,
      filesTransferred,
      errors,
      duration: Date.now() - start,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      filesTransferred,
      errors: [error.message, ...errors],
      duration: Date.now() - start,
    };
  }
}

export async function runSshCommand(
  target: DeployTarget,
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  const ssh = new NodeSSH();

  try {
    const connectConfig: Parameters<typeof ssh.connect>[0] = {
      host: target.host,
      port: target.port,
      username: target.username,
      readyTimeout: 10000,
    };

    if (target.authType === "key" && target.privateKey) {
      connectConfig.privateKey = target.privateKey;
    } else if (target.authType === "password" && target.password) {
      connectConfig.password = target.password;
    }

    await ssh.connect(connectConfig);
    const result = await ssh.execCommand(command);
    ssh.dispose();

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code ?? 0,
    };
  } catch (err) {
    const error = err as Error;
    throw new Error(`SSH command failed: ${error.message}`);
  }
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
