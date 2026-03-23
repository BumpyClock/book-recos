# Clean Up Shared Kindle Reads

Identify and remove books likely read by family members (dad or 8-year-old son) who share the Kindle account, not by me.

## Step 1: Gather recent books from both platforms

Run these in parallel:

```bash
bun goodreads.ts shelf currently-reading
bun goodreads.ts shelf read
bun storygraph.ts shelf currently-reading
bun storygraph.ts shelf read
```

## Step 2: Filter to last 30 days

From the results, keep only books added/read in the last 30 days. If date info isn't available, include all books from the shelf and note the ambiguity.

## Step 3: Cross-reference with reading-profile.md and reading-history.md

Read both files. Books already in `reading-history.md` are confirmed mine — skip them.

## Step 4: Classify each book

For every remaining book, evaluate who likely read it based on these profiles:

| Person | Preferences |
|--------|------------|
| **Me** | Sci-fi, fantasy, literary fiction, mystery, South Asian literature, non-fiction (science/politics/history). See `reading-profile.md` for full details. |
| **Dad** | Travel books, health/wellness books |
| **Son (age 8)** | Children's books, kids' series, middle-grade fiction |

## Step 5: Present findings for approval

Show a table like:

| # | Title | Author | Platform | Likely Reader | Confidence | Reasoning |
|---|-------|--------|----------|--------------|------------|-----------|

Group by likely reader (Dad / Son). Don't list books classified as mine — those stay.

**Ask for explicit approval before removing anything.** The user may override individual classifications.

## Step 6: Remove approved books

After the user confirms which books to remove, remove them from both platforms where present:

```bash
# Goodreads
bun goodreads.ts shelves remove <book_id>

# StoryGraph
bun storygraph.ts shelves remove <book_uuid>
```

Search by title on both platforms if a book was only found on one during Step 1 — it may exist on the other too:

```bash
bun goodreads.ts search "Book Title"
bun storygraph.ts search "Book Title"
```

Remove from both if found.

## Step 7: Confirm completion

List all books that were removed and from which platforms. Flag any removals that failed so the user can handle them manually.
