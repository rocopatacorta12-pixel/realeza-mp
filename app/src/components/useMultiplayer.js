import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook de multiplayer.
 *
 * Estados expuestos:
 *   - status: 'disconnected' | 'connecting' | 'idle' | 'inviting' | 'in-game'
 *   - myName, mySocketId
 *   - players: [{name, socketId}]
 *   - incomingInvite: { fromName, fromSocketId } | null
 *   - outgoingInvite: { toName } | null
 *   - game: { color, opponentName, gameId } | null
 *
 * Acciones:
 *   - connect(serverUrl, name)
 *   - disconnect()
 *   - refreshPlayers()
 *   - invite(targetSocketId)
 *   - accept(fromSocketId)
 *   - decline(fromSocketId)
 *   - sendMove(payload)   // envía el evento al rival
 *   - leaveGame()
 *
 * Callback de mensajes del rival: pasar onRemoteMove al construir el hook.
 */
export function useMultiplayer({ onRemoteMove } = {}) {
  const socketRef = useRef(null);
  const onRemoteMoveRef = useRef(onRemoteMove);
  useEffect(() => { onRemoteMoveRef.current = onRemoteMove; }, [onRemoteMove]);

  const [status, setStatus] = useState('disconnected');
  const [myName, setMyName] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [outgoingInvite, setOutgoingInvite] = useState(null);
  const [game, setGame] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);

  const connect = useCallback((serverUrl, name) => {
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch (_) {}
    }
    setStatus('connecting');
    setLastError(null);
    setServerInfo({ url: serverUrl });

    const s = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setMySocketId(s.id);
      s.emit('register', { name });
    });

    s.on('registered', ({ name: finalName, socketId }) => {
      setMyName(finalName);
      setMySocketId(socketId);
      setStatus('idle');
      s.emit('list_players');
    });

    s.on('register_error', ({ reason }) => {
      setLastError(reason || 'Error al registrar');
      setStatus('disconnected');
    });

    s.on('players_update', (list) => setPlayers(list || []));

    s.on('invitation', ({ fromName, fromSocketId }) => {
      setIncomingInvite({ fromName, fromSocketId });
    });

    s.on('invite_sent', ({ toName }) => {
      setOutgoingInvite({ toName });
      setStatus('inviting');
    });

    s.on('invite_declined', ({ byName }) => {
      setOutgoingInvite(null);
      setLastError(`${byName} rechazó la invitación`);
      setStatus('idle');
    });

    s.on('invite_error', ({ reason }) => {
      setOutgoingInvite(null);
      setLastError(reason || 'Error de invitación');
      setStatus('idle');
    });

    s.on('game_start', ({ gameId, color, opponentName }) => {
      setOutgoingInvite(null);
      setIncomingInvite(null);
      setGame({ gameId, color, opponentName });
      setStatus('in-game');
    });

    s.on('move', (payload) => {
      if (onRemoteMoveRef.current) {
        onRemoteMoveRef.current(payload);
      }
    });

    s.on('opponent_left', ({ reason }) => {
      setLastError(reason === 'opponent_disconnected'
        ? 'El rival se desconectó'
        : 'El rival abandonó la partida');
      setGame(null);
      setStatus('idle');
      if (socketRef.current) socketRef.current.emit('list_players');
    });

    s.on('disconnect', () => {
      setStatus('disconnected');
    });

    s.on('connect_error', (err) => {
      setLastError(`No se pudo conectar: ${err.message}`);
      setStatus('disconnected');
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch (_) {}
      socketRef.current = null;
    }
    setStatus('disconnected');
    setGame(null);
    setPlayers([]);
    setIncomingInvite(null);
    setOutgoingInvite(null);
    setMyName(null);
    setMySocketId(null);
  }, []);

  const refreshPlayers = useCallback(() => {
    if (socketRef.current) socketRef.current.emit('list_players');
  }, []);

  const invite = useCallback((targetSocketId) => {
    if (socketRef.current) {
      setLastError(null);
      socketRef.current.emit('invite', { targetSocketId });
    }
  }, []);

  const accept = useCallback((fromSocketId) => {
    if (socketRef.current) {
      socketRef.current.emit('accept', { fromSocketId });
      setIncomingInvite(null);
    }
  }, []);

  const decline = useCallback((fromSocketId) => {
    if (socketRef.current) {
      socketRef.current.emit('decline', { fromSocketId });
      setIncomingInvite(null);
    }
  }, []);

  const sendMove = useCallback((payload) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('move', payload);
    }
  }, []);

  const leaveGame = useCallback(() => {
    if (socketRef.current) socketRef.current.emit('leave_game');
    setGame(null);
    setStatus('idle');
  }, []);

  useEffect(() => () => {
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch (_) {}
    }
  }, []);

  return {
    status, myName, mySocketId, players, incomingInvite, outgoingInvite, game,
    lastError, serverInfo,
    connect, disconnect, refreshPlayers, invite, accept, decline, sendMove, leaveGame,
    sendMoveFn: sendMove,
  };
}
