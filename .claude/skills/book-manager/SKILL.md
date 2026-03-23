---
name: book-manager
description: Search libraries, manage holds, and sync bookshelves across KCLS, Libby, Goodreads, and StoryGraph
triggers:
  - search for books
  - check availability
  - place hold
  - remove hold
  - library status
  - update shelf
  - add to shelf
  - mark as read
  - what am I reading
  - book holds
  - checked out
  - goodreads
  - storygraph
  - libby
  - kcls
---

# Book Manager Skill

You manage the user's books across four services. All scripts are in the project root and use `bun`. Auth tokens are in `.env` (auto-loaded).

## Services & Scripts

| Script | Service | What it covers |
|--------|---------|----------------|
| `kcls.ts` | KCLS Library | Physical books, eBooks, audiobooks at King County Library System |
| `libby.ts` | Libby/OverDrive | Digital eBooks and audiobooks (KCLS + San Diego County) |
| `goodreads.ts` | Goodreads | Bookshelves: read, currently-reading, to-read |
| `storygraph.ts` | StoryGraph | Bookshelves: read, currently-reading, to-read, paused, did-not-finish |

## Common Commands

### Search across services
```bash
# Search for a book everywhere
bun kcls.ts search "Book Title"
bun libby.ts search "Book Title"
bun goodreads.ts search "Book Title"
bun storygraph.ts search "Book Title"

# Batch search
bun kcls.ts batch "Book 1" "Book 2"
bun libby.ts batch "Book 1" "Book 2"
```

### Check what's happening
```bash
bun kcls.ts status        # checkouts + holds at KCLS
bun libby.ts status       # loans + holds on Libby
bun goodreads.ts status   # shelf summaries
bun storygraph.ts status  # shelf summaries
```

### Place / remove holds
```bash
# KCLS (physical)
bun kcls.ts holds add <metadata_id>
bun kcls.ts holds remove <hold_id>

# Libby (digital)
bun libby.ts holds add <media_id>
bun libby.ts holds remove <media_id>
```

### Manage shelves
```bash
# Goodreads
bun goodreads.ts shelves add <book_id> read
bun goodreads.ts shelves move <book_id> currently-reading
bun goodreads.ts shelves remove <book_id>

# StoryGraph
bun storygraph.ts shelves add <book_uuid> read
bun storygraph.ts shelves move <book_uuid> currently-reading
bun storygraph.ts shelves remove <book_uuid>
```

## Workflows

### "Search for a book and check availability"
1. `bun kcls.ts search "Title"` — physical library availability
2. `bun libby.ts search "Title"` — digital availability across all libraries
3. Report which formats are available and wait times

### "I finished a book"
1. `bun goodreads.ts shelves move <book_id> read` — update Goodreads
2. `bun storygraph.ts shelves move <book_uuid> read` — update StoryGraph
3. Note: book IDs differ between services. Search each to find the right ID.

### "Add a book to my to-read list"
1. Search on both: `bun goodreads.ts search "Title"` + `bun storygraph.ts search "Title"`
2. Add to both: `bun goodreads.ts shelves add <id> to-read` + `bun storygraph.ts shelves add <uuid> to-read`

### "What do I have checked out / on hold?"
Run in parallel:
```bash
bun kcls.ts status
bun libby.ts status
```

## Token Refresh
If any script fails with auth errors, use the corresponding refresh prompt:
- `/refresh-kcls` — KCLS tokens
- `/refresh-libby` — Libby bearer token
- `/refresh-goodreads` — Goodreads cookie + CSRF
- `/refresh-storygraph` — StoryGraph cookie + CSRF

These require Playwriter MCP and the user to be logged in on the relevant site in Chrome.

## Important Notes
- Book IDs are different across services (Goodreads uses numeric IDs, StoryGraph uses UUIDs, KCLS uses S82C* prefixed IDs, Libby uses numeric media IDs)
- Always search on each service separately to find the correct ID
- Libby searches ALL libraries by default (KCLS + SDCL)
- KCLS holds show both metadata IDs (for placing) and hold IDs (for removing)
- Run commands in parallel when they're independent (e.g., searching multiple services)
