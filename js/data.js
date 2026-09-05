// ---------------------------------------------------------------------------
// Static game data: tile map, items, enemies, dialogue text, NPC/pickup layout
// ---------------------------------------------------------------------------

const TILE_SIZE = 40;
const MAP_COLS = 20;
const MAP_ROWS = 15;

const TILE = {
  GRASS: 0,
  TREE: 1,
  TALLGRASS: 2,
  WATER: 3,
  PATH: 4,
  SHRINE: 5,
  ROCK: 6,
  FLOWER: 7,
};

const SOLID_TILES = new Set([TILE.TREE, TILE.WATER, TILE.ROCK]);
const ENCOUNTER_TILES = new Set([TILE.TALLGRASS]);

function buildMap() {
  const grid = [];
  for (let y = 0; y < MAP_ROWS; y++) {
    const row = [];
    for (let x = 0; x < MAP_COLS; x++) {
      const border = x === 0 || y === 0 || x === MAP_COLS - 1 || y === MAP_ROWS - 1;
      row.push(border ? TILE.TREE : TILE.GRASS);
    }
    grid.push(row);
  }

  const fillRect = (x0, y0, x1, y1, tile) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (grid[y] && grid[y][x] !== undefined) grid[y][x] = tile;
      }
    }
  };

  // Tall grass patches (random encounters live here)
  fillRect(3, 3, 6, 5, TILE.TALLGRASS);
  fillRect(9, 8, 12, 10, TILE.TALLGRASS);
  fillRect(14, 3, 17, 5, TILE.TALLGRASS);
  fillRect(3, 10, 6, 12, TILE.TALLGRASS);

  // Pond
  fillRect(13, 9, 15, 11, TILE.WATER);

  // Rock clusters
  grid[7][7] = TILE.ROCK;
  grid[7][8] = TILE.ROCK;
  grid[6][13] = TILE.ROCK;

  // Scattered trees for texture (kept clear of the main path/shrine/pickups)
  const treeSpots = [
    [8, 3], [8, 4], [11, 3], [11, 12], [5, 7], [16, 8], [17, 9], [4, 8], [16, 12],
  ];
  for (const [x, y] of treeSpots) grid[y][x] = TILE.TREE;

  // Flowers for flavor
  const flowerSpots = [[2, 6], [2, 7], [17, 6], [18, 6], [10, 12], [11, 12]];
  for (const [x, y] of flowerSpots) grid[y][x] = TILE.FLOWER;

  // Path from the player's landing spot to the shrine clearing
  for (let x = 2; x <= 17; x++) grid[13][x] = TILE.PATH;
  for (let y = 2; y <= 13; y++) grid[y][17] = TILE.PATH;

  // Shrine clearing
  fillRect(16, 1, 18, 3, TILE.GRASS);
  grid[2][17] = TILE.SHRINE;

  return grid;
}

const PLAYER_START = { x: 2, y: 12 };

const NPCS = [
  {
    id: "fox_spirit",
    x: 3,
    y: 13,
    color: "#e8823c",
    name: "Kiri",
    dialogue: [
      "A small fox with fur like autumn flame steps out of the underbrush.",
      "\"Oh! A wanderer from the Far Side. You reek of another world.\"",
      "\"This is the Whispering Wood, between all the worlds that were. You were pulled here when the barrier thinned.\"",
      "\"If you want to go home, seek the Ancient Shrine to the north-east. Follow the path.\"",
      "\"The wood isn't safe, though - slimes and wolves lurk in the tall grass. Grow strong before you go.\"",
      "\"Take this - it fell from your pocket when you landed.\" Kiri nudges a small pouch toward you.",
    ],
    onComplete: (state) => {
      if (!state.flags.metFox) {
        state.flags.metFox = true;
        addItem(state, "potion", 2);
        addItem(state, "gold", 0);
        state.player.gold += 10;
      }
    },
  },
];

const ITEM_PICKUPS = [
  { id: "pickup_potion1", x: 5, y: 4, item: "potion", qty: 1, collected: false },
  { id: "pickup_gold1", x: 10, y: 9, item: "gold", qty: 25, collected: false },
  { id: "pickup_sword", x: 15, y: 4, item: "iron_sword", qty: 1, collected: false },
  { id: "pickup_potion2", x: 4, y: 11, item: "hi_potion", qty: 1, collected: false },
];

const ITEMS = {
  potion: { name: "Potion", desc: "Restores 30 HP.", type: "consumable", heal: 30 },
  hi_potion: { name: "Hi-Potion", desc: "Restores 80 HP.", type: "consumable", heal: 80 },
  ether: { name: "Ether", desc: "Restores 20 MP.", type: "consumable", restoreMp: 20 },
  gold: { name: "Gold", desc: "Currency of no world in particular.", type: "currency" },
  iron_sword: {
    name: "Iron Sword",
    desc: "A well-balanced blade. +6 ATK.",
    type: "weapon",
    atkBonus: 6,
  },
};

function addItem(state, itemId, qty) {
  if (itemId === "gold") {
    state.player.gold += qty;
    return;
  }
  const inv = state.player.inventory;
  const existing = inv.find((i) => i.item === itemId);
  if (existing) existing.qty += qty;
  else inv.push({ item: itemId, qty });
}

const ENEMIES = {
  slime: {
    name: "Bog Slime",
    color: "#59c46b",
    hp: 22,
    atk: 6,
    def: 1,
    exp: 8,
    gold: 5,
    skill: null,
  },
  goblin: {
    name: "Thornback Goblin",
    color: "#9c7a4a",
    hp: 32,
    atk: 9,
    def: 3,
    exp: 14,
    gold: 12,
    skill: null,
  },
  wolf: {
    name: "Shade Wolf",
    color: "#5c6773",
    hp: 40,
    atk: 12,
    def: 4,
    exp: 20,
    gold: 18,
    skill: { name: "Howl", chance: 0.3, atkMult: 1.6 },
  },
};

const RANDOM_ENCOUNTER_TABLE = ["slime", "slime", "goblin", "goblin", "wolf"];

const BOSS = {
  name: "Guardian of the Between",
  color: "#8e6fce",
  hp: 120,
  atk: 14,
  def: 6,
  exp: 100,
  gold: 100,
  skill: { name: "Rift Slash", chance: 0.35, atkMult: 1.8 },
  isBoss: true,
};

const INTRO_TEXT = [
  "You remember headlights. A horn. Then nothing but white.",
  "Now there is green instead - a canopy of unfamiliar trees, sunlight breaking through in gold spears.",
  "You are lying in soft moss, and the air smells of rain that hasn't fallen yet.",
  "Somewhere above, wind moves through leaves that do not grow anywhere on Earth.",
  "Wherever this is... it is not home.",
  "You get to your feet. The forest waits.",
];

const SHRINE_INTRO_TEXT = [
  "The path opens into a clearing where a moss-covered stone arch hums faintly.",
  "Kiri's words echo: \"The Shrine remembers every world it has touched. It will test you before it lets you choose your path.\"",
  "The air thickens. Something ancient stirs at the edge of the clearing.",
];

const VICTORY_TEXT = [
  "The Guardian's light scatters like dust caught in a sunbeam.",
  "The arch of the Shrine opens onto a shape you almost recognize - a doorway shaped like a memory.",
  "You could step through, back to the world of headlights and horns...",
  "...but the Whispering Wood, for the first time since you fell into it, feels a little bit like home.",
  "You have proven yourself. Your isekai story is only just beginning.",
  "- THE END (for now) -",
];

const GAMEOVER_TEXT = [
  "Your vision fades to black at the edges.",
  "Somewhere, distantly, you feel moss beneath you again.",
  "The forest is patient. It will let you try again.",
];
