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

- `index.html` is the page. It has the group editor, search, and filters for owner ("Owned by all" or one person's games), type, player count ("Plays N" or the community's "Best at N") and mechanic. You can sort by name, best player count, length or complexity, in either direction. It fetches each member's collection and merges them in the browser, then loads game details in batches.
- `api/collection.js` is a Vercel function: `GET /api/collection?username=<bgg user>` returns that user's owned items from the BGG XML API2. Each user is cached at Vercel's edge for a day, so lists refresh daily, and a collection is fetched once no matter how many groups include that user.
- `api/things.js` is a Vercel function: `GET /api/things?ids=13,822,…` (up to 20 ids, BGG's limit) returns player counts, the community's best player counts, playing time, complexity (BGG weight, 1–5) and mechanics. Each batch is cached for a week. "Best" player counts are the counts where BGG's poll has at least as many "Best" votes as "Recommended" and "Not Recommended" votes.

## Setup

The functions need a BGG application token in the Vercel environment variable `BGG_API_TOKEN` (register at https://boardgamegeek.com/applications). Until it's set, the page shows a "Coming soon" notice.

Pushes to `main` deploy automatically.

Powered by [BoardGameGeek](https://boardgamegeek.com).
