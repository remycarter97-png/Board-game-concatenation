// Campaign templates: the structure of a campaign (what to track), never the game's content.
// Each template says which fields a character has, which campaign tracks and sections exist, which
// achievement lists there are and what kinds of things get unlocked. Scenarios, buildings, achievements
// and unlocks are all entered by the players as they come up in their game.
//
// Character field types:  number (min/max), xp (number with a level hint), checks (a row of boxes),
//                         text, notes (multi-line), resources (a grid of named counts)
// Campaign sections:      tracks (numbers), resources (named counts), calendar (weeks and seasons),
//                         buildings (a list with level and condition)
(function () {
  // XP needed for levels 1–9 in Gloomhaven-family games.
  const GH_XP = [0, 45, 95, 150, 210, 275, 345, 420, 500];
  const FH_RESOURCES = ["Lumber", "Metal", "Hide", "Arrowvine", "Axenut", "Corpsecap", "Flamefruit", "Rockroot", "Snowthistle"];

  const TEMPLATES = {
    frosthaven: {
      id: "frosthaven", name: "Frosthaven", game: "Frosthaven", icon: "❄️",
      blurb: "Characters with perks, masteries and resources; personal quests and retirement; the outpost with morale, defense, soldiers, buildings and supply; the calendar; campaign stickers and party achievements.",
      charFields: [
        { id: "level", label: "Level", type: "number", min: 1, max: 9, def: 1 },
        { id: "xp", label: "XP", type: "xp", thresholds: GH_XP, def: 0 },
        { id: "gold", label: "Gold", type: "number", min: 0, def: 0 },
        { id: "checks", label: "Checkmarks", type: "checks", count: 18, group: 3, hint: "Every 3 checkmarks earn a perk." },
        { id: "perks", label: "Perks taken", type: "number", min: 0, max: 18, def: 0 },
        { id: "masteries", label: "Masteries", type: "checks", count: 2 },
        { id: "res", label: "Resources", type: "resources", names: FH_RESOURCES },
        { id: "items", label: "Items", type: "notes" },
        { id: "notes", label: "Notes", type: "notes" },
      ],
      sections: [
        { id: "outpost", label: "Outpost", type: "tracks", items: [
          { id: "prosperity", label: "Prosperity checkmarks", min: 0, def: 0 },
          { id: "morale", label: "Morale", min: 0, max: 20, def: 0 },
          { id: "defense", label: "Defense", def: 0 },
          { id: "soldiers", label: "Soldiers", min: 0, def: 0 },
          { id: "inspiration", label: "Inspiration", min: 0, def: 0 },
          { id: "guardperks", label: "Town guard perks", min: 0, def: 0 },
        ] },
        { id: "supply", label: "Outpost supply", type: "resources", names: FH_RESOURCES },
        { id: "calendar", label: "Calendar", type: "calendar", weeks: 80, seasonEvery: 10, seasons: ["Summer", "Winter"] },
        { id: "buildings", label: "Buildings", type: "buildings", states: ["Normal", "Damaged", "Wrecked"] },
      ],
      lists: [{ id: "stickers", label: "Campaign stickers", scope: "campaign" }, { id: "party", label: "Party achievements", scope: "party" }],
      unlockKinds: ["Class", "Building", "Item blueprint", "Pet", "Section / envelope", "Event", "Other"],
      retirement: true,
    },
    gloomhaven2: {
      id: "gloomhaven2", name: "Gloomhaven (Second Edition)", game: "Gloomhaven (Second Edition)", icon: "🗡️",
      blurb: "Characters with perks and checkmarks; personal quests and retirement; prosperity, reputation and sanctuary donations; global and party achievements.",
      charFields: [
        { id: "level", label: "Level", type: "number", min: 1, max: 9, def: 1 },
        { id: "xp", label: "XP", type: "xp", thresholds: GH_XP, def: 0 },
        { id: "gold", label: "Gold", type: "number", min: 0, def: 0 },
        { id: "checks", label: "Checkmarks", type: "checks", count: 18, group: 3, hint: "Every 3 checkmarks earn a perk." },
        { id: "perks", label: "Perks taken", type: "number", min: 0, max: 18, def: 0 },
        { id: "items", label: "Items", type: "notes" },
        { id: "notes", label: "Notes", type: "notes" },
      ],
      sections: [
        { id: "city", label: "Gloomhaven", type: "tracks", items: [
          { id: "prosperity", label: "Prosperity checkmarks", min: 0, def: 0 },
          { id: "reputation", label: "Reputation", min: -20, max: 20, def: 0 },
          { id: "donations", label: "Sanctuary donations (gold)", min: 0, step: 10, def: 0 },
        ] },
      ],
      lists: [{ id: "global", label: "Global achievements", scope: "campaign" }, { id: "party", label: "Party achievements", scope: "party" }],
      unlockKinds: ["Class", "Item design", "City event", "Road event", "Envelope", "Other"],
      retirement: true,
    },
    jotl: {
      id: "jotl", name: "Gloomhaven: Jaws of the Lion", game: "Gloomhaven: Jaws of the Lion", icon: "🦁",
      blurb: "Characters with perks and checkmarks, party achievements and unlocks.",
      charFields: [
        { id: "level", label: "Level", type: "number", min: 1, max: 9, def: 1 },
        { id: "xp", label: "XP", type: "xp", thresholds: GH_XP, def: 0 },
        { id: "gold", label: "Gold", type: "number", min: 0, def: 0 },
        { id: "checks", label: "Checkmarks", type: "checks", count: 18, group: 3, hint: "Every 3 checkmarks earn a perk." },
        { id: "perks", label: "Perks taken", type: "number", min: 0, max: 18, def: 0 },
        { id: "items", label: "Items", type: "notes" },
        { id: "notes", label: "Notes", type: "notes" },
      ],
      sections: [],
      lists: [{ id: "party", label: "Party achievements", scope: "party" }],
      unlockKinds: ["Class", "Item", "Other"],
      retirement: false,
    },
    blank: {
      id: "blank", name: "Any campaign game", game: "", icon: "📜",
      blurb: "A blank campaign: characters with a level and notes, one achievements list and an unlock log. Add the fields and tracks your game needs in Setup.",
      charFields: [{ id: "level", label: "Level", type: "number", min: 0, def: 1 }, { id: "notes", label: "Notes", type: "notes" }],
      sections: [{ id: "tracks", label: "Campaign tracks", type: "tracks", items: [] }],
      lists: [{ id: "ach", label: "Achievements", scope: "campaign" }],
      unlockKinds: ["Character", "Item", "Location", "Story", "Other"],
      retirement: true,
    },
  };
  window.CAMPAIGN_TEMPLATES = TEMPLATES;
  window.CAMPAIGN_ORDER = ["frosthaven", "gloomhaven2", "jotl", "blank"];
})();
