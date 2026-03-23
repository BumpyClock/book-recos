---
name: book-manager
description: Understand user's reading preferences, search and recommend new books, manage holds, and sync bookshelves across KCLS, Libby, Goodreads, and StoryGraph
triggers:
  - search for books
  - check availability
  - place hold
  - remove hold
  - library status
  - update shelf
  - add to shelf
  - mark as read
  - finished a book
  - I finished
  - I just read
  - done reading
  - what am I reading
  - book holds
  - checked out
  - goodreads
  - storygraph
  - libby
  - kcls
---

# Book Manager Skill

You manage the user's books across configured services. All scripts are in the project root and use `bun`. Auth tokens are in `.env` (auto-loaded). 

## Finished-Book Questionnaire

When the user says they finished / read a book, run this workflow **before** updating shelves.

### Step 1: Quick Rating

Ask: **"How would you rate [Book] out of 5 stars?"**

### Step 2: Core Questionnaire

Use the `vscode_askQuestions` tool to present all questions at once. Keep it conversational — the user can answer in a few words or a paragraph.

Ask these questions (adapt wording naturally):

| # | Question | What it reveals |
|---|----------|-----------------|
| 1 | What did you enjoy most about this book? | Positive taste signals |
| 2 | Anything that didn't work for you or felt weak? | Dealbreaker refinement |
| 3 | How was the pacing — did it hold your attention throughout? | Pacing preferences |
| 4 | Did any characters really stand out (positively or negatively)? | Character voice importance |
| 5 | Would you read more by this author or in this series? Why / why not? | Series/author affinity |
| 6 | What book(s) does this remind you of? Better, worse, or different? | Comp mapping |
| 7 | Any themes or vibes you want more of — or less of — going forward? | Forward-looking preference signal |

**If rating is 1-2 stars**, also ask:
- "Was there a specific moment where the book lost you?"

**If rating is 4-5 stars**, also ask:
- "What made this a standout — what elevated it above average for you?"

### Step 3: Synthesize & Update Profile

After collecting answers:

1. **Identify taste signals** — extract concrete preferences, new dealbreakers, genre/theme affinities, and author notes from the responses.

2. **Read `reading-profile.md`** — compare new signals against existing profile sections.

3. **Update `reading-profile.md`** with any new insights:
   - Add the book to the appropriate 5-star list if rated 5★
   - Add new dealbreakers or refine existing ones
   - Add new genre preferences, theme affinities, or vibe preferences
   - Note new comp books or taste evolution
   - Add author to a "loved authors" or "avoid authors" note if sentiment is strong
   - **Do NOT remove existing preferences** — only add, refine, or annotate

4. **Show the user a brief summary** of what was updated in their profile (e.g., "Added 'unreliable narrators' to your preferred tropes, noted you want more science-mystery crossovers").

### Step 4: Update Shelves & History

After the questionnaire:

1. Move the book to "read" on Goodreads and StoryGraph (search each service for the correct ID, then move in parallel).
2. Add the book to `reading-history.md` with the date, rating (stars), and a one-line note capturing the user's core sentiment.
3. Remove the book from `to-read.md` if it was listed there.

### Abbreviated Mode

If the user clearly doesn't want to do a full questionnaire (e.g., "just mark it read", "no feedback"), skip Steps 1-3 and go straight to Step 4. Respect the user's time.

### Example Interaction

```
User: I finished Record of a Spaceborn Few

Agent: Nice! How would you rate Record of a Spaceborn Few out of 5 stars?

User: 4 stars

Agent: Cool — a few quick questions so I can dial in your profile:
  1. What did you enjoy most?
  2. Anything that didn't work?
  3. How was the pacing?
  4. Any standout characters?
  5. Would you read more Becky Chambers?
  6. What does it remind you of?
  7. Any themes/vibes you want more or less of?
  8. What elevated it above average for you?

User: [answers]

Agent: Got it. Updated your reading profile:
  - Added "found-family in space" to preferred themes
  - Noted preference for quieter, character-study sci-fi alongside action
  Moving to "read" on Goodreads and StoryGraph...
  ✓ Done. Added to reading-history.md with 4★.
```

## Requirements
- if bun is not installed a web search and instruct the user to install bun and then restart this conversation so you can run scripts properly.

## Services & Scripts

| Script | Service | What it covers |
|--------|---------|----------------|
| `kcls.ts` | KCLS Library | Physical books, eBooks, audiobooks at King County Library System |
| `libby.ts` | Libby/OverDrive | Digital eBooks and audiobooks (KCLS + San Diego County) |
| `goodreads.ts` | Goodreads | Bookshelves: read, currently-reading, to-read |
| `storygraph.ts` | StoryGraph | Bookshelves: read, currently-reading, to-read, paused, did-not-finish |

## References

- [CLI Reference](references/cli-reference.md) — full command usage for all scripts
- [Workflows](references/workflows.md) — step-by-step workflows for common tasks

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
