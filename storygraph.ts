#!/usr/bin/env bun
/**
 * StoryGraph — search, shelves, and shelf management.
 *
 * Uses StoryGraph's internal web endpoints (Rails + Turbo).
 *
 * Auth: set STORYGRAPH_COOKIE and STORYGRAPH_CSRF env vars.
 * Get them via /refresh-storygraph prompt or Chrome DevTools.
 *
 * Usage:
 *   bun storygraph.ts search "Nettle & Bone"
 *   bun storygraph.ts shelves                                # list all shelves
 *   bun storygraph.ts shelf read                             # list books on a shelf
 *   bun storygraph.ts shelf currently-reading
 *   bun storygraph.ts shelf to-read
 *   bun storygraph.ts shelves add <book_uuid> to-read        # set book status
 *   bun storygraph.ts shelves move <book_uuid> read          # move book to shelf
 *   bun storygraph.ts shelves remove <book_uuid>             # remove from library
 *   bun storygraph.ts status                                 # summary of all shelves
 *   bun storygraph.ts batch "Book 1" "Book 2"                # search multiple books
 */

const BASE = "https://app.thestorygraph.com";
const USERNAME = "adityasharma";

const SHELF_PATHS: Record<string, string> = {
  read: "books-read",
  "currently-reading": "currently-reading",
  "to-read": "to-read",
};

function getAuth(): { cookie: string; csrf: string } | null {
  const cookie = process.env.STORYGRAPH_COOKIE;
  const csrf = process.env.STORYGRAPH_CSRF;

  if (!cookie || !csrf) {
    console.error(
      "Set STORYGRAPH_COOKIE and STORYGRAPH_CSRF env vars.\n" +
        "Use /refresh-storygraph prompt or Chrome DevTools:\n" +
        "  Cookie: full cookie string from any app.thestorygraph.com request\n" +
        "  CSRF: meta[name='csrf-token'] content from page source"
    );
    return null;
  }
  return { cookie, csrf };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Search ---

interface SGSearchResult {
  id: string;
  title: string;
  author: string;
  pages: string;
  format: string;
}

async function search(query: string): Promise<SGSearchResult[]> {
  const auth = getAuth();
  const headers: Record<string, string> = {};
  if (auth) headers["Cookie"] = auth.cookie;

  const encoded = encodeURIComponent(query);
  const resp = await fetch(BASE + "/browse?search_term=" + encoded, { headers });
  const html = await resp.text();

  const results: SGSearchResult[] = [];
  const seen = new Set<string>();

  const bookRegex = /<h3[^>]*>[\s\S]*?<a href="\/books\/([a-f0-9-]+)">([\s\S]*?)<\/a>/g;
  let m;
  while ((m = bookRegex.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);

    const title = decodeEntities(m[2].replace(/<[^>]+>/g, ""));
    const afterMatch = html.substring(m.index, m.index + 500);
    const authorMatch = afterMatch.match(/<a[^>]*href="\/authors\/[^"]*"[^>]*>(.*?)<\/a>/) || afterMatch.match(/by\s*<a[^>]*>(.*?)<\/a>/);
    const pagesMatch = afterMatch.match(/(\d+)\s*pages/);
    const formatMatch = afterMatch.match(/•\s*([\w\s]+?)\s*(?:•|<)/);

    results.push({
      id,
      title,
      author: authorMatch ? decodeEntities(authorMatch[1]) : "?",
      pages: pagesMatch ? pagesMatch[1] : "?",
      format: formatMatch ? formatMatch[1].trim() : "?",
    });
  }

  return results;
}

// --- Shelf Operations ---

async function getShelf(shelfName: string): Promise<any[]> {
  const auth = getAuth();
  if (!auth) return [];

  const path = SHELF_PATHS[shelfName] ?? shelfName;
  const resp = await fetch(BASE + "/" + path + "/" + USERNAME, {
    headers: { Cookie: auth.cookie },
  });
  const html = await resp.text();

  const books: any[] = [];
  const seen = new Set<string>();

  // Primary: parse from img alt="Title by Author" which is most reliable
  const imgRegex = /<a href="\/books\/([a-f0-9-]+)">\s*<img alt="([^"]+)"/g;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);

    const alt = decodeEntities(m[2]);
    const byIdx = alt.lastIndexOf(" by ");
    const title = byIdx >= 0 ? alt.substring(0, byIdx) : alt;
    const author = byIdx >= 0 ? alt.substring(byIdx + 4) : "?";

    books.push({ id, title, author });
  }

  return books;
}

async function setStatus(bookId: string, status: string): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;

  const resp = await fetch(
    BASE + "/update-status.js?book_id=" + bookId + "&status=" + status,
    {
      method: "POST",
      headers: {
        Cookie: auth.cookie,
        "X-CSRF-Token": auth.csrf,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "text/javascript",
      },
    }
  );

  return resp.ok;
}

async function removeBook(bookId: string): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;

  const resp = await fetch(
    BASE + "/remove-book/" + bookId + "?remove_tags=true",
    {
      method: "POST",
      headers: {
        Cookie: auth.cookie,
        "X-CSRF-Token": auth.csrf,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "text/javascript",
      },
    }
  );

  return resp.ok;
}

// --- Display ---

function printSearchResults(results: SGSearchResult[], query: string) {
  if (!results.length) {
    console.log('  No results for "' + query + '"');
    return;
  }

  console.log("\n  Search: \"" + query + "\" (" + results.length + " results)");
  console.log("  " + "-".repeat(62));

  for (const r of results) {
    const pages = r.pages !== "?" ? " " + r.pages + "p" : "";
    const fmt = r.format !== "?" ? " " + r.format : "";
    console.log("    " + r.title + " by " + r.author + pages + fmt + "  [" + r.id + "]");
  }
}

function printShelf(books: any[], shelfName: string) {
  if (!books.length) {
    console.log('  No books on "' + shelfName + '" shelf.');
    return;
  }

  console.log("\n  " + shelfName + " (" + books.length + ")");
  console.log("  " + "-".repeat(58));

  for (const b of books) {
    console.log("    " + b.title + " by " + b.author + "  [" + b.id + "]");
  }
}

// --- CLI ---

const VALID_STATUSES = ["to-read", "currently-reading", "read", "paused", "did-not-finish"];

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "search": {
    const query = rest.join(" ");
    if (!query) {
      console.log('Usage: bun storygraph.ts search "Book Title"');
      break;
    }
    const results = await search(query);
    printSearchResults(results, query);
    break;
  }

  case "shelf": {
    const shelfName = rest[0] ?? "read";
    const books = await getShelf(shelfName);
    printShelf(books, shelfName);
    break;
  }

  case "shelves": {
    const sub = rest[0];
    if (sub === "add" || sub === "move") {
      const bookId = rest[1];
      const status = rest[2];
      if (!bookId || !status) {
        console.log("Usage: bun storygraph.ts shelves " + sub + " <book_uuid> <status>");
        console.log("Statuses: " + VALID_STATUSES.join(", "));
        break;
      }
      if (!VALID_STATUSES.includes(status)) {
        console.log("Invalid status. Use: " + VALID_STATUSES.join(", "));
        break;
      }
      const ok = await setStatus(bookId, status);
      console.log(ok ? 'Book ' + (sub === "move" ? "moved" : "added") + ' to "' + status + '".' : "Failed.");
    } else if (sub === "remove") {
      const bookId = rest[1];
      if (!bookId) {
        console.log("Usage: bun storygraph.ts shelves remove <book_uuid>");
        break;
      }
      const ok = await removeBook(bookId);
      console.log(ok ? "Book removed from library." : "Failed.");
    } else {
      const shelves = ["currently-reading", "read", "to-read"];
      console.log("\n  Bookshelves");
      console.log("  " + "-".repeat(40));
      for (const s of shelves) {
        const books = await getShelf(s);
        console.log("    " + s.padEnd(25) + " " + books.length);
      }
    }
    break;
  }

  case "status": {
    const shelves = ["currently-reading", "read", "to-read"];
    for (const s of shelves) {
      const books = await getShelf(s);
      console.log("\n  " + s + " (" + books.length + ")");
      console.log("  " + "-".repeat(58));
      const display = s === "read" ? books.slice(0, 10) : books;
      for (const b of display) {
        console.log("    " + b.title + " by " + b.author + "  [" + b.id + "]");
      }
      if (s === "read" && books.length > 10) {
        console.log("    ... and " + (books.length - 10) + " more");
      }
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
    console.log("StoryGraph CLI\n\n" +
      "Usage:\n" +
      '  bun storygraph.ts search "Book Title"                   Search for books\n' +
      "  bun storygraph.ts shelves                                List shelf counts\n" +
      "  bun storygraph.ts shelf read                             List books on a shelf\n" +
      "  bun storygraph.ts shelf currently-reading\n" +
      "  bun storygraph.ts shelf to-read\n" +
      "  bun storygraph.ts shelves add <book_uuid> <status>       Set book status\n" +
      "  bun storygraph.ts shelves move <book_uuid> <status>      Move book to status\n" +
      "  bun storygraph.ts shelves remove <book_uuid>             Remove from library\n" +
      "  bun storygraph.ts status                                 Summary of all shelves\n" +
      '  bun storygraph.ts batch "Book 1" "Book 2"                Search multiple books\n\n' +
      "Statuses: to-read, currently-reading, read, paused, did-not-finish");
}
