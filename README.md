# Our Game Shelf

Live at https://ourgameshelf.com

Combines the owned BoardGameGeek collections of **Asianofchaos** (Remy) and **celestinpro** (Jonathan) into one list, with an "Owned by" pill showing Remy, Jonathan or Both.

## Features

- **Cute board-game design:** game cards with BGG box art, owner meeples (Remy, Jonathan, Both), BGG rating, best player count, playing time and weight, with light and dark modes.
- **Welcome card:** a short "something for everyone" intro to the collection, plus a sync status showing when the data was last refreshed from BGG.
- **Nested add-ons:** expansions and accessories sit under the base game they belong to, with their own owner shown when it differs. In the tile view, add-ons BGG links to an edition we don't own are tucked under the edition we do own with the same name; ones with no match get no tile but still show up in search, the table and exports.
- **Search and filters:** search by title, mechanic, category, designer or publisher; filter by BGG's "best with" player count (numbered buttons for every count on the shelf, up to 10+) and mechanics or categories (one combined list, any selected); in the table, those two live in the Best with and Mechanics column filters instead and mechanics (any selected); sort by any column (name, rating, BGG rank, players, best with, time, complexity, year, mechanics, categories or owner). Active filters show as removable chips.
- **Rows view (the default):** a featured banner, then rows of games to scroll sideways, like a streaming app. The banner rotates through our games that are on BGG's hotness list right now, hottest first (topped up with our best-ranked games if few of ours are hot), with a "Surprise me" button. Rows: the Top 10 by BGG rank, then themed rows (perfect for two, co-ops, quick games, party picks, campaigns, solo, brain burners, long games, fantasy, space, animals, card games, dice, deduction, big groups, newest, oldest). "Deal new rows" swaps in a random set built from the collection: categories, mechanics, designers, publishers, player counts, decades, lengths, weights and mixes of them, different every time. "See all" opens a row as a grid. Filters narrow every row; searching shows a results grid. Opening a game from a row lets you arrow or swipe along that row.
- **Cards or table:** switch between box-art cards and a sortable table (click a column header to sort, Shift-click or use the "Sorted by" bar to add more sort levels, up to four; expand a game's row to see its add-ons). The choice is remembered on the device.
- **Columns:** in the table, show or hide columns and change their order (drag them or use the arrows in the Columns menu; Name always shows). The layout is remembered on the device.
- **Saved views:** in the table, save the current sort order, columns and filters under a name (up to 10), then reapply, rename or delete them from the Saved views menu. They're kept in each visitor's own browser.
- **Column filters:** the table has a filter under every column (Mechanics and Categories open a list of every one on the shelf, with counts: type to find one, and pick several to show games with any of them) (name, rating, BGG rank, players, best with, time, complexity, year, mechanics, categories, owner). They combine with each other and with search, show as chips, and stay applied in card view.
- **Export to Excel:** download the games currently showing (with search, filters and sort applied, across all pages) or the whole collection as an .xlsx file. Add-ons get their own rows, with the game they belong to; the file has a frozen header, filters, BGG links and an About sheet.
- **Installable app (PWA):** the site can be installed to a phone's home screen or as a desktop app (an "Install app" button appears where the browser supports it; on iPhone, use Share → Add to Home Screen). A service worker keeps the pages and the last collection, so the site opens offline and shows a note while offline. Box art isn't stored offline; games show their drawing instead.
- **Game night planner (`/tools/game-night`):** pick who's playing (saved profiles, plus guests without one) and how long you have. Each person can set the weights they enjoy, mechanics or categories they love (those games rank higher) or won't play (left out), and their own time limit (the shortest limit wins). It suggests three games that suit everyone, leaning toward BGG's best-at-count and higher-rated games and explaining why; Reroll deals three more without repeats; "See all" lists every match, with close matches when nothing suits everyone's weights. It can skip games played in the last 2 weeks, month or 3 months (from Remy's logged plays).
- **Our notes:** the comment each of us left on a game in our BGG collection shows in that game's details (including notes on its add-ons). Only public notes; BGG's private comments aren't available to the site.
- **Game details:** cover, rating, description, players, best count, playing time, weight, mechanics, categories, designers, publishers and add-ons, with a link to BGG. In card view, use the left and right arrow keys, the arrow buttons beside the details, or swipe to move to the previous or next game (following the current sort and filters, across pages).
- **Charts page (`/stats`):** a dashboard of charts that updates with each sync: games by year, complexity, play time, complexity vs. play time, best player counts, and the top mechanics, categories, designers and publishers. Filters at the top (base games / with expansions / everything, best with, complexity, play time, decade) change every chart. Click any bar, point or dot (or a number in the "Show the numbers" table) to see the games that make it up, with links to BGG. "Our 2026" (for any year, or a quarter of it) recaps our logged plays, from Remy's BGG account: plays, different games, games new to us, the favorite and the next four, plays by month or week, and fun facts compared with the period before. A "Games we've played" section shows Remy's logged plays on BGG by the numbers (plays logged, games played, most played, games on the shelf not played yet) and a times-played chart, top 20 or all; it shows games on our shelf by default and can include games she's played that we don't own. Below that, a chart builder: pick bars, sideways bars, a line or dots, what to group by, what to show (count or average rating, complexity or play time) and what to split or color by, then save charts by name (up to 12, kept in the browser).
- **Pagination:** up to 10 page numbers at a time around the current page; 10, 25, 50, 100, 200 or 300 games per page (remembered on the device); filters stay applied while paging. On tablets and phones the filters open in a drawer.

- **Tools (`/tools`):** a page of game night helpers, one card per tool (add new ones to the `TOOLS` list in `tools/index.html`).
- **Initiative tracker (`/tools/initiative`):** add combatants, then roll a random turn order or type in initiative numbers (highest or lowest first, with arrows to settle ties), and step through turns in a full list or one at a time, round after round. Keep several parties and switch between them. "Share" gives a party a 6-character code and a link; anyone who opens it gets the party on their device, and adding or removing names syncs between everyone using that code. Initiative numbers and turns stay on each device.

## How it works

- `index.html`: the games page.
- `tools/index.html`: the Tools page.
- `tools/game-night.html`: the game night planner.
- `tools/initiative.html`: the initiative tracker (served at `/tools/initiative`; the old `/initiative` address redirects there, query string included).
- `api/plays.js`: serves Remy's individual logged plays (saved by the daily sync to `shelf/plays.json`) for the "Our year" recaps.
- `api/party.js`: saves and loads shared initiative parties in Vercel Blob (`parties/<CODE>.json`).
- `stats.html`: the charts page (served at `/stats`; uses Chart.js 4.4.1 from cdnjs).
- `api/sync.js`: the daily sync. Vercel Cron runs it at 10:00 UTC (see `vercel.json`). It fetches both owned collections from the BGG XML API2, fetches Remy's logged plays (every play, page by page), BGG's hotness list, our collection notes and Remy's play counts (including games she's played but we don't own), refreshes game details (images, ratings, overall rank, weight, playing time, mechanics, categories, designers, publishers, descriptions, player counts, BGG's best-player-count summary and links between games) that are missing or more than six days old, in batches of 20 with a pause between requests, and saves a snapshot to Vercel Blob. If BGG is unavailable, the previous snapshot stays up and the page notes that the day's refresh failed.
- `api/collection.js`: serves the saved snapshot to the page. It never calls BGG, so it's fast no matter how many people visit.
- `manifest.webmanifest`, `sw.js`, `pwa.js`, `icons/`: the installable app: manifest, offline service worker (bump `VERSION` in `sw.js` to clear old caches), install button and offline note, and the app icons.
- `lib/bgg.js`: BGG fetching and parsing.

BGG data is shown as BGG provides it.

## Setup

Environment variables in Vercel:

- `BGG_API_TOKEN`: a BGG application token (register at https://boardgamegeek.com/applications).
- `CRON_SECRET`: authorizes the sync; Vercel Cron sends it automatically. To run a sync by hand, open `/api/sync?secret=<CRON_SECRET>`.
- `BLOB_READ_WRITE_TOKEN`: added by connecting the project's Blob store.

Pushes to `main` deploy automatically.

Powered by [BoardGameGeek](https://boardgamegeek.com).
