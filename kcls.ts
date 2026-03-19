#!/usr/bin/env bun
/**
 * KCLS Library Catalog — search availability and place holds.
 *
 * Uses the BiblioCommons gateway API (same as the website frontend).
 *
 * Auth: set env vars KCLS_ACCESS_TOKEN and KCLS_SESSION_ID.
 * Get them from Chrome DevTools > Application > Cookies > bibliocommons.com:
 *   bc_access_token → KCLS_ACCESS_TOKEN
 *   session_id      → KCLS_SESSION_ID
 *
 * Usage:
 *   bun kcls.ts search "Nettle & Bone"
 *   bun kcls.ts search "Babel R.F. Kuang" --format BK
 *   bun kcls.ts holds                             # list current holds
 *   bun kcls.ts holds add S82C2258007             # place a hold
 *   bun kcls.ts holds add S82C2258007 --format DIGITAL
 *   bun kcls.ts holds remove <hold_id>            # remove a hold
 *   bun kcls.ts checkouts                         # list checked out books
 *   bun kcls.ts status                            # both checkouts + holds
 *   bun kcls.ts batch "Nettle & Bone" "Foundryside" "Goblin Emperor"
 */

const GATEWAY = "https://gateway.bibliocommons.com/v2/libraries/kcls";
const ACCOUNT_ID = 1447758618;
const BRANCH_ID = "1533"; // Redmond

interface SearchResult {
  id: string;
  title: string;
  authors: string[];
  format: string;
  status: string;
  availableCopies: number;
  totalCopies: number;
  holds: number;
}

interface HoldResult {
  holdId: string;
  position: number;
  status: string;
  pickup: string;
  placed: string;
}

function getTokens(): { accessToken: string; sessionId: string } | null {
  const accessToken = process.env.KCLS_ACCESS_TOKEN;
  const sessionId = process.env.KCLS_SESSION_ID;

  if (!accessToken || !sessionId) {
    console.error(
      "Set KCLS_ACCESS_TOKEN and KCLS_SESSION_ID env vars.\n" +
        "Chrome DevTools > Application > Cookies > bibliocommons.com:\n" +
        "  bc_access_token → KCLS_ACCESS_TOKEN\n" +
        "  session_id      → KCLS_SESSION_ID"
    );
    return null;
  }
  return { accessToken, sessionId };
}

function authHeaders(accessToken: string, sessionId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-access-token": accessToken,
    "x-session-id": sessionId,
  };
}

async function apiRequest(method: string, url: string, body?: any, tokens?: { accessToken: string; sessionId: string }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens) {
    headers["x-access-token"] = tokens.accessToken;
    headers["x-session-id"] = tokens.sessionId;
  }

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    throw new Error(`${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

async function search(query: string, fmtFilter?: string): Promise<SearchResult[]> {
  const tokens = getTokens();
  const data = await apiRequest(
    "POST",
    `${GATEWAY}/bibs/search?locale=en-US`,
    { query, searchType: "smart", view: "grouped" },
    tokens ?? undefined
  );

  const bibs = data?.entities?.bibs ?? {};
  const results: SearchResult[] = [];

  for (const [bibId, bib] of Object.entries(bibs) as any[]) {
    const info = bib.briefInfo ?? {};
    const avail = bib.availability ?? {};
    const fmt = info.format ?? "?";

    if (fmtFilter && fmt !== fmtFilter) continue;

    results.push({
      id: bibId,
      title: info.title ?? "?",
      authors: info.authors ?? [],
      format: fmt,
      status: avail.status ?? "?",
      availableCopies: avail.availableCopies ?? 0,
      totalCopies: avail.totalCopies ?? 0,
      holds: avail.heldCopies ?? 0,
    });
  }

  return results;
}

async function placeHold(metadataId: string, materialType = "PHYSICAL"): Promise<HoldResult | null> {
  const tokens = getTokens();
  if (!tokens) return null;

  try {
    const data = await apiRequest(
      "POST",
      `${GATEWAY}/holds?locale=en-US`,
      {
        metadataId,
        materialType,
        accountId: ACCOUNT_ID,
        enableSingleClickHolds: false,
        materialParams: {
          branchId: BRANCH_ID,
          expiryDate: null,
          errorMessageLocale: "en-US",
        },
      },
      tokens
    );

    const holds = data?.entities?.holds ?? {};
    const hold = Object.values(holds)[0] as any;
    if (hold) {
      return {
        holdId: hold.holdsId,
        position: hold.holdsPosition,
        status: hold.status,
        pickup: hold.pickupLocation?.name ?? "?",
        placed: hold.holdPlacedDate,
      };
    }
  } catch (e: any) {
    console.error("Hold failed:", e.message);
  }
  return null;
}

async function cancelHold(holdId: string): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;

  try {
    const resp = await fetch(`${GATEWAY}/holds/${holdId}?locale=en-US`, {
      method: "DELETE",
      headers: authHeaders(tokens.accessToken, tokens.sessionId),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function getCheckouts(): Promise<any[]> {
  const tokens = getTokens();
  if (!tokens) return [];

  const data = await apiRequest(
    "GET",
    `${GATEWAY}/checkouts?accountId=${ACCOUNT_ID}&size=50&status=OUT&page=1&sort=status&materialType=&locale=en-US`,
    undefined,
    tokens
  );

  const bibs = data?.entities?.bibs ?? {};
  const checkouts = data?.entities?.checkouts ?? {};

  return Object.values(checkouts).map((c: any) => {
    const bib = bibs[c.metadataId] ?? {};
    return {
      title: bib.briefInfo?.title ?? "?",
      authors: (bib.briefInfo?.authors ?? []).join(", "),
      format: bib.briefInfo?.format ?? "?",
      dueDate: c.dueDate ?? "?",
      renewCount: c.renewCount ?? 0,
      autoRenew: c.autoRenewEnabled ?? false,
    };
  });
}

async function getHolds(): Promise<any[]> {
  const tokens = getTokens();
  if (!tokens) return [];

  const data = await apiRequest(
    "GET",
    `${GATEWAY}/holds?accountId=${ACCOUNT_ID}&size=50&locale=en-US`,
    undefined,
    tokens
  );

  const bibs = data?.entities?.bibs ?? {};
  const holds = data?.entities?.holds ?? {};

  return Object.values(holds).map((h: any) => {
    const bib = bibs[h.metadataId] ?? {};
    return {
      holdId: h.holdsId,
      metadataId: h.metadataId,
      title: bib.briefInfo?.title ?? "?",
      authors: (bib.briefInfo?.authors ?? []).join(", "),
      format: bib.briefInfo?.format ?? "?",
      position: h.holdsPosition,
      status: h.status,
      pickup: h.pickupLocation?.name ?? "?",
    };
  });
}

function printCheckouts(checkouts: any[]) {
  if (!checkouts.length) {
    console.log("  No books checked out.");
    return;
  }

  console.log(`\n  Checked Out (${checkouts.length})`);
  console.log("  " + "-".repeat(58));

  // Sort by due date
  checkouts.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  for (const c of checkouts) {
    console.log(`    ${c.dueDate}  ${c.title} [${c.format}]`);
  }
}

function printHolds(holds: any[]) {
  if (!holds.length) {
    console.log("  No active holds.");
    return;
  }

  const ready = holds.filter(h => h.status === "READY_FOR_PICKUP");
  const transit = holds.filter(h => h.status === "IN_TRANSIT");
  const waiting = holds.filter(h => h.status === "NOT_YET_AVAILABLE");
  const suspended = holds.filter(h => h.status === "SUSPENDED");

  console.log(`\n  Holds (${holds.length})`);
  console.log("  " + "-".repeat(58));

  if (ready.length) {
    console.log("  READY FOR PICKUP:");
    for (const h of ready) {
      console.log(`    ★ ${h.title} [${h.format}] — ${h.pickup}  [${h.metadataId}] hold:${h.holdId}`);
    }
  }

  if (transit.length) {
    console.log("  IN TRANSIT:");
    for (const h of transit) {
      console.log(`    → ${h.title} [${h.format}] #${h.position}  [${h.metadataId}] hold:${h.holdId}`);
    }
  }

  if (waiting.length) {
    console.log("  WAITING:");
    for (const h of waiting) {
      console.log(`    … ${h.title} [${h.format}] #${h.position} in queue  [${h.metadataId}] hold:${h.holdId}`);
    }
  }

  if (suspended.length) {
    console.log("  SUSPENDED:");
    for (const h of suspended) {
      console.log(`    ⏸ ${h.title} [${h.format}]  [${h.metadataId}] hold:${h.holdId}`);
    }
  }
}

function printResults(results: SearchResult[], query: string) {
  if (!results.length) {
    console.log(`  No results for "${query}"`);
    return;
  }

  const { title, authors } = results[0];
  console.log(`\n  ${title} by ${authors.join(", ")}`);
  console.log("  " + "-".repeat(58));

  for (const r of results) {
    const icon = r.status === "AVAILABLE" ? "✓" : "✗";
    const holds = r.holds ? `, ${r.holds} holds` : "";
    console.log(
      `    ${icon} ${r.format.padEnd(12)}  ${r.availableCopies}/${r.totalCopies} copies${holds}  [${r.id}]`
    );
  }
}

// --- CLI ---

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "search": {
    const fmtIdx = rest.indexOf("--format");
    const fmt = fmtIdx >= 0 ? rest[fmtIdx + 1] : undefined;
    const query = fmtIdx >= 0
      ? rest.filter((_, i) => i !== fmtIdx && i !== fmtIdx + 1).join(" ")
      : rest.join(" ");
    const results = await search(query, fmt);
    printResults(results, query);
    break;
  }

  case "hold": {
    // Legacy: bun kcls.ts hold S82C2258007
    const metadataId = rest[0];
    const fmtIdx = rest.indexOf("--format");
    const material = fmtIdx >= 0 ? rest[fmtIdx + 1] : "PHYSICAL";
    const result = await placeHold(metadataId, material);
    if (result) {
      console.log(`Hold placed! Position: #${result.position}, Pickup: ${result.pickup}`);
    } else {
      console.log("Failed to place hold.");
    }
    break;
  }

  case "cancel": {
    // Legacy: bun kcls.ts cancel <hold_id>
    const ok = await cancelHold(rest[0]);
    console.log(ok ? "Hold removed." : "Failed to remove hold.");
    break;
  }

  case "batch": {
    for (const book of rest) {
      const results = await search(book);
      printResults(results, book);
    }
    break;
  }

  case "checkouts": {
    const checkouts = await getCheckouts();
    printCheckouts(checkouts);
    break;
  }

  case "holds": {
    const sub = rest[0];
    if (sub === "add") {
      const metadataId = rest[1];
      if (!metadataId) { console.log("Usage: bun kcls.ts holds add <metadata_id> [--format PHYSICAL|DIGITAL]"); break; }
      const fmtIdx = rest.indexOf("--format");
      const material = fmtIdx >= 0 ? rest[fmtIdx + 1] : "PHYSICAL";
      const result = await placeHold(metadataId, material);
      if (result) {
        console.log(`Hold placed! Position: #${result.position}, Pickup: ${result.pickup}`);
      } else {
        console.log("Failed to place hold.");
      }
    } else if (sub === "remove") {
      const holdId = rest[1];
      if (!holdId) { console.log("Usage: bun kcls.ts holds remove <hold_id>\nRun 'bun kcls.ts holds' to see hold IDs."); break; }
      const ok = await cancelHold(holdId);
      console.log(ok ? "Hold removed." : "Failed to remove hold.");
    } else {
      const holds = await getHolds();
      printHolds(holds);
    }
    break;
  }

  case "status": {
    const [checkouts, holds] = await Promise.all([getCheckouts(), getHolds()]);
    printCheckouts(checkouts);
    printHolds(holds);
    break;
  }

  default:
    console.log(`KCLS Library Catalog CLI

Usage:
  bun kcls.ts search "Book Title"                   Search catalog
  bun kcls.ts search "Title" --format BK             Filter by format (BK, EBOOK, AB)
  bun kcls.ts holds                                  List current holds
  bun kcls.ts holds add <metadata_id>                Place a hold
  bun kcls.ts holds add <metadata_id> --format DIGITAL
  bun kcls.ts holds remove <hold_id>                 Remove a hold
  bun kcls.ts checkouts                              List checked out books
  bun kcls.ts status                                 Both checkouts + holds
  bun kcls.ts batch "Book 1" "Book 2"                Search multiple books`);
}
