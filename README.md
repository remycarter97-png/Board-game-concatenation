# Our Game Shelf

Live at https://our-game-shelf.vercel.app

Combines the owned BoardGameGeek collections of **Asianofchaos** (Remy) and **celestinpro** (Jonathan) into one list, with an "Owned by" pill showing Remy, Jonathan or Both.

## Features

- **Nested list:** base games at the top level, with each one's expansions and accessories underneath. Expansions and accessories whose base game neither of us owns appear on their own.
- **Filters:** search (also matches expansions and accessories), owner, BGG's "Best with N players" summary, and mechanics (multi-select; a game shows if it has any selected mechanic). Filters check the base game, and its expansions and accessories follow it.
- **Pagination:** works like Shelf to Stacks. It shows 10–300 games per page, remembers the page size on the device, and keeps the current page for the visit.

## How it works

- `index.html`: the page.
- `api/collection.js`: a Vercel function that fetches both collections and their game details (mechanics, player counts, BGG's best-player-count summary, and links between games) from the BGG XML API2. It uses batches of 20 with a pause between requests. The result is cached at Vercel's edge for a day, so the site makes a small, fixed number of BGG requests each day.

BGG data is shown as BGG provides it.

## Setup

The function needs a BGG application token in the Vercel environment variable `BGG_API_TOKEN` (register at https://boardgamegeek.com/applications). Until it's set, the page shows a "Coming soon" notice.

Pushes to `main` deploy automatically.

Powered by [BoardGameGeek](https://boardgamegeek.com).
