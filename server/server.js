// Realeza Multiplayer — Servidor de relay v11
// Cambios clave respecto a v10:
//  - El SERVIDOR es ahora el árbitro del turno (server-authoritative).
//    Lleva currentTurn ('gold'|'crimson') y turnNumber por partida.
//    Antes cada celular llevaba su propio contador y, al desfasarse en 1,
//    descartaba en silencio todas las jugadas del rival → un jugador quedaba
//    "jugando solo" para siempre. Ahora el servidor decide de quién es el turno
//    y se lo confirma a AMBOS, por lo que ya no pueden divergir.
//  - Cada accion de juego ('action') se valida contra el color del emisor y el
//    turno vigente. Si no corresponde, se rebota al emisor con 'action_rejected'
//    + un snapshot del turno correcto, para que se re-sincronice solo.
//  - El servidor incrementa turnNumber salvo en sub-fases que NO terminan turno
//    (1er movimiento de Doble Galope), determinadas por el flag turnEnds del cliente.

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
const players = new Map();   // socketId -> { name, socketId, status, gameId?, opponentId? }
const games = new Map();     // gameId -> { goldSocket, crimsonSocket, startedAt, currentTurn, turnNumber }
let gameCounter = 1;

function publicPlayerList(excludeId) {
  return Array.from(players.values())
    .filter(p => p.socketId !== excludeId && p.status === 'idle')
    .map(p => ({ name: p.name, socketId: p.socketId }));
}

function broadcastPlayerList() {
  for (const [sid] of players) {
    io.to(sid).emit('players_update', publicPlayerList(sid));
  }
}

function colorOf(game, socketId) {
  if (game.goldSocket === socketId) return 'gold';
  if (game.crimsonSocket === socketId) return 'crimson';
  return null;
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
    version: 11,
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
      socket.emit('register_error', { reason: 'Nombre vacio' });
      return;
    }
    const taken = Array.from(players.values()).some(p => p.name === cleanName);
    const finalName = taken ? `${cleanName}#${Math.floor(Math.random() * 900 + 100)}` : cleanName;

    players.set(socket.id, { name: finalName, socketId: socket.id, status: 'idle' });
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
    io.to(targetSocketId).emit('invitation', { fromName: from.name, fromSocketId: socket.id });
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
      socket.emit('invite_error', { reason: 'Alguien ya esta en partida' });
      return;
    }

    // Asignacion de colores DETERMINISTA: el INVITADOR (opp/fromSocketId) juega
    // Dorado y empieza moviendo. Antes era aleatoria (Math.random) y era una
    // fuente del problema de orientacion/flip del tablero.
    const gameId = `g${gameCounter++}`;
    const goldPlayer = opp;     // el que invito
    const crimsonPlayer = me;   // el que acepto

    games.set(gameId, {
      goldSocket: goldPlayer.socketId,
      crimsonSocket: crimsonPlayer.socketId,
      startedAt: Date.now(),
      currentTurn: 'gold',   // gold siempre arranca
      turnNumber: 0,
    });
    me.status = 'in-game'; me.gameId = gameId; me.opponentId = opp.socketId;
    opp.status = 'in-game'; opp.gameId = gameId; opp.opponentId = me.socketId;

    io.to(goldPlayer.socketId).emit('game_start', {
      gameId, color: 'gold', opponentName: crimsonPlayer.name,
    });
    io.to(crimsonPlayer.socketId).emit('game_start', {
      gameId, color: 'crimson', opponentName: goldPlayer.name,
    });
    console.log(`[game_start] ${gameId}: ${goldPlayer.name}(gold) vs ${crimsonPlayer.name}(crimson)`);
    broadcastPlayerList();
  });

  socket.on('decline', ({ fromSocketId }) => {
    const me = players.get(socket.id);
    if (!me) return;
    io.to(fromSocketId).emit('invite_declined', { byName: me.name });
  });

  // === ACCION DE JUEGO (movimiento o habilidad) — VALIDADA POR EL SERVIDOR ===
  socket.on('action', (payload) => {
    const me = players.get(socket.id);
    if (!me || me.status !== 'in-game' || !me.gameId) return;
    const g = games.get(me.gameId);
    if (!g) return;

    const myColor = colorOf(g, socket.id);
    if (!myColor) return;

    // Validacion de turno (autoritativa). Si llega fuera de turno, se rebota
    // al emisor con el estado correcto para que corrija sin romperse.
    if (myColor !== g.currentTurn) {
      socket.emit('action_rejected', {
        reason: 'no_es_tu_turno',
        currentTurn: g.currentTurn,
        turnNumber: g.turnNumber,
      });
      return;
    }

    // Sello de turno autoritativo que viaja con la accion.
    const stampedTurnNumber = g.turnNumber;

    // Esta accion termina el turno? El cliente lo indica con turnEnds.
    // (El 1er movimiento de Doble Galope NO termina turno → turnEnds:false.)
    const turnEnds = payload && payload.turnEnds !== false; // default true

    if (turnEnds) {
      g.currentTurn = (g.currentTurn === 'gold') ? 'crimson' : 'gold';
      g.turnNumber += 1;
    }

    // Reenviar al rival con el sello autoritativo del servidor.
    io.to(me.opponentId).emit('action', { ...payload, _tn: stampedTurnNumber });

    // Confirmar a AMBOS el estado de turno resultante (sincronizacion dura).
    const turnState = { currentTurn: g.currentTurn, turnNumber: g.turnNumber };
    io.to(g.goldSocket).emit('turn_state', turnState);
    io.to(g.crimsonSocket).emit('turn_state', turnState);
  });

  // El cliente puede pedir el estado de turno actual para re-sincronizarse
  // (al volver de background, tras reconexion, o por seguridad).
  socket.on('request_turn_state', () => {
    const me = players.get(socket.id);
    if (!me || !me.gameId) return;
    const g = games.get(me.gameId);
    if (!g) return;
    socket.emit('turn_state', { currentTurn: g.currentTurn, turnNumber: g.turnNumber });
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
  console.log(`Realeza MP server v11 escuchando en :${PORT}`);
});
