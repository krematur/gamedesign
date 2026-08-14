const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Game, TICK_MS } = require('./game');

const PORT = process.env.PORT || 3000;
const SEED = process.env.WORLD_SEED ? parseInt(process.env.WORLD_SEED, 10) : 1337;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const game = new Game(SEED);

io.on('connection', (socket) => {
  let joined = false;

  socket.on('join', (data) => {
    if (joined) return;
    joined = true;
    const player = game.addPlayer(socket.id, data && data.name);
    socket.emit('welcome', {
      id: socket.id,
      world: { size: game.world.size, tiles: Array.from(game.world.tiles) },
      you: player,
    });
    socket.broadcast.emit('chat', { system: true, text: `${player.name} joined the world.` });
  });

  socket.on('input', (input) => {
    if (!joined) return;
    game.setInput(socket.id, input || {});
  });

  socket.on('gather', (resourceId) => {
    if (!joined) return;
    const events = game.gather(socket.id, resourceId);
    if (events) socket.emit('events', events);
  });

  socket.on('attack', ({ targetType, targetId } = {}) => {
    if (!joined) return;
    const events = game.attack(socket.id, targetType, targetId);
    if (events) io.emit('events', events);
  });

  socket.on('craft', (itemId) => {
    if (!joined) return;
    const result = game.craft(socket.id, itemId);
    socket.emit('craftResult', result);
  });

  socket.on('equip', (itemId) => {
    if (!joined) return;
    game.equip(socket.id, itemId);
  });

  socket.on('eat', (itemId) => {
    if (!joined) return;
    const result = game.eat(socket.id, itemId);
    socket.emit('eatResult', result);
  });

  socket.on('place', ({ itemId, x, y } = {}) => {
    if (!joined) return;
    const result = game.place(socket.id, itemId, x, y);
    socket.emit('placeResult', result);
  });

  socket.on('chat', (text) => {
    if (!joined || typeof text !== 'string') return;
    const p = game.players.get(socket.id);
    if (!p) return;
    const clean = text.slice(0, 200);
    io.emit('chat', { name: p.name, text: clean });
  });

  socket.on('disconnect', () => {
    const p = game.players.get(socket.id);
    if (p) {
      io.emit('chat', { system: true, text: `${p.name} left the world.` });
    }
    game.removePlayer(socket.id);
  });
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = now - last;
  last = now;
  game.update(dt);

  const snapshot = game.snapshot();
  for (const [id] of game.players) {
    io.to(id).emit('state', snapshot);
    io.to(id).emit('you', game.playerState(id));
  }
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`RPG survival server listening on http://localhost:${PORT}`);
});
