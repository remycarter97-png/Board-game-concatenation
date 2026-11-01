# Our Game Shelf

Live at https://ourgameshelf.com

Combines the owned BoardGameGeek collections of **Asianofchaos** (Remy) and **celestinpro** (Jonathan) into one list, with an "Owned by" pill showing Remy, Jonathan or Both.

## Features

- **Cute board-game design:** game cards with BGG box art, owner meeples (Remy, Jonathan, Both), BGG rating, best player count, playing time and weight, with light and dark modes.
- **Welcome card:** a short "something for everyone" intro to the collection, plus a sync status showing when the data was last refreshed from BGG.
- **Nested add-ons:** expansions and accessories sit under the base game they belong to, with their own owner shown when it differs. In the tile view, add-ons BGG links to an edition we don't own are tucked under the edition we do own with the same name; ones with no match get no tile but still show up in search, the table and exports.
- **Search and filters:** search by title, mechanic, designer or publisher; filter by BGG's "best with" player count (numbered buttons for every count on the shelf, up to 10+) and mechanics; in the table, those two live in the Best with and Mechanics column filters instead and mechanics (any selected); sort by any column (name, rating, BGG rank, players, best with, time, complexity, year, mechanics or owner). Active filters show as removable chips.
- **Cards or table:** switch between box-art cards and a sortable table (click a column header to sort, Shift-click or use the "Sorted by" bar to add more sort levels, up to four; expand a game's row to see its add-ons). The choice is remembered on the device.
- **Columns:** in the table, show or hide columns and change their order (drag them or use the arrows in the Columns menu; Name always shows). The layout is remembered on the device.
- **Saved views:** in the table, save the current sort order, columns and filters under a name (up to 10), then reapply, rename or delete them from the Saved views menu. They're kept in each visitor's own browser.
- **Column filters:** the table has a filter under every column (name, rating, BGG rank, players, best with, time, complexity, year, mechanics, owner). They combine with each other and with search, show as chips, and stay applied in card view.
- **Export to Excel:** download the games currently showing (with search, filters and sort applied, across all pages) or the whole collection as an .xlsx file. Add-ons get their own rows, with the game they belong to; the file has a frozen header, filters, BGG links and an About sheet.
- **Game details:** cover, rating, description, players, best count, playing time, weight, mechanics, categories, designers, publishers and add-ons, with a link to BGG. In card view, use the left and right arrow keys, the arrow buttons beside the details, or swipe to move to the previous or next game (following the current sort and filters, across pages).
- **Charts page (`/stats`):** a dashboard of charts that updates with each sync: games by year, complexity, play time, complexity vs. play time, best player counts, and the top mechanics, categories, designers and publishers. Filters at the top (base games / with expansions / everything, best with, complexity, play time, decade) change every chart. Each chart has a "Show the numbers" table. Below it, a chart builder: pick bars, sideways bars, a line or dots, what to group by, what to show (count or average rating, complexity or play time) and what to split or color by, then save charts by name (up to 12, kept in the browser).
- **Pagination:** up to 10 page numbers at a time around the current page; 24, 36 or 48 games per page (remembered on the device); filters stay applied while paging. On tablets and phones the filters open in a drawer.

## How it works

- `index.html`: the games page.
- `stats.html`: the charts page (served at `/stats`; uses Chart.js 4.4.1 from cdnjs).
- `api/sync.js`: the daily sync. Vercel Cron runs it at 10:00 UTC (see `vercel.json`). It fetches both owned collections from the BGG XML API2, refreshes game details (images, ratings, overall rank, weight, playing time, mechanics, categories, designers, publishers, descriptions, player counts, BGG's best-player-count summary and links between games) that are missing or more than six days old, in batches of 20 with a pause between requests, and saves a snapshot to Vercel Blob. If BGG is unavailable, the previous snapshot stays up and the page notes that the day's refresh failed.
- `api/collection.js`: serves the saved snapshot to the page. It never calls BGG, so it's fast no matter how many people visit.
- `lib/bgg.js`: BGG fetching and parsing.

BGG data is shown as BGG provides it.

## Setup

Environment variables in Vercel:

- `BGG_API_TOKEN`: a BGG application token (register at https://boardgamegeek.com/applications).
- `CRON_SECRET`: authorizes the sync; Vercel Cron sends it automatically. To run a sync by hand, open `/api/sync?secret=<CRON_SECRET>`.
- `BLOB_READ_WRITE_TOKEN`: added by connecting the project's Blob store.

Pushes to `main` deploy automatically.

Powered by [BoardGameGeek](https://boardgamegeek.com).
