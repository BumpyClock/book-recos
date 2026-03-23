#!/usr/bin/env bun
/**
 * Refresh KCLS auth tokens from Chrome cookies via Playwriter MCP.
 *
 * Prerequisites:
 *   1. Chrome is open with a tab on kcls.bibliocommons.com
 *   2. You're logged in to KCLS
 *   3. Playwriter extension is enabled on that tab
 *
 * Usage:
 *   bun refresh-kcls-tokens.ts
 *
 * Updates .env with fresh KCLS_ACCESS_TOKEN and KCLS_SESSION_ID.
 */

import { $ } from "bun";

const ENV_PATH = `${import.meta.dir}/.env`;

async function runPlaywriter(args: string[]): Promise<string> {
  const proc = Bun.spawn(["npx", "playwriter", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim() || `playwriter exited with code ${exitCode}`;
    throw new Error(detail);
  }

  return stdout;
}

function extractPlaywriterSessionId(output: string): string {
  const trimmed = output.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/Session\s+([^\s]+)\s+created/i);
  if (match) {
    return match[1];
  }

  throw new Error(`Could not parse Playwriter session ID from output: ${trimmed}`);
}

// Use playwriter CLI to extract cookies from the browser
const code = `
const page = context.pages()[0];
if (!page) {
  console.log('ERROR: No connected Playwriter page. Open Chrome on kcls.bibliocommons.com and enable the Playwriter extension.');
} else {
  const cdp = await getCDPSession({ page });
  const { cookies } = await cdp.send('Network.getCookies', {
    urls: ['https://kcls.bibliocommons.com', 'https://gateway.bibliocommons.com']
  });
  const token = cookies.find(c => c.name === 'bc_access_token');
  const session = cookies.find(c => c.name === 'session_id');
  if (!token || !session) {
    console.log('ERROR: Not logged in to KCLS. Log in at kcls.bibliocommons.com first.');
  } else {
    console.log('TOKEN:' + token.value);
    console.log('SESSION:' + session.value);
  }
}
`;

try {
  const sessionId = extractPlaywriterSessionId(await runPlaywriter(["session", "new"]));
  let result = "";

  try {
    result = await runPlaywriter(["-s", sessionId, "-e", code]);
  } finally {
    await $`npx playwriter session delete ${sessionId}`.quiet();
  }

  const lines = result.split("\n");

  const tokenLine = lines.find((l: string) => l.includes("TOKEN:"));
  const sessionLine = lines.find((l: string) => l.includes("SESSION:"));

  if (!tokenLine || !sessionLine) {
    const errorLine = lines.find((l: string) => l.includes("ERROR:"));
    console.error(errorLine ?? "Failed to extract tokens. Is Chrome open with Playwriter on a KCLS tab?");
    console.error("Raw output:", result);
    process.exit(1);
  }

  const accessToken = tokenLine.split("TOKEN:")[1].trim();
  const refreshedSessionId = sessionLine.split("SESSION:")[1].trim();

  // Read existing .env and update/add the tokens
  let env = "";
  try {
    env = await Bun.file(ENV_PATH).text();
  } catch {
    // .env doesn't exist yet
  }

  const updates: Record<string, string> = {
    KCLS_ACCESS_TOKEN: accessToken,
    KCLS_SESSION_ID: refreshedSessionId,
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(env)) {
      env = env.replace(regex, `${key}=${value}`);
    } else {
      env = env.trimEnd() + `\n${key}=${value}\n`;
    }
  }

  await Bun.write(ENV_PATH, env);
  console.log("Updated .env with fresh KCLS tokens:");
  console.log(`  KCLS_ACCESS_TOKEN=${accessToken.slice(0, 8)}...`);
  console.log(`  KCLS_SESSION_ID=${refreshedSessionId.slice(0, 8)}...`);
} catch (e: any) {
  console.error("Failed to refresh KCLS tokens via Playwriter");
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
