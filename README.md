# Book Recommendation System

An AI-powered book recommendation toolkit with CLI scripts to search library catalogs, manage holds, and sync bookshelves across multiple services.

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Auth tokens for each service stored in a `.env` file (see [Authentication](#authentication))
- [Playwriter Chrome extension](https://chromewebstore.google.com/detail/playwriter/jfeammnjpkecdekppnclgkkffahnhfhe) — required for automated token refresh scripts to extract auth tokens from your browser
- [Playwriter MCP](SETUP_PLAYWRITER_MCP.md) (optional — for agent-driven token refresh workflows)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/BumpyClock/book-recos.git
cd book-recos

# Create a .env file with your auth tokens (see Authentication section)
touch .env

# Search for a book across services
bun kcls.ts search "Project Hail Mary"
bun libby.ts search "Project Hail Mary"
```

## CLI Scripts

### `kcls.ts` — KCLS Physical Library (BiblioCommons)

Search the King County Library System catalog for physical books, eBooks, and audiobooks. Place and manage holds.

| Command | Description |
|---|---|
| `bun kcls.ts search "Title"` | Search the catalog |
| `bun kcls.ts search "Title" --format BK` | Filter by format (`BK`, `EBOOK`, `AB`) |
| `bun kcls.ts holds` | List current holds |
| `bun kcls.ts holds add <metadata_id>` | Place a hold |
| `bun kcls.ts holds add <id> --format DIGITAL` | Place a hold on a digital format |
| `bun kcls.ts holds remove <hold_id>` | Remove a hold |
| `bun kcls.ts checkouts` | List checked-out books |
| `bun kcls.ts status` | Show both checkouts and holds |
| `bun kcls.ts batch "Book 1" "Book 2"` | Search multiple books at once |

### `libby.ts` — Libby / OverDrive (Digital)

Search for eBooks and audiobooks across Libby-connected libraries. Manage loans and holds.

| Command | Description |
|---|---|
| `bun libby.ts search "Title"` | Search all libraries |
| `bun libby.ts search "Title" --library sdcl` | Search a specific library only |
| `bun libby.ts holds` | List current holds |
| `bun libby.ts holds add <media_id>` | Place a hold (default card) |
| `bun libby.ts holds add <media_id> --card 94349882` | Place a hold on a specific card |
| `bun libby.ts holds remove <media_id>` | Remove a hold |
| `bun libby.ts loans` | Show current loans |
| `bun libby.ts status` | Show both loans and holds |
| `bun libby.ts batch "Book 1" "Book 2"` | Search multiple books at once |

### `goodreads.ts` — Goodreads Shelf Management

Search Goodreads and manage bookshelves (add, move, remove books).

| Command | Description |
|---|---|
| `bun goodreads.ts search "Title"` | Search for books |
| `bun goodreads.ts shelves` | List shelf counts |
| `bun goodreads.ts shelf read` | List books on a shelf |
| `bun goodreads.ts shelf currently-reading` | List currently-reading books |
| `bun goodreads.ts shelf to-read` | List to-read books |
| `bun goodreads.ts shelves add <book_id> <shelf>` | Add a book to a shelf |
| `bun goodreads.ts shelves move <book_id> <shelf>` | Move a book to a different shelf |
| `bun goodreads.ts shelves remove <book_id>` | Remove a book from all shelves |
| `bun goodreads.ts status` | Summary of all shelves |
| `bun goodreads.ts batch "Book 1" "Book 2"` | Search multiple books at once |

### `storygraph.ts` — StoryGraph Shelf Management

Search StoryGraph and manage reading status.

| Command | Description |
|---|---|
| `bun storygraph.ts search "Title"` | Search for books |
| `bun storygraph.ts shelves` | List all shelves |
| `bun storygraph.ts shelf read` | List books on a shelf |
| `bun storygraph.ts shelf currently-reading` | List currently-reading books |
| `bun storygraph.ts shelf to-read` | List to-read books |
| `bun storygraph.ts shelves add <book_uuid> <status>` | Set a book's status |
| `bun storygraph.ts shelves move <book_uuid> <status>` | Move a book to a new status |
| `bun storygraph.ts shelves remove <book_uuid>` | Remove a book from library |
| `bun storygraph.ts status` | Summary of all shelves |
| `bun storygraph.ts batch "Book 1" "Book 2"` | Search multiple books at once |

**Valid statuses:** `to-read`, `currently-reading`, `read`, `paused`, `did-not-finish`

### `refresh-kcls-tokens.ts` — Token Refresh

Refreshes KCLS auth tokens from Chrome cookies via Playwriter. Requires Chrome to be open and logged in to KCLS.

```bash
bun refresh-kcls-tokens.ts
```

## Authentication

Create a `.env` file in the project root with tokens for each service you want to use:

```env
# KCLS (BiblioCommons)
# Get from Chrome DevTools > Application > Cookies > bibliocommons.com
KCLS_ACCESS_TOKEN=...    # bc_access_token cookie
KCLS_SESSION_ID=...      # session_id cookie

# Libby (OverDrive)
# Get from Chrome DevTools on libbyapp.com > Network > filter "sentry" > Authorization header
LIBBY_BEARER_TOKEN=...

# Goodreads
# Get from Chrome DevTools on any goodreads.com request
GOODREADS_COOKIE=...     # Full cookie string
GOODREADS_CSRF=...       # meta[name="csrf-token"] content

# StoryGraph
# Get from Chrome DevTools on any thestorygraph.com request
STORYGRAPH_COOKIE=...
STORYGRAPH_CSRF=...
```

To automate token refresh, see [SETUP_PLAYWRITER_MCP.md](SETUP_PLAYWRITER_MCP.md).

## Data Files

| File | Purpose |
|---|---|
| `reading-profile.md` | Reading preferences, favorite genres, and dealbreakers |
| `reading-history.md` | Books already read (with ratings) |
| `to-read.md` | Books queued to read next |

## AI Agent Usage

This repo is designed to work with an AI coding agent (see `AGENTS.md`). The agent can:

1. Analyze your reading profile and recommend books tailored to your taste
2. Search award lists and the web for candidates
3. Check availability across KCLS and Libby before recommending
4. Place holds and manage shelves on your behalf

To get started, populate `reading-profile.md` with your preferences, then ask the agent for recommendations.
