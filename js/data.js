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
  HERB: 8,
  MOONLEAF: 9,
  ROOF: 10,
  WALL: 11,
  DOOR: 12,
  FLOOR: 13,
  RUG: 14,
  BUSH: 15,
  SAND: 16,
};

const SOLID_TILES = new Set([TILE.TREE, TILE.WATER, TILE.ROCK, TILE.WALL, TILE.ROOF, TILE.BUSH]);

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

function isBorderTile(x, y) {
  return x === 0 || y === 0 || x === MAP_COLS - 1 || y === MAP_ROWS - 1;
}

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

  // Boulders (minable with a pickaxe)
  for (let i = 0; i < 32; i++) {
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

  // Healing Herb - a common gatherable used in basic potion brewing
  for (let i = 0; i < 26; i++) {
    grid[randInt(2, MAP_ROWS - 3)][randInt(2, MAP_COLS - 3)] = TILE.HERB;
  }

  // Moonleaf - a rarer gatherable used in stronger alchemy
  for (let i = 0; i < 12; i++) {
    grid[randInt(2, MAP_ROWS - 3)][randInt(2, MAP_COLS - 3)] = TILE.MOONLEAF;
  }

  // Forageable bushes - a solid obstacle (like a tree) offering a clickable
  // "Forage" popup for sticks, stones, herbs, and berries
  for (let i = 0; i < 22; i++) {
    grid[randInt(2, MAP_ROWS - 3)][randInt(2, MAP_COLS - 3)] = TILE.BUSH;
  }

  // Sand patches - forageable for the potion-bottle economy (fired into an
  // Empty Flask at a furnace)
  for (let i = 0; i < 20; i++) {
    grid[randInt(2, MAP_ROWS - 3)][randInt(2, MAP_COLS - 3)] = TILE.SAND;
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
    [3, 44], // fox spirit NPC
    [15, 34], // merchant NPC
    [6, 40], [18, 30], [46, 6], [10, 36], [34, 18], [58, 3], // item pickups
    [10, 40], [22, 32], [36, 22], [50, 14], [8, 20], // stick pickups
    [16, 26], [44, 10], [28, 36], // flint pickups
    [HOME_EXTERIOR.doorX, HOME_EXTERIOR.doorY + 1], // approach tile in front of the cabin door
  ];
  for (const [x, y] of keepClear) {
    if (grid[y] && grid[y][x] !== undefined && grid[y][x] !== TILE.PATH && grid[y][x] !== TILE.SHRINE) {
      grid[y][x] = TILE.GRASS;
    }
  }

  // The player's cabin - a small solid facade with a single door, carved in
  // last so nothing scattered above can ever block or overwrite it.
  for (let x = HOME_EXTERIOR.x0; x <= HOME_EXTERIOR.x1; x++) {
    grid[HOME_EXTERIOR.y0][x] = TILE.ROOF;
    grid[HOME_EXTERIOR.y0 + 1][x] = TILE.WALL;
    grid[HOME_EXTERIOR.y0 + 2][x] = TILE.WALL;
    grid[HOME_EXTERIOR.y0 + 3][x] = TILE.WALL;
  }
  grid[HOME_EXTERIOR.doorY][HOME_EXTERIOR.doorX] = TILE.DOOR;

  return grid;
}

// ---------------------------------------------------------------------------
// Player's home: a small cabin facade on the overworld, plus its own tiny
// interior map. Stepping onto a DOOR tile toggles between the two (handled
// in onPlayerArrivedTile / enterOrExitHome).
// ---------------------------------------------------------------------------

const HOME_EXTERIOR = { x0: 6, y0: 41, x1: 10, y1: 44, doorX: 8, doorY: 44 };

const HOME_COLS = 11;
const HOME_ROWS = 8;
const HOME_DOOR = { x: 5, y: 7 };
const HOME_SPAWN_INTERIOR = { x: 5, y: 6, dir: "up" };

function buildHomeMap() {
  const grid = [];
  for (let y = 0; y < HOME_ROWS; y++) {
    const row = [];
    for (let x = 0; x < HOME_COLS; x++) {
      const border = x === 0 || y === 0 || x === HOME_COLS - 1 || y === HOME_ROWS - 1;
      row.push(border ? TILE.WALL : TILE.FLOOR);
    }
    grid.push(row);
  }
  grid[HOME_DOOR.y][HOME_DOOR.x] = TILE.DOOR;
  for (let y = 2; y <= 4; y++) {
    for (let x = 4; x <= 6; x++) grid[y][x] = TILE.RUG;
  }
  return grid;
}

const HOME_MAP = buildHomeMap();

const HOME_FURNITURE = [
  { type: "fireplace", x: 5, y: 1 },
  { type: "bookshelf", x: 1, y: 1 },
  { type: "weapon_rack", x: 9, y: 1 },
  { type: "table", x: 5, y: 3 },
  { type: "chair", x: 4, y: 3 },
  { type: "chair", x: 6, y: 3 },
  { type: "bed", x: 1, y: 5 },
  { type: "chest", x: 2, y: 5 },
  { type: "cabinet", x: 9, y: 5 },
];

// Flavor text for a facing-and-confirm interaction with home furniture that
// isn't otherwise functional (the bed is handled separately, for sleep).
const HOME_FLAVOR_TEXT = {
  bookshelf: "Dust-covered books on the flora and fauna of the Whispering Wood.",
  weapon_rack: "A rack for your weapons and gear, though it's still mostly bare.",
  table: "A sturdy wooden table, its surface scarred from years of use.",
  chair: "A simple wooden chair, pulled up to the table.",
  chest: "An old traveling chest. Empty, for now.",
  cabinet: "A cabinet stocked with odds and ends from another world.",
  fireplace: "The hearth crackles softly, keeping the cabin warm.",
};

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
  potion: {
    name: "Potion",
    desc: "Restores 30 HP. Leaves behind an Empty Flask you can refill with water.",
    type: "consumable",
    category: "items",
    heal: 30,
    value: 15,
    leavesFlask: true,
  },
  hi_potion: {
    name: "Hi-Potion",
    desc: "Restores 80 HP. Leaves behind an Empty Flask you can refill with water.",
    type: "consumable",
    category: "items",
    heal: 80,
    value: 45,
    leavesFlask: true,
  },
  ether: {
    name: "Ether",
    desc: "Restores 20 MP. Leaves behind an Empty Flask you can refill with water.",
    type: "consumable",
    category: "items",
    restoreMp: 20,
    value: 20,
    leavesFlask: true,
  },
  gold: { name: "Gold", desc: "Currency of no world in particular.", type: "currency", category: "misc" },
  iron_sword: {
    name: "Iron Sword",
    desc: "A well-balanced blade. +6 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 6,
    value: 60,
    weaponKind: "sword",
  },
  wooden_staff: {
    name: "Wooden Staff",
    desc: "A simple staff, humming faintly with latent magic. +2 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 2,
    value: 25,
    weaponKind: "staff",
  },
  bronze_sword: {
    name: "Bronze Sword",
    desc: "A well-worn bronze blade, dependable in a fight. +4 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 4,
    value: 40,
    weaponKind: "sword",
  },
  magic_staff_1: {
    name: "Magic Staff I",
    desc: "A staff inscribed with novice glyphs. +6 ATK.",
    type: "weapon",
    category: "weapons",
    atkBonus: 6,
    value: 70,
    weaponKind: "staff",
  },
  traveler_charm: {
    name: "Traveler's Charm",
    desc: "A charm worn smooth by travelers before you. +3 DEF.",
    type: "accessory",
    category: "accessories",
    defBonus: 3,
    value: 50,
  },
  wolf_dagger: {
    name: "Wolf Fang Dagger",
    desc: "A quick blade carved around a Shade Wolf's fang. +7 ATK. Crafting Table only.",
    type: "weapon",
    category: "weapons",
    atkBonus: 7,
    value: 55,
    weaponKind: "dagger",
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
    desc: "A portable campfire kit. Select it here to place it on the ground in front of you. Rest at a lit campfire at night to skip to morning.",
    type: "placeable",
    category: "misc",
    value: 15,
  },
  log: {
    name: "Log",
    desc: "A sturdy length of timber, chopped from a tree.",
    type: "material",
    category: "ingredients",
    value: 6,
  },
  stone: {
    name: "Stone",
    desc: "A chunk of solid rock, mined from a boulder.",
    type: "material",
    category: "ingredients",
    value: 4,
  },
  iron_ore: {
    name: "Iron Ore",
    desc: "Raw ore veined with iron. Needs smelting to be of much use.",
    type: "material",
    category: "ingredients",
    value: 12,
  },
  copper_ore: {
    name: "Copper Ore",
    desc: "Raw ore veined with copper. Needs smelting to be of much use.",
    type: "material",
    category: "ingredients",
    value: 9,
  },
  axe: {
    name: "Axe",
    desc: "A sturdy axe. Carrying one lets you chop down trees for logs and sticks.",
    type: "tool",
    category: "misc",
    value: 35,
  },
  pickaxe: {
    name: "Pickaxe",
    desc: "A sturdy pickaxe. Carrying one lets you mine boulders for stone and ore.",
    type: "tool",
    category: "misc",
    value: 45,
  },
  bridge: {
    name: "Bridge",
    desc: "A set of planks and rope. Select it here, then face a water tile to lay a crossing.",
    type: "placeable",
    category: "misc",
    value: 20,
  },
  furnace: {
    name: "Furnace",
    desc: "A makeshift stone furnace. Press Enter to smelt ore into ingots. Hold Enter with a Pickaxe to break it back down.",
    type: "placeable",
    category: "misc",
    value: 30,
  },
  iron_ingot: {
    name: "Iron Ingot",
    desc: "A refined bar of iron, smelted from ore.",
    type: "material",
    category: "ingredients",
    value: 20,
  },
  copper_ingot: {
    name: "Copper Ingot",
    desc: "A refined bar of copper, smelted from ore.",
    type: "material",
    category: "ingredients",
    value: 16,
  },
  crafting_table: {
    name: "Crafting Table",
    desc: "A sturdy workbench. Being near one unlocks more advanced recipes.",
    type: "placeable",
    category: "misc",
    value: 10,
  },
  healing_herb: {
    name: "Healing Herb",
    desc: "A fragrant herb with mild restorative properties. Grows in patches throughout the forest.",
    type: "material",
    category: "ingredients",
    value: 6,
  },
  moonleaf: {
    name: "Moonleaf",
    desc: "A pale, faintly luminous leaf that only grows in shaded corners of the wood. Potent in alchemy.",
    type: "material",
    category: "ingredients",
    value: 14,
  },
  basic_trap: {
    name: "Basic Trap",
    desc: "A simple snare. Select it here to place it in tall grass - a rabbit that wanders close may get caught. Press Enter to check it.",
    type: "placeable",
    category: "misc",
    value: 18,
  },
  rabbit_meat: {
    name: "Rabbit Meat",
    desc: "A cut of rabbit meat from a trap. Restores 35 Hunger.",
    type: "consumable",
    category: "items",
    restoreHunger: 35,
    value: 12,
  },
  fishing_rod: {
    name: "Fishing Rod",
    desc: "A simple rod and line. Carrying one lets you fish any lake or pond - click the water in front of you to cast.",
    type: "tool",
    category: "misc",
    value: 40,
  },
  fish_small: {
    name: "Small Fish",
    desc: "A modest catch. Restores 15 Hunger.",
    type: "consumable",
    category: "items",
    restoreHunger: 15,
    value: 15,
  },
  fish_medium: {
    name: "Medium Fish",
    desc: "A decent-sized catch. Restores 25 Hunger.",
    type: "consumable",
    category: "items",
    restoreHunger: 25,
    value: 35,
  },
  fish_large: {
    name: "Large Fish",
    desc: "A hefty catch. Restores 35 Hunger.",
    type: "consumable",
    category: "items",
    restoreHunger: 35,
    value: 70,
  },
  fish_extra_large: {
    name: "Extra Large Fish",
    desc: "An impressive catch, worth showing off. Restores 45 Hunger.",
    type: "consumable",
    category: "items",
    restoreHunger: 45,
    value: 150,
  },
  fish_golden: {
    name: "Golden Fish",
    desc: "A shimmering, legendary catch. Far too precious to eat - sells for 1000 gold.",
    type: "misc",
    category: "misc",
    // The shop sells items back at half their `value`, so this is set to
    // 2000 to land on the requested 1000-gold sell price.
    value: 2000,
  },
  chest: {
    name: "Chest",
    desc: "A sturdy wooden chest. Select it here to place it, then press Enter to store and retrieve items.",
    type: "placeable",
    category: "misc",
    value: 20,
  },
  berry: {
    name: "Berries",
    desc: "A handful of wild berries. Restores 10 Hunger and 5 Thirst.",
    type: "consumable",
    category: "items",
    restoreHunger: 10,
    restoreThirst: 5,
    value: 5,
  },
  empty_flask: {
    name: "Empty Flask",
    desc: "A glass flask, empty after you drank the potion inside. Face a lake or pond and interact to fill it with water, or hand it over as the bottle a Crafting Table potion recipe needs.",
    type: "tool",
    category: "misc",
    value: 10,
  },
  sand: {
    name: "Sand",
    desc: "Fine, pale sand. Fired in a furnace, three scoops make a new Empty Flask.",
    type: "material",
    category: "ingredients",
    value: 2,
  },
  dirty_water: {
    name: "Dirty Water",
    desc: "Unfiltered water scooped from a lake. Restores 30 Thirst, but has a chance of poisoning you.",
    type: "consumable",
    category: "items",
    restoreThirst: 30,
    poisonChance: 0.3,
    value: 4,
  },
  purified_water: {
    name: "Purified Water",
    desc: "Water boiled clean over a furnace. Restores 50 Thirst with no risk.",
    type: "consumable",
    category: "items",
    restoreThirst: 50,
    value: 10,
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
  {
    id: "axe",
    name: "Axe",
    result: "axe",
    resultQty: 1,
    ingredients: [
      { item: "stick", qty: 2 },
      { item: "flint", qty: 1 },
    ],
  },
  {
    id: "pickaxe",
    name: "Pickaxe",
    result: "pickaxe",
    resultQty: 1,
    ingredients: [
      { item: "stick", qty: 2 },
      { item: "flint", qty: 2 },
    ],
  },
  {
    id: "bridge",
    name: "Bridge",
    result: "bridge",
    resultQty: 1,
    ingredients: [
      { item: "log", qty: 2 },
    ],
  },
  {
    id: "furnace",
    name: "Furnace",
    result: "furnace",
    resultQty: 1,
    ingredients: [
      { item: "stone", qty: 5 },
    ],
  },
  {
    id: "crafting_table",
    name: "Crafting Table",
    result: "crafting_table",
    resultQty: 1,
    altIngredients: [
      [{ item: "log", qty: 1 }],
      [{ item: "stick", qty: 2 }],
    ],
  },
  {
    id: "iron_sword_crafted",
    name: "Iron Sword",
    result: "iron_sword",
    resultQty: 1,
    requiresTable: true,
    ingredients: [
      { item: "iron_ingot", qty: 2 },
      { item: "log", qty: 1 },
    ],
  },
  {
    id: "potion_brew",
    name: "Potion",
    result: "potion",
    resultQty: 1,
    requiresTable: true,
    altIngredients: [
      [{ item: "slime_gel", qty: 2 }, { item: "empty_flask", qty: 1 }],
      [{ item: "healing_herb", qty: 3 }, { item: "empty_flask", qty: 1 }],
    ],
  },
  {
    id: "hi_potion_brew",
    name: "Hi-Potion",
    result: "hi_potion",
    resultQty: 1,
    requiresTable: true,
    altIngredients: [
      [{ item: "slime_gel", qty: 2 }, { item: "wolf_fang", qty: 1 }, { item: "empty_flask", qty: 1 }],
      [{ item: "healing_herb", qty: 2 }, { item: "moonleaf", qty: 1 }, { item: "empty_flask", qty: 1 }],
    ],
  },
  {
    id: "ether_brew",
    name: "Ether",
    result: "ether",
    resultQty: 1,
    requiresTable: true,
    ingredients: [
      { item: "moonleaf", qty: 2 },
      { item: "empty_flask", qty: 1 },
    ],
  },
  {
    id: "wolf_dagger_crafted",
    name: "Wolf Fang Dagger",
    result: "wolf_dagger",
    resultQty: 1,
    requiresTable: true,
    ingredients: [
      { item: "wolf_fang", qty: 2 },
      { item: "stick", qty: 1 },
    ],
  },
  {
    id: "basic_trap_crafted",
    name: "Basic Trap",
    result: "basic_trap",
    resultQty: 1,
    requiresTable: true,
    ingredients: [
      { item: "stick", qty: 4 },
      { item: "log", qty: 1 },
    ],
  },
  {
    id: "fishing_rod_crafted",
    name: "Fishing Rod",
    result: "fishing_rod",
    resultQty: 1,
    requiresTable: true,
    ingredients: [
      { item: "stick", qty: 3 },
      { item: "log", qty: 1 },
      { item: "flint", qty: 1 },
    ],
  },
  {
    id: "chest_crafted",
    name: "Chest",
    result: "chest",
    resultQty: 1,
    ingredients: [
      { item: "log", qty: 2 },
    ],
  },
];

const MERCHANT_STOCK = [
  "potion", "hi_potion", "ether", "iron_sword", "bronze_sword", "wooden_staff", "magic_staff_1", "traveler_charm",
  "stick", "flint", "log", "stone", "iron_ore", "copper_ore", "axe", "pickaxe", "bridge",
  "furnace", "iron_ingot", "copper_ingot", "crafting_table", "basic_trap", "fishing_rod", "chest", "empty_flask",
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
// Game clock: everything that used to advance "once per tile walked" (day/
// night, hunger/thirst, out-of-combat regen, monster/rabbit spawn rolls, trap
// checks) now advances once per TICK_INTERVAL_MS of real elapsed time
// instead, via accumulateGameTicks() in player.js - so the clock keeps
// moving, monsters keep roaming, and a stationary player still regenerates,
// whether they're walking, standing still, fighting, or reading a textbox.
// ---------------------------------------------------------------------------

const TICK_INTERVAL_MS = 300;

// ---------------------------------------------------------------------------
// Day/night cycle
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

// ---------------------------------------------------------------------------
// Live combat tuning - real-time swings/casts/monster attacks, not menus
// ---------------------------------------------------------------------------

const PLAYER_MOVE_SPEED = 150; // px/s, was 220 - slower for reaction time
const MONSTER_MOVE_SPEED = 95; // px/s - slower than the player, but free-roaming/diagonal now
const ATTACK_COOLDOWN_MS = 500;

// ---------------------------------------------------------------------------
// Free (non-tile) movement: player/monsters move continuously in any of 8
// directions and collide with the map as a circle rather than snapping
// between tile centers. tileX/tileY are still derived every frame (floor of
// the entity's center point) so range/lookup code elsewhere keeps working.
// ---------------------------------------------------------------------------

const PLAYER_RADIUS = TILE_SIZE * 0.32;
const MONSTER_RADIUS = TILE_SIZE * 0.3;
const COMBAT_CONTACT_GAP = 4; // extra px of buffer added to radius-sum contact checks

// ---------------------------------------------------------------------------
// Combat "juice": a landed hit briefly knocks its target back (wall-aware,
// decaying), freezes gameplay for a couple frames for weight, and jolts the
// camera - screenToTile/effect helpers live in player.js and main.js.
// ---------------------------------------------------------------------------

const KNOCKBACK_DURATION_MS = 200;
const KNOCKBACK_FORCE_MONSTER = 260; // px/s initial push, decaying to 0
const KNOCKBACK_FORCE_RABBIT = 220;
const KNOCKBACK_FORCE_PLAYER = 180;
const HITSTOP_MS_HIT = 45; // landing a normal hit
const HITSTOP_MS_KILL = 90; // a kill blow - a little more weight
const SHAKE_MS_HIT = 120;
const SHAKE_MAG_HIT = 2.5; // px
const SHAKE_MS_KILL = 220;
const SHAKE_MAG_KILL = 5;
const SHAKE_MS_PLAYER_HIT = 160;
const SHAKE_MAG_PLAYER_HIT = 4;
const HITSTOP_DT_SCALE = 0.08; // gameplay dt is multiplied by this during hit-stop - a near-freeze, not a hard stop
const CAMERA_LERP_SPEED = 10; // higher = camera catches up to the player faster

// Melee/ranged attacks aim along a continuous angle (toward the mouse)
// instead of snapping to 4 cardinal directions, so swings/fireballs can fire
// diagonally. MELEE_HALF_ANGLE spans the same 120-degree cone the old 3-tile
// hitbox covered.
const MELEE_RANGE = TILE_SIZE * 1.55;
const MELEE_HALF_ANGLE = Math.PI / 3;

// ---------------------------------------------------------------------------
// Dash: up to DASH_MAX_CHARGES uses, each charge recharging independently
// over DASH_RECHARGE_MS. Travels DASH_DISTANCE, animated (not instant) over
// DASH_DURATION_MS, in whichever movement direction is held alongside Q (or
// the player's current facing if none is held).
// ---------------------------------------------------------------------------

const DASH_MAX_CHARGES = 3;
const DASH_RECHARGE_MS = 15000;
const DASH_DISTANCE = TILE_SIZE * 3;
const DASH_DURATION_MS = 160;

// ---------------------------------------------------------------------------
// Monster corpses: a defeated monster/rabbit drops its item loot as a corpse
// in the world instead of straight into the inventory. A "Loot" popup near
// it loots everything at once; clicking the corpse directly opens a panel to
// choose individual items. Unlooted corpses fade away after a while.
// ---------------------------------------------------------------------------

const CORPSE_LOOT_RANGE = TILE_SIZE * 1.4;
const CORPSE_DESPAWN_MS = 90000;
const SWING_ANIM_MS = 220; // how long the melee swing arc animates for
const STAFF_SWING_ANIM_MS = 260; // how long a staff bonk/thrust animates for
const FIST_SWING_ANIM_MS = 160; // how long a barehanded jab animates for
const CAST_ANIM_MS = 380; // how long the fireball cast glow (staff/hands) animates for
const TOOL_SWING_ANIM_MS = 250; // how long the axe/pickaxe lunge animates for
const RESOURCE_HITS_REQUIRED = 3; // hits needed to fell a tree or break a boulder
const MONSTER_ATTACK_INTERVAL_MS = 1300;
const FIREBALL_SPEED = 260; // px/s
const FIREBALL_MAX_LIFE_MS = 1500;
const FIREBALL_MP_COST = 8;
const FATAL_PARRY_COOLDOWN_MS = 15000;
const FURNACE_LONG_PRESS_MS = 700;
const CROUCH_SPEED_MULT = 0.6; // crouching slows the player further
const REGEN_COOLDOWN_MS = 8000; // real ms after any combat action before HP/MP regen can resume
const HP_REGEN_PER_TILE = 3;
const MP_REGEN_PER_TILE = 1;
const HOTBAR_SIZE = 9;
const HOTBAR_ITEM_COOLDOWN_MS = 10000; // per-slot cooldown for a dragged-on consumable

// ---------------------------------------------------------------------------
// Slow: a mage bolt that, on hitting a monster, halves its move speed for a
// while - travels and is aimed exactly like Fireball, but debuffs instead of
// damaging.
// ---------------------------------------------------------------------------

const SLOW_SPEED = 260; // px/s, matches Fireball's travel speed
const SLOW_MAX_LIFE_MS = 1500;
const SLOW_MP_COST = 10;
const SLOW_COOLDOWN_MS = 12000; // on top of the shared attack cooldown
const SLOW_DURATION_MS = 10000; // how long a hit monster stays slowed
const SLOW_SPEED_MULT = 0.5; // the hit monster's move speed while slowed

// ---------------------------------------------------------------------------
// Character attributes: 3 points to distribute per level-up (on top of the
// automatic per-level growth every class already gets), spent from the
// Profile tab. Strength adds flat ATK, Defence adds flat DEF, Mind adds both
// max MP and a magic-damage multiplier for spells (Fireball, Slow).
// ---------------------------------------------------------------------------

const STAT_POINTS_PER_LEVEL = 3;
const STR_ATK_PER_POINT = 2;
const DEF_PER_POINT = 1;
const MIND_MP_PER_POINT = 5;
const MIND_MAGIC_DMG_PER_POINT = 0.02; // +2% magic damage per point

// ---------------------------------------------------------------------------
// Placement: choosing where to put a crafted item with the mouse, within a
// short range of the player rather than only the tile directly ahead.
// ---------------------------------------------------------------------------

const PLACEMENT_RANGE = 2; // tiles, Chebyshev distance from the player

// ---------------------------------------------------------------------------
// Poisoning: a chance from drinking Dirty Water. Ticks HP damage once a
// second while active, but never pushes HP below the floor.
// ---------------------------------------------------------------------------

const POISON_DURATION_MS = 5000;
const POISON_TICK_MS = 1000;
const POISON_DAMAGE_PER_TICK = 5;
const POISON_HP_FLOOR = 10;

// ---------------------------------------------------------------------------
// Survival: hunger/thirst drain slowly over time, restored by eating/
// drinking. Empty of either starts chipping away at HP.
// ---------------------------------------------------------------------------

const HUNGER_MAX = 100;
const THIRST_MAX = 100;
const HUNGER_DECAY_PER_TILE = 0.06;
const THIRST_DECAY_PER_TILE = 0.09;
const STARVATION_DAMAGE = 1;
const STARVATION_INTERVAL_TILES = 4; // hunger/thirst at 0 costs 1 HP every N ticks

// ---------------------------------------------------------------------------
// Rabbits: harmless critters that wander tall grass, caught with a placed
// Basic Trap rather than fought - capped per-map like field monsters.
// ---------------------------------------------------------------------------

const RABBIT_LIMIT = 2;
const RABBIT_SPAWN_CHANCE = 0.08;
const RABBIT_MOVE_SPEED = 110; // px/s
const TRAP_CATCH_CHANCE = 0.2; // per monster-turn tick, while a rabbit is adjacent to an unloaded trap
const RABBIT_NOTICE_RADIUS = 3; // tiles - a rabbit within this of the player flees instead of wandering
const RABBIT_MAX_HP = 14; // low HP so it still dies fast, but takes real hits like a monster instead of one melee swing

// ---------------------------------------------------------------------------
// Interacting at range: clicking directly on an NPC or a placed object
// (crafting table, chest, furnace, trap, bed) opens it without needing to
// walk up and face it, as long as it's within this many tiles.
// ---------------------------------------------------------------------------

const INTERACT_CLICK_RANGE = 4;

// ---------------------------------------------------------------------------
// Foraging: standing near a bush, herb patch, moonleaf patch, or sand patch
// offers a clickable "Forage" popup. Each source has its own loot table and
// roll range; every forage also has a separate chance of a bonus Stick
// and/or Flint on top of its normal drops.
// ---------------------------------------------------------------------------

const FORAGE_SOURCES = {
  [TILE.BUSH]: { table: ["stick", "stone", "healing_herb", "berry"], minRolls: 1, maxRolls: 2 },
  [TILE.HERB]: { table: ["healing_herb"], minRolls: 1, maxRolls: 1 },
  [TILE.MOONLEAF]: { table: ["moonleaf"], minRolls: 1, maxRolls: 1 },
  [TILE.SAND]: { table: ["sand"], minRolls: 1, maxRolls: 2 },
};
const FORAGE_BONUS_CHANCE = 0.35; // independent chance of a bonus Stick, and again for a bonus Flint

// ---------------------------------------------------------------------------
// Fishing: standing near water with a Fishing Rod shows a "Press F to fish"
// prompt. F casts and, after a short wait, starts a minigame - hold Up/Down
// (or W/S) to move a green catch-box and keep the fish inside it. The fish
// drifts on its own, more erratically for a bigger/rarer catch; staying on
// it fills a progress meter, drifting off it drains that meter.
// ---------------------------------------------------------------------------

const FISH_CAST_MS = 500; // line-toss animation before the bobber settles
const FISH_WAIT_MIN_MS = 900;
const FISH_WAIT_MAX_MS = 2200;

const FISH_RARITY_TABLE = [
  { id: "fish_small", weight: 50 },
  { id: "fish_medium", weight: 25 },
  { id: "fish_large", weight: 10 },
  { id: "fish_extra_large", weight: 9 },
  { id: "fish_golden", weight: 6 },
];

// Difficulty 0..1 - how fast/erratically the fish drifts in the minigame bar.
const FISH_DIFFICULTY = {
  fish_small: 0.28,
  fish_medium: 0.48,
  fish_large: 0.68,
  fish_extra_large: 0.85,
  fish_golden: 1,
};

const FISH_MINIGAME_BAR_HEIGHT = 240; // px, screen space
const FISH_MINIGAME_BOX_HEIGHT_FRAC = 0.28; // fraction of the bar the catch-box covers
const FISH_MINIGAME_BOX_SPEED = 1.5; // fraction of the bar per second while held
const FISH_MINIGAME_FILL_RATE = 0.5; // progress per second while the fish is inside the box
const FISH_MINIGAME_DRAIN_RATE = 0.28; // progress per second while the fish is outside the box

function rollFishCatch() {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const entry of FISH_RARITY_TABLE) {
    acc += entry.weight;
    if (roll < acc) return entry.id;
  }
  return FISH_RARITY_TABLE[0].id;
}
