(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const TILE_PX = 40;

  let socket = null;
  let myId = null;
  let world = null; // { size, tiles }
  let state = null; // latest snapshot
  let me = null; // latest 'you' payload (inventory, hp, hunger...)
  let myPos = { x: 0, y: 0 }; // interpolated position pulled from state.players

  const keys = { up: false, down: false, left: false, right: false };
  let mouseWorld = { x: 0, y: 0 };
  let aimDir = { x: 0, y: 1 };

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Login ----------
  const loginScreen = document.getElementById('loginScreen');
  const gameEl = document.getElementById('game');
  const nameInput = document.getElementById('nameInput');
  const joinBtn = document.getElementById('joinBtn');

  function join() {
    const name = nameInput.value.trim() || 'Survivor';
    loginScreen.classList.add('hidden');
    gameEl.classList.remove('hidden');
    connect(name);
  }
  joinBtn.addEventListener('click', join);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

  // ---------- Networking ----------
  function connect(name) {
    socket = io();
    socket.on('connect', () => {
      socket.emit('join', { name });
    });
    socket.on('welcome', (data) => {
      myId = data.id;
      world = data.world;
    });
    socket.on('state', (snap) => {
      state = snap;
      const p = snap.players.find(pl => pl.id === myId);
      if (p) myPos = { x: p.x, y: p.y };
      updateClock(snap);
    });
    socket.on('you', (payload) => {
      me = payload;
      updateHud();
      renderInventory();
      renderCrafting();
      renderQuestTracker();
      if (!me.alive) showDeath(); else hideDeath();
    });
    socket.on('events', (events) => {
      for (const e of events) handleEvent(e);
    });
    socket.on('craftResult', (res) => {
      if (!res.ok) flashMessage(res.reason || 'cannot craft');
    });
    socket.on('placeResult', (res) => {
      if (!res.ok) flashMessage('cannot place there');
    });
    socket.on('eatResult', (res) => {
      if (!res.ok) flashMessage('cannot eat that');
    });
    socket.on('chat', (msg) => addChat(msg));
    socket.on('npcDialogue', (data) => showNpcDialogue(data));
    socket.on('questResult', (res) => {
      if (!res.ok) { flashMessage(res.reason || 'quest action failed'); return; }
      if (res.action === 'turnIn' && res.reward && res.reward.items) {
        const parts = Object.entries(res.reward.items).map(([it, amt]) => `+${amt} ${ITEM_INFO[it] ? ITEM_INFO[it].label : it}`);
        flashMessage(`Quest complete! ${parts.join(', ')}`);
      }
      hideNpcDialogue();
    });
  }

  const floatingTexts = [];
  function handleEvent(e) {
    if (e.type === 'gathered') {
      floatingTexts.push({ text: `+${e.amount} ${ITEM_INFO[e.item] ? ITEM_INFO[e.item].label : e.item}`, x: e.x, y: e.y, life: 1.2 });
    } else if (e.type === 'attackHit') {
      // handled visually via hp bars already
    } else if (e.type === 'mobKilled') {
      floatingTexts.push({ text: 'Kill!', x: null, y: null, life: 1 });
    }
  }

  // ---------- Input ----------
  const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput || document.activeElement === nameInput) return;
    if (keyMap[e.code]) { keys[keyMap[e.code]] = true; sendInput(); }
    if (e.code === 'KeyE') toggleCrafting();
    if (e.code === 'Space') { e.preventDefault(); eatFirstFood(); }
    if (e.code === 'Escape' && currentDialogue) hideNpcDialogue();
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) { keys[keyMap[e.code]] = false; sendInput(); }
  });

  let lastInputSent = 0;
  function sendInput() {
    if (!socket) return;
    const now = performance.now();
    if (now - lastInputSent < 40) return;
    lastInputSent = now;
    socket.emit('input', { ...keys, aimX: aimDir.x, aimY: aimDir.y });
  }
  setInterval(sendInput, 60);

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    mouseWorld = screenToWorld(sx, sy);
    const dx = mouseWorld.x - myPos.x, dy = mouseWorld.y - myPos.y;
    const len = Math.hypot(dx, dy) || 1;
    aimDir = { x: dx / len, y: dy / len };
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    doPrimaryAction();
  });

  function doPrimaryAction() {
    if (!state || !me || !me.alive) return;
    // Find nearest interactable within range of both player and click.
    let best = null, bestScore = Infinity;
    const consider = (type, id, x, y, range) => {
      const distToClick = Math.hypot(x - mouseWorld.x, y - mouseWorld.y);
      const distToPlayer = Math.hypot(x - myPos.x, y - myPos.y);
      if (distToPlayer > (range || 2.2)) return;
      if (distToClick > 1.4) return;
      if (distToClick < bestScore) { bestScore = distToClick; best = { type, id }; }
    };
    for (const r of state.resources) consider('resource', r.id, r.x, r.y);
    for (const m of state.mobs) consider('mob', m.id, m.x, m.y);
    for (const p of state.players) {
      if (p.id === myId || !p.alive) continue;
      consider('player', p.id, p.x, p.y);
    }
    for (const n of state.npcs || []) consider('npc', n.id, n.x, n.y, 3);
    if (!best) return;
    if (best.type === 'resource') socket.emit('gather', best.id);
    else if (best.type === 'npc') socket.emit('talkNpc', best.id);
    else socket.emit('attack', { targetType: best.type, targetId: best.id });
  }

  // ---------- Camera / rendering ----------
  function screenToWorld(sx, sy) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    return {
      x: myPos.x + (sx - cx) / TILE_PX,
      y: myPos.y + (sy - cy) / TILE_PX,
    };
  }
  function worldToScreen(x, y) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    return { x: cx + (x - myPos.x) * TILE_PX, y: cy + (y - myPos.y) * TILE_PX };
  }

  function draw() {
    requestAnimationFrame(draw);
    if (!world || !state) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }

    const cx = canvas.width / 2, cy = canvas.height / 2;
    const startTileX = Math.floor(myPos.x - cx / TILE_PX) - 1;
    const endTileX = Math.ceil(myPos.x + cx / TILE_PX) + 1;
    const startTileY = Math.floor(myPos.y - cy / TILE_PX) - 1;
    const endTileY = Math.ceil(myPos.y + cy / TILE_PX) + 1;

    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) continue;
        const tile = world.tiles[ty * world.size + tx];
        const s = worldToScreen(tx, ty);
        ctx.fillStyle = TILE_COLORS[tile] || '#333';
        ctx.fillRect(Math.round(s.x), Math.round(s.y), TILE_PX + 1, TILE_PX + 1);
      }
    }

    // resources
    for (const r of state.resources) {
      const s = worldToScreen(r.x, r.y);
      ctx.font = `${TILE_PX * 0.8}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const icon = r.type === 'tree' ? '🌲' : r.type === 'rock' ? '🪨' : r.type === 'iron_vein' ? '⛰️' : '🌿';
      ctx.fillText(icon, s.x, s.y);
      if (r.hp < r.maxHp) drawBar(s.x - 14, s.y - TILE_PX * 0.55, 28, 4, r.hp / r.maxHp, '#8bc34a');
    }

    // structures
    if (state.structures) {
      for (const st of state.structures) {
        const s = worldToScreen(st.x, st.y);
        ctx.font = `${TILE_PX * 0.8}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const stIcon = st.type === 'campfire' ? '🔥' : st.type === 'furnace' ? '🏭' : '🧱';
        ctx.fillText(stIcon, s.x, s.y);
      }
    }

    // npcs
    for (const n of state.npcs || []) {
      const s = worldToScreen(n.x, n.y);
      ctx.font = `${TILE_PX * 0.85}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.icon || '🧑', s.x, s.y);
      ctx.fillStyle = '#f5c542';
      ctx.font = '12px sans-serif';
      ctx.fillText(n.name, s.x, s.y - TILE_PX * 0.6);
    }

    // mobs
    for (const m of state.mobs) {
      const s = worldToScreen(m.x, m.y);
      ctx.font = `${TILE_PX * 0.75}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐺', s.x, s.y);
      drawBar(s.x - 14, s.y - TILE_PX * 0.55, 28, 4, m.hp / m.maxHp, '#e53935');
    }

    // players
    for (const p of state.players) {
      const s = worldToScreen(p.x, p.y);
      if (!p.alive) {
        ctx.font = `${TILE_PX * 0.7}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('💀', s.x, s.y);
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = p.id === myId ? '#5ba848' : '#4586c9';
      ctx.arc(s.x, s.y, TILE_PX * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();

      // facing indicator
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      const fx = s.x + p.dir.x * TILE_PX * 0.4, fy = s.y + p.dir.y * TILE_PX * 0.4;
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, s.x, s.y - TILE_PX * 0.55);
      drawBar(s.x - 16, s.y - TILE_PX * 0.48, 32, 4, p.hp / p.maxHp, '#ef5350');
    }

    // floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const f = floatingTexts[i];
      f.life -= 1 / 60;
      if (f.life <= 0) { floatingTexts.splice(i, 1); continue; }
      if (f.x !== null) {
        const s = worldToScreen(f.x, f.y - (1.2 - f.life));
        ctx.fillStyle = 'rgba(255,255,150,' + Math.min(1, f.life) + ')';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, s.x, s.y);
      }
    }

    // night overlay
    if (state.dayPhase !== undefined) {
      const night = state.isNight;
      const darkness = nightDarkness(state.dayPhase);
      if (darkness > 0) {
        ctx.fillStyle = `rgba(5,8,20,${darkness})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  function nightDarkness(phase) {
    // smooth in/out around the night window (0.55 - 0.97)
    const inStart = 0.45, inEnd = 0.6, outStart = 0.9, outEnd = 1.0;
    if (phase < inStart) return 0;
    if (phase < inEnd) return (phase - inStart) / (inEnd - inStart) * 0.55;
    if (phase < outStart) return 0.55;
    if (phase < outEnd) return 0.55 * (1 - (phase - outStart) / (outEnd - outStart));
    return 0;
  }

  function drawBar(x, y, w, h, pct, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * Math.min(1, Math.max(0, pct))), h);
  }

  requestAnimationFrame(draw);

  // ---------- HUD ----------
  const hpFill = document.getElementById('hpFill');
  const hungerFill = document.getElementById('hungerFill');
  const clockEl = document.getElementById('clock');

  function updateHud() {
    if (!me) return;
    hpFill.style.width = `${Math.max(0, (me.hp / me.maxHp) * 100)}%`;
    hungerFill.style.width = `${Math.max(0, (me.hunger / me.maxHunger) * 100)}%`;
  }

  function updateClock(snap) {
    clockEl.textContent = snap.isNight ? '🌙 Night' : '☀ Day';
  }

  const deathScreen = document.getElementById('deathScreen');
  function showDeath() { deathScreen.classList.remove('hidden'); }
  function hideDeath() { deathScreen.classList.add('hidden'); }

  // ---------- Inventory ----------
  const inventoryList = document.getElementById('inventoryList');
  const armorSlotsEl = document.getElementById('armorSlots');

  function renderInventory() {
    if (!me) return;
    inventoryList.innerHTML = '';
    for (const [item, count] of Object.entries(me.inventory)) {
      if (!count) continue;
      const info = ITEM_INFO[item] || { icon: '❔', label: item };
      if (info.armorSlot) continue; // shown in the armor slot row instead
      const slot = document.createElement('div');
      slot.className = 'itemSlot' + (me.equipped === item ? ' equipped' : '');
      slot.innerHTML = `<div>${info.icon}</div><div class="label">${info.label}</div><div class="count">${count}</div>`;
      slot.addEventListener('click', () => onInventoryClick(item, info));
      inventoryList.appendChild(slot);
    }
    if (!inventoryList.children.length) {
      inventoryList.innerHTML = '<div style="font-size:0.75em;color:#789;">Empty — gather wood & stone!</div>';
    }
    renderArmorSlots();
  }

  function renderArmorSlots() {
    armorSlotsEl.innerHTML = '';
    for (const slotName of ARMOR_SLOTS) {
      const equippedItem = me.armor && me.armor[slotName];
      const div = document.createElement('div');
      if (equippedItem) {
        const info = ITEM_INFO[equippedItem];
        div.className = 'itemSlot armorSlot equipped';
        div.innerHTML = `<div>${info.icon}</div><div class="label">${info.label}</div>`;
        div.title = 'Click to unequip';
        div.addEventListener('click', () => socket.emit('equipArmor', equippedItem));
      } else {
        div.className = 'itemSlot armorSlot empty';
        div.innerHTML = `<div>${ARMOR_SLOT_ICON[slotName]}</div><div class="label">${slotName}</div>`;
      }
      armorSlotsEl.appendChild(div);
    }
    // owned-but-unequipped armor pieces still need a slot to click on
    for (const [item, count] of Object.entries(me.inventory)) {
      if (!count) continue;
      const info = ITEM_INFO[item];
      if (!info || !info.armorSlot) continue;
      if (me.armor[info.armorSlot] === item) continue; // already shown above
      const div = document.createElement('div');
      div.className = 'itemSlot armorSlot';
      div.innerHTML = `<div>${info.icon}</div><div class="label">${info.label}</div><div class="count">${count}</div>`;
      div.title = 'Click to equip';
      div.addEventListener('click', () => socket.emit('equipArmor', item));
      armorSlotsEl.appendChild(div);
    }
  }

  function onInventoryClick(item, info) {
    if (info.equip) {
      socket.emit('equip', me.equipped === item ? null : item);
    } else if (info.edible) {
      socket.emit('eat', item);
    } else if (info.placeable) {
      const x = myPos.x + aimDir.x * 1.4;
      const y = myPos.y + aimDir.y * 1.4;
      socket.emit('place', { itemId: item, x, y });
    }
  }

  function eatFirstFood() {
    if (!me) return;
    const foodOrder = ['meat_cooked', 'meat_raw', 'berry'];
    for (const f of foodOrder) {
      if (me.inventory[f] > 0) { socket.emit('eat', f); return; }
    }
  }

  // ---------- Crafting ----------
  const craftingPanel = document.getElementById('craftingPanel');
  const craftingList = document.getElementById('craftingList');
  function toggleCrafting() {
    craftingPanel.classList.toggle('hidden');
    renderCrafting();
  }
  function renderCrafting() {
    if (craftingPanel.classList.contains('hidden') || !me) return;
    craftingList.innerHTML = '';
    for (const recipe of RECIPES) {
      const info = ITEM_INFO[recipe.result];
      const affordable = Object.entries(recipe.cost).every(([it, amt]) => (me.inventory[it] || 0) >= amt);
      const structureOk = !recipe.requiresStructure || (me.nearStructures || []).includes(recipe.requiresStructure);
      const questOk = !recipe.requiresQuest || (me.completedQuests || []).includes(recipe.requiresQuest);
      const costStr = Object.entries(recipe.cost).map(([it, amt]) => `${amt} ${ITEM_INFO[it].icon}`).join(' ');
      const slot = document.createElement('div');
      const locked = !questOk;
      const craftable = affordable && structureOk && questOk;
      slot.className = 'itemSlot craftSlot' + (locked ? ' locked' : craftable ? '' : ' disabled');
      let note = '';
      if (locked) note = '<div class="lockNote">🔒 quest locked</div>';
      else if (!structureOk) note = `<div class="lockNote">need ${recipe.requiresStructure}</div>`;
      slot.innerHTML = `<div>${info.icon}</div><div class="label">${info.label}</div><div class="cost">${costStr}</div>${note}`;
      slot.title = locked ? 'Complete the related quest to unlock this recipe' : '';
      slot.addEventListener('click', () => { if (craftable) socket.emit('craft', recipe.result); });
      craftingList.appendChild(slot);
    }
  }

  // ---------- Quests / NPC dialogue ----------
  const npcDialogueEl = document.getElementById('npcDialogue');
  const npcNameEl = document.getElementById('npcName');
  const npcTextEl = document.getElementById('npcText');
  const questCardEl = document.getElementById('questCard');
  const questTitleEl = document.getElementById('questTitle');
  const questDescEl = document.getElementById('questDesc');
  const questObjectiveEl = document.getElementById('questObjective');
  const questRewardEl = document.getElementById('questReward');
  const questActionBtn = document.getElementById('questActionBtn');
  const dialogCloseBtn = document.getElementById('dialogCloseBtn');
  const questTracker = document.getElementById('questTracker');

  let currentDialogue = null;

  function objectiveText(quest) {
    if (quest.type === 'collect') {
      return quest.progress.entries.map(e => `${e.have}/${e.need} ${ITEM_INFO[e.item] ? ITEM_INFO[e.item].label : e.item}`).join(', ');
    }
    const mobLabel = quest.mobType === 'wolf' ? 'wolves' : quest.mobType;
    return `${quest.progress.done}/${quest.progress.total} ${mobLabel} slain`;
  }

  function showNpcDialogue(data) {
    currentDialogue = data;
    npcDialogueEl.classList.remove('hidden');
    npcNameEl.textContent = data.npc ? data.npc.name : 'Villager';

    if (data.state === 'done') {
      npcTextEl.textContent = data.text;
      questCardEl.classList.add('hidden');
      questActionBtn.classList.add('hidden');
      return;
    }

    npcTextEl.textContent = data.state === 'offer'
      ? 'I have a task for you, if you\'re willing.'
      : data.state === 'ready'
        ? 'Well done — bring that back to me.'
        : 'Come back once you\'ve finished the task.';

    const q = data.quest;
    questCardEl.classList.remove('hidden');
    questTitleEl.textContent = q.title;
    questDescEl.textContent = q.desc;
    questObjectiveEl.textContent = objectiveText(q);
    questRewardEl.textContent = `Reward: ${q.rewardText}`;

    questActionBtn.classList.remove('hidden');
    if (data.state === 'offer') {
      questActionBtn.textContent = 'Accept Quest';
      questActionBtn.onclick = () => socket.emit('acceptQuest', q.id);
    } else if (data.state === 'ready') {
      questActionBtn.textContent = 'Turn In';
      questActionBtn.onclick = () => socket.emit('turnInQuest', q.id);
    } else {
      questActionBtn.classList.add('hidden');
    }
  }

  function hideNpcDialogue() {
    npcDialogueEl.classList.add('hidden');
    currentDialogue = null;
  }
  dialogCloseBtn.addEventListener('click', hideNpcDialogue);

  function renderQuestTracker() {
    if (!me) return;
    const active = Object.values(me.activeQuests || {});
    if (!active.length) { questTracker.classList.add('hidden'); return; }
    questTracker.classList.remove('hidden');
    questTracker.innerHTML = active.map(q => `
      <h4>${q.title}</h4>
      <p>${q.desc}</p>
      <p class="qprogress">${objectiveText(q)}</p>
    `).join('<hr style="border-color:#333;margin:6px 0;">');
  }

  // ---------- Chat ----------
  const chatLog = document.getElementById('chatLog');
  const chatInput = document.getElementById('chatInput');
  function addChat(msg) {
    const div = document.createElement('div');
    if (msg.system) {
      div.className = 'system';
      div.textContent = msg.text;
    } else {
      div.innerHTML = `<span class="name">${escapeHtml(msg.name)}:</span> ${escapeHtml(msg.text)}`;
    }
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    while (chatLog.children.length > 50) chatLog.removeChild(chatLog.firstChild);
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (chatInput.value.trim() && socket) socket.emit('chat', chatInput.value.trim());
      chatInput.value = '';
      chatInput.blur();
    }
  });

  function flashMessage(text) {
    addChat({ system: true, text });
  }
})();
