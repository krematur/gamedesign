import * as Render3D from './render3d.js';

(() => {
  const canvas3d = document.getElementById('canvas3d');
  const canvas2d = document.getElementById('canvas2d');
  const ctx = canvas2d.getContext('2d');

  Render3D.init(canvas3d);

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
    canvas2d.width = window.innerWidth;
    canvas2d.height = window.innerHeight;
    Render3D.resize();
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
      Render3D.setWorld(world);
    });
    socket.on('state', (snap) => {
      state = snap;
      const p = snap.players.find(pl => pl.id === myId);
      if (p) myPos = { x: p.x, y: p.y };
      updateClock(snap);
      Render3D.setDayPhase(snap.dayPhase, snap.isNight);
      Render3D.syncState(snap, myId);
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
        const parts = Object.entries(res.reward.items).map(([it, amt]) => `+${amt} ${getItemInfo(it).label}`);
        flashMessage(`Quest complete! ${parts.join(', ')}`);
      }
      hideNpcDialogue();
    });
  }

  const floatingTexts = [];
  function handleEvent(e) {
    if (e.type === 'gathered') {
      const info = getItemInfo(e.item);
      floatingTexts.push({ text: `+${e.amount} ${info.label}`, x: e.x, y: e.y, life: 1.2, color: QUALITY_COLOR[info.quality] });
    } else if (e.type === 'attackHit') {
      // handled visually via hp bars already
    } else if (e.type === 'mobKilled') {
      floatingTexts.push({ text: 'Kill!', x: null, y: null, life: 1 });
    } else if (e.type === 'gatherFail') {
      flashMessage(e.reason || 'cannot gather that');
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

  canvas3d.addEventListener('mousemove', (e) => {
    const ground = Render3D.groundPointFromMouse(e.clientX, e.clientY, canvas3d);
    if (!ground) return;
    mouseWorld = ground;
    const dx = mouseWorld.x - myPos.x, dy = mouseWorld.y - myPos.y;
    const len = Math.hypot(dx, dy) || 1;
    aimDir = { x: dx / len, y: dy / len };
  });

  canvas3d.addEventListener('mousedown', (e) => {
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

  // ---------- Render loop ----------
  // The 3D world/entities are drawn by Render3D (WebGL). This loop only
  // drives the camera each frame and paints a thin 2D overlay (health bars,
  // floating damage/gather text) on top, projected from world space.
  function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);
    if (!world || !state) return;

    Render3D.updateCamera(myPos, aimDir);
    Render3D.render();

    for (const r of state.resources) {
      if (r.hp < r.maxHp) {
        const s = Render3D.projectToScreen(r.x, r.y, 1.1, canvas3d);
        if (!s.behind) drawBar(s.x - 14, s.y, 28, 4, r.hp / r.maxHp, '#8bc34a');
      }
    }
    for (const m of state.mobs) {
      const s = Render3D.projectToScreen(m.x, m.y, 0.85, canvas3d);
      if (!s.behind) drawBar(s.x - 14, s.y, 28, 4, m.hp / m.maxHp, '#e53935');
    }
    for (const p of state.players) {
      if (!p.alive) continue;
      const s = Render3D.projectToScreen(p.x, p.y, 1.85, canvas3d);
      if (!s.behind) drawBar(s.x - 16, s.y, 32, 4, p.hp / p.maxHp, '#ef5350');
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const f = floatingTexts[i];
      f.life -= 1 / 60;
      if (f.life <= 0) { floatingTexts.splice(i, 1); continue; }
      if (f.x !== null) {
        const s = Render3D.projectToScreen(f.x, f.y, 1.4 + (1.2 - f.life) * 0.8, canvas3d);
        if (s.behind) continue;
        ctx.fillStyle = f.color || 'rgba(255,255,150,' + Math.min(1, f.life) + ')';
        ctx.globalAlpha = Math.min(1, f.life);
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, s.x, s.y);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBar(x, y, w, h, pct, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * Math.min(1, Math.max(0, pct))), h);
  }

  requestAnimationFrame(animate);

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
      const info = getItemInfo(item);
      if (info.armorSlot || info.accessorySlot) continue; // shown in the equipment row instead
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
        const info = getItemInfo(equippedItem);
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
    // accessory slot
    {
      const div = document.createElement('div');
      if (me.accessory) {
        const info = getItemInfo(me.accessory);
        div.className = 'itemSlot armorSlot equipped';
        div.innerHTML = `<div>${info.icon}</div><div class="label">${info.label}</div>`;
        div.title = 'Click to unequip';
        div.addEventListener('click', () => socket.emit('equipAccessory', me.accessory));
      } else {
        div.className = 'itemSlot armorSlot empty';
        div.innerHTML = `<div>💍</div><div class="label">trinket</div>`;
      }
      armorSlotsEl.appendChild(div);
    }
    // owned-but-unequipped armor/accessory pieces still need a slot to click on
    for (const [item, count] of Object.entries(me.inventory)) {
      if (!count) continue;
      const info = getItemInfo(item);
      if (!info) continue;
      if (info.armorSlot) {
        if (me.armor[info.armorSlot] === item) continue; // already shown above
        const div = document.createElement('div');
        div.className = 'itemSlot armorSlot';
        div.innerHTML = `<div>${info.icon}</div><div class="label">${info.label}</div><div class="count">${count}</div>`;
        div.title = 'Click to equip';
        div.addEventListener('click', () => socket.emit('equipArmor', item));
        armorSlotsEl.appendChild(div);
      } else if (info.accessorySlot) {
        if (me.accessory === item) continue; // already shown above
        const div = document.createElement('div');
        div.className = 'itemSlot armorSlot';
        div.innerHTML = `<div>${info.icon}</div><div class="label">${info.label}</div><div class="count">${count}</div>`;
        div.title = 'Click to equip';
        div.addEventListener('click', () => socket.emit('equipAccessory', item));
        armorSlotsEl.appendChild(div);
      }
    }
  }

  function onInventoryClick(item, info) {
    if (info.equip) {
      socket.emit('equip', me.equipped === item ? null : item);
    } else if (info.accessorySlot) {
      socket.emit('equipAccessory', item);
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
    // best food first: fine > normal > crude for each food type, best food type first
    const foodOrder = [
      'cooked_fish_fine', 'meat_cooked_fine', 'cooked_fish', 'meat_cooked', 'cooked_fish_crude', 'meat_cooked_crude',
      'raw_fish_fine', 'raw_fish', 'raw_fish_crude', 'meat_raw', 'berry',
    ];
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
      const info = getItemInfo(recipe.result);
      const label = info.label + (recipe.labelSuffix || '');
      const structureOk = !recipe.requiresStructure || (me.nearStructures || []).includes(recipe.requiresStructure);
      const questOk = !recipe.requiresQuest || (me.completedQuests || []).includes(recipe.requiresQuest);
      const locked = !questOk;

      const slot = document.createElement('div');
      slot.className = 'itemSlot craftSlot' + (locked ? ' locked' : '');

      const qualities = recipe.qualityCraftable ? QUALITY_TIERS : ['normal'];
      const affordableAny = qualities.some(q => canAffordRecipe(recipe, q));
      if (!locked && structureOk && !affordableAny) slot.classList.add('disabled');

      let note = '';
      if (locked) note = '<div class="lockNote">🔒 quest locked</div>';
      else if (!structureOk) note = `<div class="lockNote">need ${recipe.requiresStructure}</div>`;

      const baseCostStr = Object.entries(recipe.cost).map(([it, amt]) => `${amt} ${getItemInfo(it).icon}`).join(' ');
      slot.innerHTML = `<div>${info.icon}</div><div class="label">${label}</div><div class="cost">${baseCostStr}</div>${note}`;
      slot.title = locked ? 'Complete the related quest to unlock this recipe' : '';

      if (!locked && structureOk && recipe.qualityCraftable) {
        const qRow = document.createElement('div');
        qRow.className = 'qualityRow';
        for (const q of QUALITY_TIERS) {
          const btn = document.createElement('button');
          btn.className = 'qualityBtn';
          btn.style.color = QUALITY_COLOR[q];
          btn.textContent = q === 'normal' ? 'Normal' : QUALITY_PREFIX[q].trim();
          const ok = canAffordRecipe(recipe, q);
          btn.disabled = !ok;
          btn.title = ok ? `Craft ${QUALITY_PREFIX[q]}${label}` : 'Not enough materials at this quality';
          btn.addEventListener('click', (ev) => { ev.stopPropagation(); if (ok) socket.emit('craft', recipe.id, q); });
          qRow.appendChild(btn);
        }
        slot.appendChild(qRow);
      } else if (!locked && structureOk) {
        slot.addEventListener('click', () => { if (canAffordRecipe(recipe, 'normal')) socket.emit('craft', recipe.id); });
      }
      craftingList.appendChild(slot);
    }
  }

  function canAffordRecipe(recipe, quality) {
    const cost = recipeCostForQuality(recipe, quality);
    return Object.entries(cost).every(([it, amt]) => (me.inventory[it] || 0) >= amt);
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
      return quest.progress.entries.map(e => `${e.have}/${e.need} ${getItemInfo(e.item).label}`).join(', ');
    }
    const mobLabel = quest.mobType === 'wolf' ? 'wolves' : quest.mobType;
    return `${quest.progress.done}/${quest.progress.total} ${mobLabel} slain`;
  }

  function showNpcDialogue(data) {
    if (!data.ok) { flashMessage(data.reason || 'cannot talk right now'); return; }
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
