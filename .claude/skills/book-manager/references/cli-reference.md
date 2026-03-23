# CLI Reference

All scripts are in the project root and use `bun`. Auth tokens are in `.env` (auto-loaded by Bun).
If tokens expire, use the `/refresh-*` prompts to update them via Playwriter.

## `kcls.ts` — KCLS Physical Library (BiblioCommons)

Covers physical books, eBooks, and audiobooks at King County Library System.

```bash
bun kcls.ts search "Book Title"                   # Search catalog
bun kcls.ts search "Title" --format BK             # Filter: BK, EBOOK, AB
bun kcls.ts holds                                  # List current holds
bun kcls.ts holds add <metadata_id>                # Place a hold
bun kcls.ts holds add <id> --format DIGITAL        # Hold digital format
bun kcls.ts holds remove <hold_id>                 # Remove a hold
bun kcls.ts checkouts                              # List checked out books
bun kcls.ts status                                 # Both checkouts + holds
bun kcls.ts batch "Book 1" "Book 2"                # Search multiple books
```

Env vars: `KCLS_ACCESS_TOKEN`, `KCLS_SESSION_ID`

## `libby.ts` — Libby / OverDrive (Digital)

Covers eBooks and audiobooks across the user's Libby libraries (KCLS + San Diego County).

```bash
bun libby.ts search "Book Title"                   # Search ALL libraries (KCLS + SDCL)
bun libby.ts search "Title" --library sdcl          # Search specific library only
bun libby.ts holds                                  # List current holds
bun libby.ts holds add <media_id>                   # Place hold (KCLS default)
bun libby.ts holds add <media_id> --card 94349882   # Place hold on SDCL card
bun libby.ts holds remove <media_id>                # Remove a hold
bun libby.ts loans                                  # Show current loans
bun libby.ts status                                 # Both loans + holds
bun libby.ts batch "Book 1" "Book 2"                # Search multiple books
```

Env var: `LIBBY_BEARER_TOKEN`

Library cards:
- KCLS: card ID `21252505`, library key `kcls`
- San Diego County: card ID `94349882`, library key `sdcl`

## `goodreads.ts` — Goodreads Shelf Management

Manage shelves on Goodreads (search, add/move/remove books).

```bash
bun goodreads.ts search "Book Title"                    # Search for books
bun goodreads.ts shelves                                 # List shelf counts
bun goodreads.ts shelf read                              # List books on a shelf
bun goodreads.ts shelf currently-reading
bun goodreads.ts shelf to-read
bun goodreads.ts shelves add <book_id> <shelf>           # Add book to shelf
bun goodreads.ts shelves move <book_id> <shelf>          # Move book to shelf
bun goodreads.ts shelves remove <book_id>                # Remove from all shelves
bun goodreads.ts status                                  # Summary of all shelves
bun goodreads.ts batch "Book 1" "Book 2"                 # Search multiple books
```

Env vars: `GOODREADS_COOKIE`, `GOODREADS_CSRF`

## `storygraph.ts` — StoryGraph Shelf Management

Manage reading status on StoryGraph (search, add/move/remove books).

```bash
bun storygraph.ts search "Book Title"                    # Search for books
bun storygraph.ts shelves                                 # List shelf counts
bun storygraph.ts shelf read                              # List books on a shelf
bun storygraph.ts shelf currently-reading
bun storygraph.ts shelf to-read
bun storygraph.ts shelves add <book_uuid> <status>        # Set book status
bun storygraph.ts shelves move <book_uuid> <status>       # Move book to status
bun storygraph.ts shelves remove <book_uuid>              # Remove from library
bun storygraph.ts status                                  # Summary of all shelves
bun storygraph.ts batch "Book 1" "Book 2"                 # Search multiple books
```

Env vars: `STORYGRAPH_COOKIE`, `STORYGRAPH_CSRF`
Statuses: `to-read`, `currently-reading`, `read`, `paused`, `did-not-finish`

## Workflow: Check Availability Before Recommending

After generating recommendations, check availability:

```bash
# Check physical + digital availability in one go
bun kcls.ts batch "Nettle & Bone" "Babel R.F. Kuang" "Saint of Bright Doors"
bun libby.ts batch "Nettle & Bone" "Babel" "Saint of Bright Doors"
```

Then include availability info in recommendations:
- "Available now at KCLS (physical)"
- "eBook: 3 holds on 24 copies (~1 week wait)"
- "Not in Libby catalog — physical only"
