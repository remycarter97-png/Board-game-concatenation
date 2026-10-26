# Our Game Shelf

Live at https://our-game-shelf.vercel.app

Combines the owned BoardGameGeek collections of everyone in a group (base games, expansions and accessories) into one searchable list, with pills showing who owns each item.

## Groups

Enter up to 12 BGG usernames, each with an optional nickname, and press **Show shelf**. The group is saved in the page link, so **Copy group link** gives you a URL to share with the group:

```
https://our-game-shelf.vercel.app/?u=Asianofchaos:Remy&u=celestinpro:Jonathan
```

Each `u` is `username` or `username:Nickname`. Opening the page with no `u` shows the default group: Asianofchaos (Remy) and celestinpro (Jonathan).

## How it works

- `index.html` is the page. It has the group editor, search, and filters for owner ("Owned by all" or one person's games) and type. It fetches each member's collection and merges them in the browser.
- `api/collection.js` is a Vercel function: `GET /api/collection?username=<bgg user>` returns that user's owned items from the BGG XML API2. Each user is cached at Vercel's edge for a day, so lists refresh daily, and a collection is fetched once no matter how many groups include that user.

## Setup

The function needs a BGG application token in the Vercel environment variable `BGG_API_TOKEN` (register at https://boardgamegeek.com/applications). Until it's set, the page shows a "Coming soon" notice.

Pushes to `main` deploy automatically.

Powered by [BoardGameGeek](https://boardgamegeek.com).
