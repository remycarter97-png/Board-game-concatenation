# Our Game Shelf

Live at https://our-game-shelf.vercel.app

Combines the owned BoardGameGeek collections of **Asianofchaos** (Remy) and **celestinpro** (Jonathan) — base games, expansions and accessories — into one list, with an "Owned by" column showing Remy, Jonathan or Both.

## How it works

- `index.html` — the page: search, plus filters for owner and type.
- `api/collection.js` — a Vercel function that pulls both collections from the BGG XML API2 and merges them. Results are cached for a day, so the list refreshes daily.

## Setup

The function needs a BGG application token in the Vercel environment variable `BGG_API_TOKEN` (register at https://boardgamegeek.com/applications). Until it's set, the page shows a "Coming soon" notice.

Pushes to `main` deploy automatically.

Powered by [BoardGameGeek](https://boardgamegeek.com).
