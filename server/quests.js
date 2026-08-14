// Static NPC and quest definitions. NPCs stand at fixed world positions and
// offer a linear quest chain — one quest unlocks the next once turned in.

const NPCS = [
  { id: 'elder_rowan', name: 'Elder Rowan', icon: '🧙', questChain: ['first_steps', 'hunter', 'angler', 'blacksmithing', 'protector'] },
];

const QUESTS = {
  first_steps: {
    id: 'first_steps',
    npc: 'elder_rowan',
    title: 'Gather Supplies',
    desc: 'The village needs supplies. Bring me 10 wood and 6 stone.',
    type: 'collect',
    cost: { wood: 10, stone: 6 },
    reward: { items: { fiber: 6, berry: 4 } },
    rewardText: '6 fiber, 4 berries',
  },
  hunter: {
    id: 'hunter',
    npc: 'elder_rowan',
    title: 'Thin the Pack',
    desc: 'Wolves grow bold at night. Hunt down 3 of them and bring proof.',
    type: 'kill',
    mobType: 'wolf',
    amount: 3,
    reward: { items: { wolf_hide: 2 }, unlocks: ['hunter'] },
    rewardText: '2 wolf hides, unlocks leather armor recipes',
  },
  angler: {
    id: 'angler',
    npc: 'elder_rowan',
    title: 'A Fisherman’s Trade',
    desc: 'The village could use a steady catch. Bring me 5 fish from the shore.',
    type: 'collect',
    cost: { raw_fish: 5 },
    reward: { items: { fiber: 4, wood: 6 } },
    rewardText: '4 fiber, 6 wood',
  },
  blacksmithing: {
    id: 'blacksmithing',
    npc: 'elder_rowan',
    title: 'The Smith’s Request',
    desc: 'Mine 6 iron ore so the smith can teach you to work metal.',
    type: 'collect',
    cost: { iron_ore: 6 },
    reward: { items: { iron_ingot: 2 }, unlocks: ['blacksmithing'] },
    rewardText: '2 iron ingots, unlocks iron tools, iron armor & smelting',
  },
  protector: {
    id: 'protector',
    npc: 'elder_rowan',
    title: 'Protector of Wildholm',
    desc: 'Prove your strength. Slay 5 more wolves to defend the village.',
    type: 'kill',
    mobType: 'wolf',
    amount: 5,
    reward: { items: { iron_ingot: 5, wolf_hide: 3 } },
    rewardText: '5 iron ingots, 3 wolf hides',
  },
};

function questsForNpc(npcId) {
  const npc = NPCS.find(n => n.id === npcId);
  return npc ? npc.questChain.map(id => QUESTS[id]) : [];
}

module.exports = { NPCS, QUESTS, questsForNpc };
