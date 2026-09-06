// ---------------------------------------------------------------------------
// Static game data: tile map, items, enemies, dialogue text, NPC/pickup layout
// ---------------------------------------------------------------------------

const TILE_SIZE = 40;
const MAP_COLS = 32;
const MAP_ROWS = 24;
const VIEWPORT_COLS = 20;
const VIEWPORT_ROWS = 15;

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

  // Tall grass patches (bushes) - where monsters spawn
  fillRect(3, 3, 6, 5, TILE.TALLGRASS);
  fillRect(9, 7, 12, 9, TILE.TALLGRASS);
  fillRect(15, 3, 18, 5, TILE.TALLGRASS);
  fillRect(3, 10, 6, 12, TILE.TALLGRASS);
  fillRect(21, 13, 24, 15, TILE.TALLGRASS);
  fillRect(25, 4, 28, 6, TILE.TALLGRASS);
  fillRect(7, 16, 10, 18, TILE.TALLGRASS);
  fillRect(17, 17, 20, 19, TILE.TALLGRASS);

  // Ponds
  fillRect(13, 8, 15, 10, TILE.WATER);
  fillRect(22, 19, 24, 21, TILE.WATER);

  // Rock clusters
  const rockSpots = [[7, 6], [7, 7], [13, 13], [19, 9], [26, 10], [11, 19]];
  for (const [x, y] of rockSpots) grid[y][x] = TILE.ROCK;

  // Scattered trees for texture (kept clear of the main path/shrine/pickups)
  const treeSpots = [
    [8, 3], [8, 4], [19, 4], [19, 17], [5, 7], [24, 8], [27, 9], [4, 8],
    [24, 18], [13, 17], [28, 12], [16, 10], [21, 6], [9, 14], [15, 15],
  ];
  for (const [x, y] of treeSpots) grid[y][x] = TILE.TREE;

  // Flowers for flavor
  const flowerSpots = [[2, 6], [2, 7], [29, 6], [30, 6], [10, 17], [11, 17]];
  for (const [x, y] of flowerSpots) grid[y][x] = TILE.FLOWER;

  // Path from the player's landing spot to the shrine clearing
  for (let x = 2; x <= 29; x++) grid[20][x] = TILE.PATH;
  for (let y = 2; y <= 20; y++) grid[y][29] = TILE.PATH;

  // Shrine clearing
  fillRect(28, 1, 30, 3, TILE.GRASS);
  grid[2][29] = TILE.SHRINE;

  return grid;
}

const PLAYER_START = { x: 2, y: 20 };

const NPCS = [
  {
    id: "fox_spirit",
    x: 3,
    y: 20,
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
  { id: "pickup_gold1", x: 10, y: 8, item: "gold", qty: 25, collected: false },
  { id: "pickup_sword", x: 26, y: 5, item: "class_weapon_upgrade", qty: 1, collected: false },
  { id: "pickup_potion2", x: 4, y: 11, item: "hi_potion", qty: 1, collected: false },
  { id: "pickup_potion3", x: 22, y: 14, item: "potion", qty: 1, collected: false },
  { id: "pickup_locket", x: 28, y: 2, item: "old_locket", qty: 1, collected: false },
];

const ITEMS = {
  potion: { name: "Potion", desc: "Restores 30 HP.", type: "consumable", category: "items", heal: 30 },
  hi_potion: { name: "Hi-Potion", desc: "Restores 80 HP.", type: "consumable", category: "items", heal: 80 },
  ether: { name: "Ether", desc: "Restores 20 MP.", type: "consumable", category: "items", restoreMp: 20 },
  gold: { name: "Gold", desc: "Currency of no world in particular.", type: "currency", category: "misc" },
  iron_sword: {
    name: "Iron Sword",
    desc: "A well-balanced blade. +6 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 6,
  },
  wooden_staff: {
    name: "Wooden Staff",
    desc: "A simple staff, humming faintly with latent magic. +2 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 2,
  },
  bronze_sword: {
    name: "Bronze Sword",
    desc: "A well-worn bronze blade, dependable in a fight. +4 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 4,
  },
  magic_staff_1: {
    name: "Magic Staff I",
    desc: "A staff inscribed with novice glyphs. +6 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 6,
  },
  traveler_charm: {
    name: "Traveler's Charm",
    desc: "A charm worn smooth by travelers before you. +3 DEF.",
    type: "accessory",
    category: "accessories",
    defBonus: 3,
  },
  slime_gel: {
    name: "Slime Gel",
    desc: "Cool, faintly glowing residue. Useful to alchemists, apparently.",
    type: "material",
    category: "ingredients",
  },
  wolf_fang: {
    name: "Wolf Fang",
    desc: "A sharp fang from a Shade Wolf. Still faintly warm.",
    type: "material",
    category: "ingredients",
  },
  old_locket: {
    name: "Old Locket",
    desc: "A tarnished locket, warm to the touch. It isn't yours, and yet it feels familiar.",
    type: "misc",
    category: "misc",
  },
};

const ITEM_CATEGORIES = [
  { id: "weapons", label: "Weapons" },
  { id: "items", label: "Items" },
  { id: "accessories", label: "Accessories" },
  { id: "ingredients", label: "Ingredients" },
  { id: "misc", label: "Misc" },
];

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
    drop: { item: "slime_gel", chance: 0.5 },
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
    drop: { item: "wolf_fang", chance: 0.45 },
  },
};

const RANDOM_ENCOUNTER_TABLE = ["slime", "slime", "goblin", "goblin", "wolf"];

const ENEMY_MIN_LEVEL = 1;
const ENEMY_MAX_LEVEL = 3;

function instantiateEnemy(id) {
  const template = ENEMIES[id];
  const level = ENEMY_MIN_LEVEL + Math.floor(Math.random() * (ENEMY_MAX_LEVEL - ENEMY_MIN_LEVEL + 1));
  const tier = level - 1; // 0-based scaling steps
  return {
    ...template,
    level,
    hp: Math.round(template.hp * (1 + tier * 0.4)),
    atk: Math.round(template.atk * (1 + tier * 0.25)),
    def: template.def + tier,
    exp: Math.round(template.exp * (1 + tier * 0.5)),
    gold: Math.round(template.gold * (1 + tier * 0.5)),
  };
}

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

// ---------------------------------------------------------------------------
// Day/night cycle - driven by tiles moved, not real time or battle turns
// ---------------------------------------------------------------------------

const DAY_LENGTH = 300;
const NIGHT_LENGTH = 150;
const CYCLE_LENGTH = DAY_LENGTH + NIGHT_LENGTH;

function getDaylightFactor(turnCount) {
  const phase = turnCount % CYCLE_LENGTH;
  if (phase < DAY_LENGTH) return 1;
  const nightPhase = phase - DAY_LENGTH; // 0..NIGHT_LENGTH-1
  const third = NIGHT_LENGTH / 3;
  if (nightPhase < third) return 1 - nightPhase / third; // dusk: 1 -> 0
  if (nightPhase < third * 2) return 0; // midnight
  return (nightPhase - third * 2) / third; // dawn: 0 -> 1
}

function isNightTime(turnCount) {
  return turnCount % CYCLE_LENGTH >= DAY_LENGTH;
}

// ---------------------------------------------------------------------------
// Field monsters - roaming enemies that spawn from tall grass
// ---------------------------------------------------------------------------

const FIELD_CHASE_MIN = 7;
const FIELD_CHASE_MAX = 10;
const MAX_FIELD_MONSTERS = 6;
const FIELD_SPAWN_CHANCE = 0.1;
const INITIAL_FIELD_MONSTERS = 5;
