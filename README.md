# The Whispering Wood

A small browser-based isekai RPG. You play as someone pulled from their own
world into a mysterious forest, with no idea how to get home.

Built with plain HTML5 Canvas + vanilla JavaScript - no build step, no
dependencies.

## How to play

Open `index.html` in a browser, or serve the folder with any static file
server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

**Controls**

- Arrow keys / WASD - move
- Enter / Space / Z - confirm, talk to NPCs, advance dialogue
- I / Tab - open the status & inventory menu
- Escape / X - back out of a menu

## The story

You wake in the Whispering Wood, a forest between worlds. Kiri, a fox
spirit, explains what happened and points you toward the Ancient Shrine to
the north-east. Explore the forest, fight the creatures that lurk in the
tall grass, collect gold and equipment, and grow strong enough to face the
Guardian of the Between at the Shrine.

## Features

- Tile-based overworld with collision, tall-grass random encounters, item
  pickups, and an NPC you can talk to
- Turn-based battles (Attack / Skill / Item / Run) with EXP, leveling, and
  a boss fight
- Inventory and equipment (a weapon that boosts attack)
- Save / continue via `localStorage`

## Project structure

```
index.html        entry point
css/style.css      page chrome
js/data.js         map layout, items, enemies, dialogue text
js/input.js        keyboard handling
js/dialogue.js     textbox overlay system
js/player.js       player stats, movement, leveling
js/world.js        overworld rendering
js/combat.js       turn-based battle system
js/main.js         game states, screens, save/load, main loop
```
