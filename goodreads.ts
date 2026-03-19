#!/usr/bin/env bun
/**
 * Goodreads — search, shelves, and shelf management.
 *
 * Uses Goodreads' internal web endpoints (no public API exists).
 *
 * Auth: set GOODREADS_COOKIE and GOODREADS_CSRF env vars.
 * Get them via /refresh-goodreads prompt or Chrome DevTools:
 *   Cookie: full cookie string from any goodreads.com request
 *   CSRF: meta[name="csrf-token"] content from any goodreads.com page
 *
 * Usage:
 *   bun goodreads.ts search "Nettle & Bone"
 *   bun goodreads.ts shelves                           # list shelf counts
 *   bun goodreads.ts shelf read                        # list books on a shelf
 *   bun goodreads.ts shelf currently-reading
 *   bun goodreads.ts shelf to-read
 *   bun goodreads.ts shelves add <book_id> read        # add book to shelf
 *   bun goodreads.ts shelves add <book_id> to-read
 *   bun goodreads.ts shelves move <book_id> read       # move book to shelf
 *   bun goodreads.ts shelves remove <book_id>          # remove from all shelves
 *   bun goodreads.ts status                            # summary of all shelves
 */

const BASE = "https://www.goodreads.com";
const USER_ID = "4434913";

function getAuth(): { cookie: string; csrf: string } | null {
  const cookie = process.env.GOODREADS_COOKIE;
  const csrf = process.env.GOODREADS_CSRF;

  if (!cookie || !csrf) {
    console.error(
      "Set GOODREADS_COOKIE and GOODREADS_CSRF env vars.\n" +
        "Use /refresh-goodreads prompt or Chrome DevTools:\n" +
        "  Cookie: full cookie string from any goodreads.com request\n" +
        "  CSRF: meta[name='csrf-token'] content from page source"
    );
    return null;
  }
  return { cookie, csrf };
}

function authHeaders(auth: { cookie: string; csrf: string }): Record<string, string> {
  return {
    Cookie: auth.cookie,
    "X-CSRF-Token": auth.csrf,
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

// --- Search ---

interface GoodreadsSearchResult {
  id: string;
  title: string;
  author: string;
  avgRating: string;
  ratingsCount: string;
}

async function search(query: string): Promise<GoodreadsSearchResult[]> {
  const auth = getAuth();
  const headers: Record<string, string> = {};
  if (auth) headers["Cookie"] = auth.cookie;

  const encoded = encodeURIComponent(query);
  const resp = await fetch(`${BASE}/search?q=${encoded}&search_type=books`, { headers });
  const html = await resp.text();

  const tableMatch = html.match(/class="tableList"([\s\S]*?)<\/table>/);
  if (!tableMatch) return [];

  const rows = tableMatch[1].match(/<tr[\s\S]*?<\/tr>/g) || [];
  const results: GoodreadsSearchResult[] = [];

  for (const row of rows) {
    const idMatch = row.match(/\/book\/show\/(\d+)/);
    const titleMatch = row.match(/class="bookTitle"[^>]*>[^<]*<span[^>]*>(.*?)<\/span>/);
    const authorMatch = row.match(/class="authorName"[^>]*>[^<]*<span[^>]*>(.*?)<\/span>/);
    const ratingMatch = row.match(/([\d.]+) avg rating/);
    const countMatch = row.match(/([\d,]+) rating/);

    if (idMatch && titleMatch) {
      results.push({
        id: idMatch[1],
        title: decodeEntities(titleMatch[1].trim()),
        author: authorMatch ? decodeEntities(authorMatch[1].trim()) : "?",
        avgRating: ratingMatch ? ratingMatch[1] : "?",
        ratingsCount: countMatch ? countMatch[1] : "0",
      });
    }
  }

  return results;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

// --- Shelf Operations ---

async function getShelf(shelfName: string): Promise<any[]> {
  const auth = getAuth();
  if (!auth) return [];

  const resp = await fetch(
    `${BASE}/review/list/${USER_ID}?shelf=${shelfName}&per_page=200&print=true`,
    { headers: { Cookie: auth.cookie } }
  );
  const html = await resp.text();

  const rows = html.match(/<tr[^>]*id="review_\d+"[\s\S]*?<\/tr>/g) || [];
  const books: any[] = [];

  for (const row of rows) {
    const idMatch = row.match(/\/book\/show\/(\d+)/);
    const titleMatch = row.match(/class="value"[\s\S]*?<a[^>]*title="([^"]+)"/);
    const ratingMatch = row.match(/data-rating="(\d+)"/);
    const dateMatch = row.match(/class="date_read_value"[^>]*>\s*(.*?)\s*<\//);

    if (idMatch) {
      books.push({
        id: idMatch[1],
        title: titleMatch ? decodeEntities(titleMatch[1]) : "?",
        rating: ratingMatch ? parseInt(ratingMatch[1]) : 0,
        dateRead: dateMatch ? dateMatch[1].trim() : null,
      });
    }
  }

  return books;
}

async function getShelfCounts(): Promise<Record<string, number>> {
  const auth = getAuth();
  if (!auth) return {};

  const resp = await fetch(`${BASE}/review/list/${USER_ID}`, {
    headers: { Cookie: auth.cookie },
  });
  const html = await resp.text();

  const counts: Record<string, number> = {};
  const regex = /shelf=([^"&]+)"[^>]*>\s*([^<]+?)\s*<\/a>\s*<[^>]*>\((\d+)\)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    counts[decodeURIComponent(m[1])] = parseInt(m[3]);
  }

  return counts;
}

async function addToShelf(bookId: string, shelfName: string): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;

  const resp = await fetch(`${BASE}/shelf/add_to_shelf`, {
    method: "POST",
    headers: authHeaders(auth),
    body: `book_id=${bookId}&name=${encodeURIComponent(shelfName)}`,
  });

  return resp.ok;
}

async function removeFromShelves(bookId: string): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;

  const resp = await fetch(`${BASE}/review/destroy/${bookId}`, {
    method: "POST",
    headers: authHeaders(auth),
    body: "_method=delete",
  });

  return resp.ok;
}

// --- Display ---

function printSearchResults(results: GoodreadsSearchResult[], query: string) {
  if (!results.length) {
    console.log(`  No results for "${query}"`);
    return;
  }

  console.log(`\n  Search: "${query}" (${results.length} results)`);
  console.log("  " + "-".repeat(62));

  for (const r of results) {
    const stars = r.avgRating !== "?" ? ` ★${r.avgRating}` : "";
    const count = r.ratingsCount !== "0" ? ` (${r.ratingsCount})` : "";
    console.log(`    ${r.title} by ${r.author}${stars}${count}  [${r.id}]`);
  }
}

function printShelf(books: any[], shelfName: string) {
  if (!books.length) {
    console.log(`  No books on "${shelfName}" shelf.`);
    return;
  }

  console.log(`\n  ${shelfName} (${books.length})`);
  console.log("  " + "-".repeat(58));

  for (const b of books) {
    const stars = b.rating ? " — " + "⭐".repeat(b.rating) : "";
    const date = b.dateRead ? ` (${b.dateRead})` : "";
    console.log(`    ${b.title}${stars}${date}  [${b.id}]`);
  }
}

// --- CLI ---

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "search": {
    const query = rest.join(" ");
    if (!query) {
      console.log('Usage: bun goodreads.ts search "Book Title"');
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
      const shelfName = rest[2];
      if (!bookId || !shelfName) {
        console.log(`Usage: bun goodreads.ts shelves ${sub} <book_id> <shelf_name>`);
        break;
      }
      const ok = await addToShelf(bookId, shelfName);
      console.log(ok ? `Book ${sub === "move" ? "moved" : "added"} to "${shelfName}".` : "Failed.");
    } else if (sub === "remove") {
      const bookId = rest[1];
      if (!bookId) {
        console.log("Usage: bun goodreads.ts shelves remove <book_id>");
        break;
      }
      const ok = await removeFromShelves(bookId);
      console.log(ok ? "Book removed from all shelves." : "Failed.");
    } else {
      const counts = await getShelfCounts();
      if (Object.keys(counts).length) {
        console.log("\n  Bookshelves");
        console.log("  " + "-".repeat(40));
        for (const [shelf, count] of Object.entries(counts)) {
          console.log(`    ${shelf.padEnd(25)} ${count}`);
        }
      } else {
        const defaultShelves = ["read", "currently-reading", "to-read"];
        console.log("\n  Bookshelves");
        console.log("  " + "-".repeat(40));
        for (const s of defaultShelves) {
          const books = await getShelf(s);
          console.log(`    ${s.padEnd(25)} ${books.length}`);
        }
      }
    }
    break;
  }

  case "status": {
    const shelves = ["currently-reading", "read", "to-read"];
    for (const s of shelves) {
      const books = await getShelf(s);
      console.log(`\n  ${s} (${books.length})`);
      console.log("  " + "-".repeat(58));
      const display = s === "read" ? books.slice(0, 10) : books;
      for (const b of display) {
        const stars = b.rating ? " — " + "⭐".repeat(b.rating) : "";
        console.log(`    ${b.title}${stars}  [${b.id}]`);
      }
      if (s === "read" && books.length > 10) {
        console.log(`    ... and ${books.length - 10} more`);
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
    console.log(`Goodreads CLI

Usage:
  bun goodreads.ts search "Book Title"               Search for books
  bun goodreads.ts shelves                            List shelf counts
  bun goodreads.ts shelf read                         List books on a shelf
  bun goodreads.ts shelf currently-reading
  bun goodreads.ts shelf to-read
  bun goodreads.ts shelves add <book_id> <shelf>      Add book to shelf
  bun goodreads.ts shelves move <book_id> <shelf>     Move book to shelf
  bun goodreads.ts shelves remove <book_id>           Remove from all shelves
  bun goodreads.ts status                             Summary of all shelves
  bun goodreads.ts batch "Book 1" "Book 2"            Search multiple books`);
}
