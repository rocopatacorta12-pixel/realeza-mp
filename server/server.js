// Realeza Multiplayer — Servidor de relay
// Maneja: registro por nombre, lista de jugadores online, invitaciones,
// y reenvío de movimientos entre los dos jugadores de cada partida.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 8000,
});

// Estado en memoria
const players = new Map();   // socketId -> { name, socketId, status: 'idle'|'in-game', gameId?, opponentId? }
const games = new Map();     // gameId -> { goldSocket, crimsonSocket, startedAt }
let gameCounter = 1;

function publicPlayerList(excludeId) {
  return Array.from(players.values())
    .filter(p => p.socketId !== excludeId && p.status === 'idle')
    .map(p => ({ name: p.name, socketId: p.socketId }));
}

function broadcastPlayerList() {
  for (const [sid, p] of players) {
    io.to(sid).emit('players_update', publicPlayerList(sid));
  }
}

function endGame(gameId, reason) {
  const g = games.get(gameId);
  if (!g) return;
  for (const sid of [g.goldSocket, g.crimsonSocket]) {
    const pl = players.get(sid);
    if (pl) {
      pl.status = 'idle';
      delete pl.gameId;
      delete pl.opponentId;
      io.to(sid).emit('opponent_left', { reason });
    }
  }
  games.delete(gameId);
  broadcastPlayerList();
}

app.get('/', (_req, res) => {
  res.json({
    name: 'Realeza Multiplayer Server',
    online: players.size,
    games: games.size,
    uptimeSec: Math.floor(process.uptime()),
  });
});

io.on('connection', (socket) => {
  console.log(`[conn] ${socket.id}`);

  socket.on('register', ({ name }) => {
    const cleanName = String(name || '').trim().slice(0, 24);
    if (!cleanName) {
      socket.emit('register_error', { reason: 'Nombre vacío' });
      return;
    }
    // Permitir mismo nombre desde dispositivos diferentes; agregar sufijo si choca
    const taken = Array.from(players.values()).some(p => p.name === cleanName);
    const finalName = taken ? `${cleanName}#${Math.floor(Math.random() * 900 + 100)}` : cleanName;

    players.set(socket.id, {
      name: finalName,
      socketId: socket.id,
      status: 'idle',
    });

    socket.emit('registered', { name: finalName, socketId: socket.id });
    console.log(`[register] ${finalName} (${socket.id})`);
    broadcastPlayerList();
  });

  socket.on('list_players', () => {
    socket.emit('players_update', publicPlayerList(socket.id));
  });

  socket.on('invite', ({ targetSocketId }) => {
    const from = players.get(socket.id);
    const to = players.get(targetSocketId);
    if (!from || !to) return;
    if (from.status !== 'idle' || to.status !== 'idle') {
      socket.emit('invite_error', { reason: 'Jugador no disponible' });
      return;
    }
    io.to(targetSocketId).emit('invitation', {
      fromName: from.name,
      fromSocketId: socket.id,
    });
    socket.emit('invite_sent', { toName: to.name });
  });

  socket.on('accept', ({ fromSocketId }) => {
    const me = players.get(socket.id);
    const opp = players.get(fromSocketId);
    if (!me || !opp) {
      socket.emit('invite_error', { reason: 'Jugador no encontrado' });
      return;
    }
    if (me.status !== 'idle' || opp.status !== 'idle') {
      socket.emit('invite_error', { reason: 'Alguien ya está en partida' });
      return;
    }

    // Crear partida: asignación ALEATORIA de colores (50/50 entre invitador y aceptador)
    const gameId = `g${gameCounter++}`;
    const oppIsGold = Math.random() < 0.5;
    const goldPlayer    = oppIsGold ? opp : me;
    const crimsonPlayer = oppIsGold ? me  : opp;

    games.set(gameId, {
      goldSocket: goldPlayer.socketId,
      crimsonSocket: crimsonPlayer.socketId,
      startedAt: Date.now(),
    });
    me.status = 'in-game'; me.gameId = gameId; me.opponentId = opp.socketId;
    opp.status = 'in-game'; opp.gameId = gameId; opp.opponentId = me.socketId;

    io.to(goldPlayer.socketId).emit('game_start', {
      gameId, color: 'gold', opponentName: crimsonPlayer.name,
    });
    io.to(crimsonPlayer.socketId).emit('game_start', {
      gameId, color: 'crimson', opponentName: goldPlayer.name,
    });
    console.log(`[game_start] ${gameId}: ${goldPlayer.name}(gold) vs ${crimsonPlayer.name}(crimson) — random assignment`);
    broadcastPlayerList();
  });

  socket.on('decline', ({ fromSocketId }) => {
    const me = players.get(socket.id);
    if (!me) return;
    io.to(fromSocketId).emit('invite_declined', { byName: me.name });
  });

  socket.on('move', (payload) => {
    const me = players.get(socket.id);
    if (!me || me.status !== 'in-game' || !me.opponentId) return;
    io.to(me.opponentId).emit('move', payload);
  });

  socket.on('leave_game', () => {
    const me = players.get(socket.id);
    if (me && me.gameId) endGame(me.gameId, 'opponent_left');
  });

  socket.on('disconnect', () => {
    const me = players.get(socket.id);
    if (me && me.gameId) endGame(me.gameId, 'opponent_disconnected');
    players.delete(socket.id);
    console.log(`[disc] ${socket.id}`);
    broadcastPlayerList();
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Realeza MP server escuchando en :${PORT}`);
});
