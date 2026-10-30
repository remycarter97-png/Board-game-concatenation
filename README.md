# Our Game Shelf

Live at https://our-game-shelf.vercel.app

Combines the owned BoardGameGeek collections of **Asianofchaos** (Remy) and **celestinpro** (Jonathan) into one list, with an "Owned by" pill showing Remy, Jonathan or Both.

## Features

- **Cute board-game design:** game cards with BGG box art, owner meeples (Remy, Jonathan, Both), BGG rating, best player count, playing time and weight, with light and dark modes.
- **Top of our shelf:** our three games with the best BGG overall rank, plus a sync status showing when the data was last refreshed from BGG.
- **Nested add-ons:** expansions and accessories sit under the base game they belong to, with their own owner shown when it differs.
- **Search and filters:** search by title, mechanic, designer or publisher; filter by BGG's "best with" player count (every count on the shelf, up to 10+) and mechanics (any selected); sort by name, rating, year, player count or complexity. Active filters show as removable chips.
- **Cards or table:** switch between box-art cards and a sortable table (click a column header to sort; expand a game's row to see its add-ons). The choice is remembered on the device.
- **Game details:** cover, rating, description, players, best count, playing time, weight, mechanics, categories, designers, publishers and add-ons, with a link to BGG.
- **Pagination:** 24, 36 or 48 games per page (remembered on the device); filters stay applied while paging. On tablets and phones the filters open in a drawer.

## How it works

- `index.html`: the page.
- `api/collection.js`: a Vercel function that fetches both collections and their game details (images, ratings, overall rank, weight, playing time, mechanics, categories, designers, publishers, descriptions, player counts, BGG's best-player-count summary and links between games) from the BGG XML API2. It uses batches of 20 with a pause between requests. The result is cached at Vercel's edge for a day, so the site makes a small, fixed number of BGG requests each day.

BGG data is shown as BGG provides it.

## Setup

The function needs a BGG application token in the Vercel environment variable `BGG_API_TOKEN` (register at https://boardgamegeek.com/applications). Until it's set, the page shows a "Coming soon" notice.

Pushes to `main` deploy automatically.

Powered by [BoardGameGeek](https://boardgamegeek.com).
