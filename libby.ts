#!/usr/bin/env bun
/**
 * Libby (OverDrive) — search, loans, holds, and place holds.
 *
 * Uses the Sentry + Thunder APIs (same as the Libby web app).
 *
 * Auth: set LIBBY_BEARER_TOKEN env var.
 * Get it from Chrome DevTools on libbyapp.com:
 *   Network tab → filter "sentry" → copy Authorization header (without "Bearer " prefix)
 *
 * Usage:
 *   bun libby.ts search "Nettle & Bone"           Search all libraries
 *   bun libby.ts search "Babel" --library sdcl     Search a specific library only
 *   bun libby.ts status                            Show loans + holds
 *   bun libby.ts loans                             Show current loans
 *   bun libby.ts holds                             Show current holds
 *   bun libby.ts holds add 5969856                 Place a hold
 *   bun libby.ts holds add 5969856 --card 94349882 Place hold on specific card
 *   bun libby.ts holds remove 5969856              Remove a hold
 *   bun libby.ts batch "Book 1" "Book 2"           Search multiple books
 */

const SENTRY = "https://sentry.libbyapp.com";
const THUNDER = "https://thunder.api.overdrive.com/v2";
const ALL_LIBRARIES = ["kcls", "sdcl"];

// Card IDs (from sync)
const CARDS: Record<string, string> = {
  kcls: "21252505",
  sdcl: "94349882",
};

function getToken(): string | null {
  const token = process.env.LIBBY_BEARER_TOKEN;
  if (!token) {
    console.error(
      "Set LIBBY_BEARER_TOKEN env var.\n" +
        "Get it from Chrome DevTools on libbyapp.com:\n" +
        "  Network tab → filter 'sentry' → Authorization header (without 'Bearer ' prefix)"
    );
    return null;
  }
  return token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function apiGet(url: string, token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  return resp.json();
}

async function apiPost(url: string, body: any, token: string) {
  const resp = await fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  return resp.json();
}

// --- Search (no auth needed) ---

interface LibbySearchResult {
  id: string;
  title: string;
  author: string;
  type: string;
  available: boolean;
  availableCopies: number;
  ownedCopies: number;
  holdsCount: number;
  estimatedWaitDays?: number;
}

interface LibbySearchResultWithLibrary extends LibbySearchResult {
  library: string;
}

async function searchOneLibrary(query: string, library: string): Promise<LibbySearchResultWithLibrary[]> {
  const encoded = encodeURIComponent(query);
  const data = await apiGet(
    `${THUNDER}/libraries/${library}/media?query=${encoded}&mediaTypes=ebook&mediaTypes=audiobook&page=1&perPage=20&x-client-id=dewey`
  );

  return (data.items ?? []).map((item: any) => ({
    id: String(item.id),
    title: item.title ?? "?",
    author: item.firstCreatorName ?? "?",
    type: item.type?.id ?? "?",
    available: item.isAvailable ?? false,
    availableCopies: item.availableCopies ?? 0,
    ownedCopies: item.ownedCopies ?? 0,
    holdsCount: item.holdsCount ?? 0,
    estimatedWaitDays: item.estimatedWaitDays,
    library: library.toUpperCase(),
  }));
}

async function search(query: string, library?: string): Promise<LibbySearchResultWithLibrary[]> {
  const libs = library ? [library] : ALL_LIBRARIES;
  const allResults = await Promise.all(libs.map(lib => searchOneLibrary(query, lib)));
  return allResults.flat();
}

// --- Sync (loans + holds) ---

async function sync() {
  const token = getToken();
  if (!token) return null;
  return apiGet(`${SENTRY}/chip/sync`, token);
}

async function getLoans() {
  const data = await sync();
  if (!data) return [];

  const cardMap: Record<string, string> = {};
  for (const card of data.cards ?? []) {
    cardMap[card.cardId] = card.library?.name ?? "?";
  }

  return (data.loans ?? []).map((l: any) => ({
    title: l.title ?? "?",
    author: l.firstCreatorName ?? "?",
    type: l.type?.id ?? "?",
    expires: l.expireDate ? l.expireDate.split("T")[0] : "?",
    library: cardMap[l.cardId] ?? "?",
    cardId: l.cardId,
  }));
}

async function getHolds() {
  const data = await sync();
  if (!data) return [];

  const cardMap: Record<string, string> = {};
  for (const card of data.cards ?? []) {
    cardMap[card.cardId] = card.library?.name ?? "?";
  }

  return (data.holds ?? []).map((h: any) => ({
    title: h.title ?? "?",
    author: h.firstCreatorName ?? "?",
    type: h.type?.id ?? "?",
    position: h.holdListPosition ?? 0,
    totalHolds: h.holdsCount ?? 0,
    ownedCopies: h.ownedCopies ?? 0,
    available: h.isAvailable ?? false,
    suspended: h.suspensionFlag ?? false,
    estimatedWaitDays: h.estimatedWaitDays,
    library: cardMap[h.cardId] ?? "?",
    cardId: h.cardId,
    mediaId: String(h.id ?? ""),
  }));
}

// --- Place / Remove Hold ---

async function placeHold(mediaId: string, cardId?: string) {
  const token = getToken();
  if (!token) return null;

  const card = cardId ?? CARDS["kcls"];
  try {
    const data = await apiPost(
      `${SENTRY}/card/${card}/hold/${mediaId}`,
      { days_to_suspend: 0, email_address: "" },
      token
    );
    return data;
  } catch (e: any) {
    console.error("Hold failed:", e.message);
    return null;
  }
}

async function removeHold(mediaId: string, cardId?: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  // If no card specified, find which card has this hold
  if (!cardId) {
    const data = await sync();
    const hold = data?.holds?.find((h: any) => String(h.id) === mediaId);
    if (hold) {
      cardId = hold.cardId;
    } else {
      console.error(`Hold for media ID ${mediaId} not found. Use 'bun libby.ts holds' to list.`);
      return false;
    }
  }

  try {
    const resp = await fetch(`${SENTRY}/card/${cardId}/hold/${mediaId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// --- Display ---

function printSearchResults(results: LibbySearchResultWithLibrary[], query: string) {
  if (!results.length) {
    console.log(`  No results for "${query}"`);
    return;
  }

  // Group by title + library
  const titles = new Map<string, LibbySearchResultWithLibrary[]>();
  for (const r of results) {
    const key = r.title;
    if (!titles.has(key)) titles.set(key, []);
    titles.get(key)!.push(r);
  }

  for (const [title, items] of titles) {
    console.log(`\n  ${title} by ${items[0].author}`);
    console.log("  " + "-".repeat(62));
    for (const r of items) {
      const icon = r.available ? "✓" : "✗";
      const holds = r.holdsCount ? `, ${r.holdsCount} holds` : "";
      const wait = r.estimatedWaitDays ? ` (~${r.estimatedWaitDays}d)` : "";
      console.log(
        `    ${icon} ${r.library.padEnd(5)} ${r.type.padEnd(12)}  ${r.availableCopies}/${r.ownedCopies} copies${holds}${wait}  [${r.id}]`
      );
    }
  }
}

function printLoans(loans: any[]) {
  if (!loans.length) {
    console.log("  No active loans.");
    return;
  }

  console.log(`\n  Loans (${loans.length})`);
  console.log("  " + "-".repeat(58));

  loans.sort((a: any, b: any) => a.expires.localeCompare(b.expires));

  for (const l of loans) {
    const lib = l.library.includes("King County") ? "KCLS" : l.library.includes("San Diego") ? "SDCL" : l.library;
    console.log(`    ${l.expires}  ${l.title} [${l.type}] — ${lib}`);
  }
}

function printHolds(holds: any[]) {
  if (!holds.length) {
    console.log("  No active holds.");
    return;
  }

  const ready = holds.filter((h: any) => h.available);
  const suspended = holds.filter((h: any) => h.suspended && !h.available);
  const waiting = holds.filter((h: any) => !h.available && !h.suspended);

  console.log(`\n  Holds (${holds.length})`);
  console.log("  " + "-".repeat(58));

  if (ready.length) {
    console.log("  READY:");
    for (const h of ready) {
      const lib = h.library.includes("King County") ? "KCLS" : h.library.includes("San Diego") ? "SDCL" : h.library;
      console.log(`    ★ ${h.title} [${h.type}] — ${lib}`);
    }
  }

  if (waiting.length) {
    console.log("  WAITING:");
    for (const h of waiting) {
      const lib = h.library.includes("King County") ? "KCLS" : h.library.includes("San Diego") ? "SDCL" : h.library;
      const wait = h.estimatedWaitDays ? ` (~${h.estimatedWaitDays}d)` : "";
      const id = h.mediaId ? `  [${h.mediaId}]` : "";
      console.log(`    … #${h.position} ${h.title} [${h.type}] — ${lib}${wait}${id}`);
    }
  }

  if (suspended.length) {
    console.log("  SUSPENDED:");
    for (const h of suspended) {
      const lib = h.library.includes("King County") ? "KCLS" : h.library.includes("San Diego") ? "SDCL" : h.library;
      const id = h.mediaId ? `  [${h.mediaId}]` : "";
      console.log(`    ⏸ ${h.title} [${h.type}] — ${lib}${id}`);
    }
  }
}

// --- CLI ---

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "search": {
    const libIdx = rest.indexOf("--library");
    const library = libIdx >= 0 ? rest[libIdx + 1] : undefined;
    const query = libIdx >= 0
      ? rest.filter((_, i) => i !== libIdx && i !== libIdx + 1).join(" ")
      : rest.join(" ");
    const results = await search(query, library);
    printSearchResults(results, query);
    break;
  }

  case "loans": {
    const loans = await getLoans();
    printLoans(loans);
    break;
  }

  case "holds": {
    const sub = rest[0];
    if (sub === "add") {
      const mediaId = rest[1];
      if (!mediaId) { console.log("Usage: bun libby.ts holds add <media_id> [--card <card_id>]"); break; }
      const cardIdx = rest.indexOf("--card");
      const cardId = cardIdx >= 0 ? rest[cardIdx + 1] : undefined;
      const result = await placeHold(mediaId, cardId);
      console.log(result ? "Hold placed!" : "Failed to place hold.");
    } else if (sub === "remove") {
      const mediaId = rest[1];
      if (!mediaId) { console.log("Usage: bun libby.ts holds remove <media_id> [--card <card_id>]"); break; }
      const cardIdx = rest.indexOf("--card");
      const cardId = cardIdx >= 0 ? rest[cardIdx + 1] : undefined;
      const ok = await removeHold(mediaId, cardId);
      console.log(ok ? "Hold removed." : "Failed to remove hold.");
    } else {
      const holds = await getHolds();
      printHolds(holds);
    }
    break;
  }

  case "status": {
    const data = await sync();
    if (data) {
      const cardMap: Record<string, string> = {};
      for (const card of data.cards ?? []) {
        cardMap[card.cardId] = card.library?.name ?? "?";
      }

      const loans = (data.loans ?? []).map((l: any) => ({
        title: l.title ?? "?",
        author: l.firstCreatorName ?? "?",
        type: l.type?.id ?? "?",
        expires: l.expireDate ? l.expireDate.split("T")[0] : "?",
        library: cardMap[l.cardId] ?? "?",
      }));

      const holds = (data.holds ?? []).map((h: any) => ({
        title: h.title ?? "?",
        author: h.firstCreatorName ?? "?",
        type: h.type?.id ?? "?",
        position: h.holdListPosition ?? 0,
        available: h.isAvailable ?? false,
        suspended: h.suspensionFlag ?? false,
        estimatedWaitDays: h.estimatedWaitDays,
        library: cardMap[h.cardId] ?? "?",
      }));

      printLoans(loans);
      printHolds(holds);
    }
    break;
  }

  case "hold": {
    const mediaId = rest[0];
    const cardIdx = rest.indexOf("--card");
    const cardId = cardIdx >= 0 ? rest[cardIdx + 1] : undefined;
    const result = await placeHold(mediaId, cardId);
    if (result) {
      console.log("Hold placed!");
    } else {
      console.log("Failed to place hold.");
    }
    break;
  }

  case "batch": {
    for (const book of rest) {
      const results = await search(book);
      printSearchResults(results, book);
    }
    break;
  }

  default:
    console.log(`Libby (OverDrive) CLI

Usage:
  bun libby.ts search "Book Title"                  Search all libraries
  bun libby.ts search "Title" --library sdcl         Search specific library only
  bun libby.ts status                                Show loans + holds
  bun libby.ts loans                                 Show current loans
  bun libby.ts holds                                 List current holds
  bun libby.ts holds add <media_id>                  Place a hold
  bun libby.ts holds add <media_id> --card <card_id> Place hold on specific card
  bun libby.ts holds remove <media_id>               Remove a hold
  bun libby.ts holds remove <media_id> --card <id>   Remove from specific card
  bun libby.ts batch "Book 1" "Book 2"               Search multiple books`);
}
