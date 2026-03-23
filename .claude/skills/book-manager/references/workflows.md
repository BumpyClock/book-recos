# Workflows

## Search for a book and check availability
1. `bun kcls.ts search "Title"` — physical library availability
2. `bun libby.ts search "Title"` — digital availability across all libraries
3. Report which formats are available and wait times

## I finished a book

**Full workflow (default):** Run the Finished-Book Questionnaire from SKILL.md.

1. Ask for star rating
2. Run the core questionnaire (7-9 questions depending on rating)
3. Synthesize answers → update `reading-profile.md` with new taste signals
4. Move to "read" on Goodreads + StoryGraph (search each for correct ID, move in parallel)
5. Add to `reading-history.md` with date, rating, and one-line sentiment note
6. Remove from `to-read.md` if listed

**Abbreviated (user opts out of questionnaire):** Skip to step 4.

## Add a book to my to-read list
1. Search on both: `bun goodreads.ts search "Title"` + `bun storygraph.ts search "Title"`
2. Add to both: `bun goodreads.ts shelves add <id> to-read` + `bun storygraph.ts shelves add <uuid> to-read`

## What do I have checked out / on hold?
Run in parallel:
```bash
bun kcls.ts status
bun libby.ts status
```