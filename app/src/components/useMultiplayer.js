import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook de multiplayer — v11.
 *
 * NOVEDAD v11: el TURNO es autoritativo del servidor.
 *   - El servidor lleva currentTurn/turnNumber y los confirma vía 'turn_state'.
 *   - El cliente NO decide el turno por su cuenta; lo lee de serverTurn.
 *   - sendAction() envia la accion al servidor (evento 'action'); el servidor
 *     valida turno, sella _tn y reenvia al rival.
 *   - Si el servidor rechaza ('action_rejected'), el hook resincroniza.
 *
 * Estados expuestos:
 *   - status, myName, mySocketId, players, incomingInvite, outgoingInvite, game
 *   - serverTurn: { currentTurn, turnNumber } | null  (autoritativo)
 *   - lastError, serverInfo
 *
 * Acciones:
 *   - connect, disconnect, refreshPlayers, invite, accept, decline
 *   - sendAction(payload)     // envia accion de juego al servidor
 *   - requestTurnState()      // pide resync del turno
 *   - leaveGame()
 *   - setRemoteHandler(fn)    // callback para acciones del rival
 *   - setRejectHandler(fn)    // callback cuando el server rechaza una accion propia
 */
export function useMultiplayer() {
  const socketRef = useRef(null);
  const remoteHandlerRef = useRef(() => {});
  const rejectHandlerRef = useRef(() => {});

  const [status, setStatus] = useState('disconnected');
  const [myName, setMyName] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [outgoingInvite, setOutgoingInvite] = useState(null);
  const [game, setGame] = useState(null);
  const [serverTurn, setServerTurn] = useState(null);
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
      reconnectionAttempts: 10,
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
      setLastError(`${byName} rechazo la invitacion`);
      setStatus('idle');
    });

    s.on('invite_error', ({ reason }) => {
      setOutgoingInvite(null);
      setLastError(reason || 'Error de invitacion');
      setStatus('idle');
    });

    s.on('game_start', ({ gameId, color, opponentName }) => {
      setOutgoingInvite(null);
      setIncomingInvite(null);
      setGame({ gameId, color, opponentName });
      // gold arranca; turnNumber 0 (lo confirmara el servidor igual).
      setServerTurn({ currentTurn: 'gold', turnNumber: 0 });
      setStatus('in-game');
    });

    // Accion del rival (ya validada y sellada por el servidor).
    s.on('action', (payload) => {
      remoteHandlerRef.current(payload);
    });

    // Estado de turno autoritativo (tras cada accion o tras request).
    s.on('turn_state', (ts) => {
      if (ts && typeof ts.currentTurn === 'string') {
        setServerTurn({ currentTurn: ts.currentTurn, turnNumber: ts.turnNumber });
      }
    });

    // El servidor rechazo una accion propia (llego fuera de turno).
    s.on('action_rejected', (info) => {
      if (info && typeof info.currentTurn === 'string') {
        setServerTurn({ currentTurn: info.currentTurn, turnNumber: info.turnNumber });
      }
      rejectHandlerRef.current(info);
    });

    s.on('opponent_left', ({ reason }) => {
      setLastError(reason === 'opponent_disconnected'
        ? 'El rival se desconecto'
        : 'El rival abandono la partida');
      setGame(null);
      setServerTurn(null);
      setStatus('idle');
      if (socketRef.current) socketRef.current.emit('list_players');
    });

    s.on('disconnect', () => {
      setStatus('disconnected');
    });

    // Al reconectar, re-registrar y pedir el estado de turno para resync.
    s.on('reconnect', () => {
      s.emit('register', { name });
      s.emit('request_turn_state');
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
    setServerTurn(null);
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

  const sendAction = useCallback((payload) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('action', payload);
    }
  }, []);

  const requestTurnState = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('request_turn_state');
    }
  }, []);

  const leaveGame = useCallback(() => {
    if (socketRef.current) socketRef.current.emit('leave_game');
    setGame(null);
    setServerTurn(null);
    setStatus('idle');
  }, []);

  const setRemoteHandler = useCallback((fn) => {
    remoteHandlerRef.current = typeof fn === 'function' ? fn : (() => {});
  }, []);
  const setRejectHandler = useCallback((fn) => {
    rejectHandlerRef.current = typeof fn === 'function' ? fn : (() => {});
  }, []);

  useEffect(() => () => {
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch (_) {}
    }
  }, []);

  return {
    status, myName, mySocketId, players, incomingInvite, outgoingInvite, game,
    serverTurn, lastError, serverInfo,
    connect, disconnect, refreshPlayers, invite, accept, decline,
    sendAction, requestTurnState, leaveGame,
    setRemoteHandler, setRejectHandler,
  };
}
