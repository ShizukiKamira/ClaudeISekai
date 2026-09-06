// ---------------------------------------------------------------------------
// Static game data: tile map, items, enemies, dialogue text, NPC/pickup layout
// ---------------------------------------------------------------------------

const TILE_SIZE = 40;
const MAP_COLS = 64;
const MAP_ROWS = 48;
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

// Deterministic PRNG (mulberry32) so the procedurally-scattered map is
// identical on every load while still looking hand-varied.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAP_SEED = 20240613;

// Waypoints for the winding path from the player's landing spot to the
// shrine, walked as straight orthogonal segments.
const PATH_WAYPOINTS = [
  [2, 44], [2, 34], [14, 34], [14, 20], [30, 20], [30, 8], [48, 8], [48, 3], [60, 3],
];

const PLAYER_START = { x: 2, y: 44 };
const BED = { x: 3, y: 43 };

function buildMap() {
  const rng = mulberry32(MAP_SEED);
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

  const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));

  // Tall grass patches (bushes) - where monsters spawn
  for (let i = 0; i < 40; i++) {
    const w = randInt(3, 5);
    const h = randInt(3, 5);
    const x0 = randInt(2, MAP_COLS - w - 3);
    const y0 = randInt(2, MAP_ROWS - h - 3);
    fillRect(x0, y0, x0 + w - 1, y0 + h - 1, TILE.TALLGRASS);
  }

  // Ponds
  for (let i = 0; i < 8; i++) {
    const w = randInt(2, 4);
    const h = randInt(2, 4);
    const x0 = randInt(2, MAP_COLS - w - 3);
    const y0 = randInt(2, MAP_ROWS - h - 3);
    fillRect(x0, y0, x0 + w - 1, y0 + h - 1, TILE.WATER);
  }

  // Rock clusters
  for (let i = 0; i < 24; i++) {
    grid[randInt(2, MAP_ROWS - 3)][randInt(2, MAP_COLS - 3)] = TILE.ROCK;
  }

  // Scattered trees for texture
  for (let i = 0; i < 70; i++) {
    grid[randInt(2, MAP_ROWS - 3)][randInt(2, MAP_COLS - 3)] = TILE.TREE;
  }

  // Flowers for flavor
  for (let i = 0; i < 30; i++) {
    grid[randInt(2, MAP_ROWS - 3)][randInt(2, MAP_COLS - 3)] = TILE.FLOWER;
  }

  // Path from the player's landing spot to the shrine clearing
  const carveSegment = (x0, y0, x1, y1) => {
    if (x0 === x1) {
      const [ys, ye] = y0 < y1 ? [y0, y1] : [y1, y0];
      for (let y = ys; y <= ye; y++) grid[y][x0] = TILE.PATH;
    } else {
      const [xs, xe] = x0 < x1 ? [x0, x1] : [x1, x0];
      for (let x = xs; x <= xe; x++) grid[y0][x] = TILE.PATH;
    }
  };
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const [x0, y0] = PATH_WAYPOINTS[i];
    const [x1, y1] = PATH_WAYPOINTS[i + 1];
    carveSegment(x0, y0, x1, y1);
  }

  // Shrine clearing
  fillRect(58, 1, 62, 4, TILE.GRASS);
  grid[2][60] = TILE.SHRINE;

  // Force structurally important tiles back to walkable ground, in case
  // the random decoration scatter landed something solid on top of them.
  const keepClear = [
    [PLAYER_START.x, PLAYER_START.y],
    [BED.x, BED.y],
    [3, 44], // fox spirit NPC
    [15, 34], // merchant NPC
    [6, 40], [18, 30], [46, 6], [10, 36], [34, 18], [58, 3], // item pickups
    [10, 40], [22, 32], [36, 22], [50, 14], [8, 20], // stick pickups
    [16, 26], [44, 10], [28, 36], // flint pickups
  ];
  for (const [x, y] of keepClear) {
    if (grid[y] && grid[y][x] !== undefined && grid[y][x] !== TILE.PATH && grid[y][x] !== TILE.SHRINE) {
      grid[y][x] = TILE.GRASS;
    }
  }

  return grid;
}

const NPCS = [
  {
    id: "fox_spirit",
    x: 3,
    y: 44,
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
  {
    id: "merchant",
    x: 15,
    y: 34,
    color: "#4f8dae",
    name: "Old Wren",
    shop: true,
  },
];

const ITEM_PICKUPS = [
  { id: "pickup_potion1", x: 6, y: 40, item: "potion", qty: 1, collected: false },
  { id: "pickup_gold1", x: 18, y: 30, item: "gold", qty: 25, collected: false },
  { id: "pickup_sword", x: 46, y: 6, item: "class_weapon_upgrade", qty: 1, collected: false },
  { id: "pickup_potion2", x: 10, y: 36, item: "hi_potion", qty: 1, collected: false },
  { id: "pickup_potion3", x: 34, y: 18, item: "potion", qty: 1, collected: false },
  { id: "pickup_locket", x: 58, y: 3, item: "old_locket", qty: 1, collected: false },
  { id: "pickup_stick1", x: 10, y: 40, item: "stick", qty: 1, collected: false },
  { id: "pickup_stick2", x: 22, y: 32, item: "stick", qty: 1, collected: false },
  { id: "pickup_stick3", x: 36, y: 22, item: "stick", qty: 1, collected: false },
  { id: "pickup_stick4", x: 50, y: 14, item: "stick", qty: 1, collected: false },
  { id: "pickup_stick5", x: 8, y: 20, item: "stick", qty: 1, collected: false },
  { id: "pickup_flint1", x: 16, y: 26, item: "flint", qty: 1, collected: false },
  { id: "pickup_flint2", x: 44, y: 10, item: "flint", qty: 1, collected: false },
  { id: "pickup_flint3", x: 28, y: 36, item: "flint", qty: 1, collected: false },
];

const ITEMS = {
  potion: { name: "Potion", desc: "Restores 30 HP.", type: "consumable", category: "items", heal: 30, value: 15 },
  hi_potion: { name: "Hi-Potion", desc: "Restores 80 HP.", type: "consumable", category: "items", heal: 80, value: 45 },
  ether: { name: "Ether", desc: "Restores 20 MP.", type: "consumable", category: "items", restoreMp: 20, value: 20 },
  gold: { name: "Gold", desc: "Currency of no world in particular.", type: "currency", category: "misc" },
  iron_sword: {
    name: "Iron Sword",
    desc: "A well-balanced blade. +6 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 6,
    value: 60,
  },
  wooden_staff: {
    name: "Wooden Staff",
    desc: "A simple staff, humming faintly with latent magic. +2 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 2,
    value: 25,
  },
  bronze_sword: {
    name: "Bronze Sword",
    desc: "A well-worn bronze blade, dependable in a fight. +4 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 4,
    value: 40,
  },
  magic_staff_1: {
    name: "Magic Staff I",
    desc: "A staff inscribed with novice glyphs. +6 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 6,
    value: 70,
  },
  traveler_charm: {
    name: "Traveler's Charm",
    desc: "A charm worn smooth by travelers before you. +3 DEF.",
    type: "accessory",
    category: "accessories",
    defBonus: 3,
    value: 50,
  },
  slime_gel: {
    name: "Slime Gel",
    desc: "Cool, faintly glowing residue. Useful to alchemists, apparently.",
    type: "material",
    category: "ingredients",
    value: 5,
  },
  wolf_fang: {
    name: "Wolf Fang",
    desc: "A sharp fang from a Shade Wolf. Still faintly warm.",
    type: "material",
    category: "ingredients",
    value: 8,
  },
  old_locket: {
    name: "Old Locket",
    desc: "A tarnished locket, warm to the touch. It isn't yours, and yet it feels familiar.",
    type: "misc",
    category: "misc",
    value: 20,
  },
  stick: {
    name: "Stick",
    desc: "A dry branch. Useful for crafting.",
    type: "material",
    category: "ingredients",
    value: 2,
  },
  flint: {
    name: "Flint",
    desc: "A sharp shard of flint, good for striking a spark.",
    type: "material",
    category: "ingredients",
    value: 4,
  },
  campfire: {
    name: "Campfire",
    desc: "A portable campfire kit. Select it here to place it on the ground in front of you.",
    type: "placeable",
    category: "misc",
    value: 15,
  },
};

const CRAFTING_RECIPES = [
  {
    id: "campfire",
    name: "Campfire",
    result: "campfire",
    resultQty: 1,
    ingredients: [
      { item: "stick", qty: 3 },
      { item: "flint", qty: 1 },
    ],
  },
];

const MERCHANT_STOCK = [
  "potion", "hi_potion", "ether", "iron_sword", "bronze_sword", "wooden_staff", "magic_staff_1", "traveler_charm",
];

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
const DAY_MAX_FIELD_MONSTERS = 3;
const NIGHT_MAX_FIELD_MONSTERS = 10;
const FIELD_SPAWN_CHANCE = 0.1;
const INITIAL_FIELD_MONSTERS = 3;
