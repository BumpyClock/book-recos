# CLI Reference

All scripts are in the project root and use `bun`. Auth tokens are in `.env` (auto-loaded).

## Search across services
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

## Check what's happening
```bash
bun kcls.ts status        # checkouts + holds at KCLS
bun libby.ts status       # loans + holds on Libby
bun goodreads.ts status   # shelf summaries
bun storygraph.ts status  # shelf summaries
```

## Place / remove holds
```bash
# KCLS (physical)
bun kcls.ts holds add <metadata_id>
bun kcls.ts holds remove <hold_id>

# Libby (digital)
bun libby.ts holds add <media_id>
bun libby.ts holds remove <media_id>
```

## Manage shelves
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
