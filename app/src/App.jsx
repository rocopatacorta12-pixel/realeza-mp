import React, { useEffect, useState } from 'react';
import Realeza, { JugarTab } from './components/Realeza.jsx';
import { useMultiplayer } from './components/useMultiplayer.js';

// === CONFIGURACIÓN ===
// URL del servidor multiplayer. Se persiste en localStorage tras la primera vez.
// Default = el servidor de Railway de Rafa (ya desplegado).
const DEFAULT_SERVER_URL = 'https://realeza-mp-production.up.railway.app';

const COLORS = {
  bg: '#0F1722', card: '#1A2435', cardLight: '#222F44',
  ink: '#E8DCC4', inkMute: '#9BA8B8',
  gold: '#D4AF37', goldDeep: '#8B7332',
  crimson: '#B22234', crimsonDeep: '#7A1820',
  green: '#5FA85F',
};

const STORAGE_KEY_NAME = 'realeza_player_name';
const STORAGE_KEY_SERVER = 'realeza_server_url';

function loadFromStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? v : fallback;
  } catch (_) { return fallback; }
}
function saveToStorage(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

// === MENÚ PRINCIPAL ===
function MainMenu({ onPickIA, onPickOnline }) {
  return (
    <div style={{
      maxWidth: 420, margin: '0 auto', padding: 14,
      display: 'flex', flexDirection: 'column', gap: 14, color: COLORS.ink,
      minHeight: '100vh', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 4,
          color: COLORS.gold, marginBottom: 2,
        }}>UN JUEGO DE 9×9 — V11</div>
        <h1 style={{
          fontFamily: 'Cinzel, serif', fontSize: 44, fontWeight: 700,
          letterSpacing: 8, color: COLORS.ink, margin: 0,
        }}>REALEZA</h1>
      </div>

      <button onClick={onPickIA} style={{
        padding: '16px 18px',
        background: COLORS.gold, color: '#1A1410',
        border: 'none', borderRadius: 8,
        fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: 2,
        fontSize: 16, cursor: 'pointer',
      }}>
        ⚔ JUGAR vs IA
      </button>

      <button onClick={onPickOnline} style={{
        padding: '16px 18px',
        background: 'transparent', color: COLORS.gold,
        border: `2px solid ${COLORS.gold}`, borderRadius: 8,
        fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: 2,
        fontSize: 16, cursor: 'pointer',
      }}>
        🌐 JUGAR ONLINE
      </button>

      <div style={{ textAlign: 'center', fontSize: 10, color: COLORS.inkMute, letterSpacing: 1, marginTop: 12 }}>
        REALEZA · V11 — MULTIPLAYER ESTABLE
      </div>
    </div>
  );
}

// === SETUP MULTIPLAYER (nombre + URL) ===
function OnlineSetup({ onConnect, onCancel, lastError }) {
  const [name, setName] = useState(loadFromStorage(STORAGE_KEY_NAME, ''));
  const [serverUrl, setServerUrl] = useState(loadFromStorage(STORAGE_KEY_SERVER, DEFAULT_SERVER_URL));
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleConnect() {
    const cleanName = name.trim().slice(0, 24);
    if (!cleanName) return;
    saveToStorage(STORAGE_KEY_NAME, cleanName);
    saveToStorage(STORAGE_KEY_SERVER, serverUrl);
    onConnect(serverUrl, cleanName);
  }

  return (
    <div style={{
      maxWidth: 420, margin: '0 auto', padding: 14,
      display: 'flex', flexDirection: 'column', gap: 14, color: COLORS.ink,
      minHeight: '100vh', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif', fontSize: 22, letterSpacing: 3, margin: 0,
          color: COLORS.gold,
        }}>JUGAR ONLINE</h2>
      </div>

      <div style={{
        background: COLORS.card, borderRadius: 10, padding: 14,
        border: `1px solid ${COLORS.goldDeep}66`,
      }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 6 }}>
          NOMBRE DE JUGADOR
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Rafa"
          maxLength={24}
          style={{
            width: '100%', padding: '10px 12px',
            background: COLORS.cardLight, color: COLORS.ink,
            border: `1px solid ${COLORS.goldDeep}88`, borderRadius: 6,
            fontSize: 16, fontFamily: 'inherit', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button onClick={() => setShowAdvanced(v => !v)} style={{
        background: 'transparent', color: COLORS.inkMute,
        border: 'none', textAlign: 'left',
        fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1.2,
        cursor: 'pointer', padding: 0,
      }}>
        {showAdvanced ? '▾' : '▸'} Servidor
      </button>
      {showAdvanced && (
        <div style={{
          background: COLORS.card, borderRadius: 10, padding: 14,
          border: `1px solid ${COLORS.goldDeep}66`,
        }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1.5, color: COLORS.gold, marginBottom: 6 }}>
            URL DEL SERVIDOR
          </div>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://tu-server.up.railway.app"
            style={{
              width: '100%', padding: '10px 12px',
              background: COLORS.cardLight, color: COLORS.ink,
              border: `1px solid ${COLORS.goldDeep}88`, borderRadius: 6,
              fontSize: 13, fontFamily: 'monospace', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 10, color: COLORS.inkMute, marginTop: 6 }}>
            Ambos jugadores deben usar la misma URL.
          </div>
        </div>
      )}

      {lastError && (
        <div style={{
          background: COLORS.crimsonDeep + '33', color: COLORS.crimson,
          padding: '8px 12px', borderRadius: 6, fontSize: 12,
          border: `1px solid ${COLORS.crimson}66`,
        }}>{lastError}</div>
      )}

      <button onClick={handleConnect} disabled={!name.trim()} style={{
        padding: '14px 18px',
        background: name.trim() ? COLORS.gold : COLORS.cardLight,
        color: name.trim() ? '#1A1410' : COLORS.inkMute,
        border: 'none', borderRadius: 8,
        fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: 2,
        fontSize: 15, cursor: name.trim() ? 'pointer' : 'not-allowed',
      }}>
        CONECTAR
      </button>

      <button onClick={onCancel} style={{
        padding: '10px',
        background: 'transparent', color: COLORS.inkMute,
        border: 'none', fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1.5,
        cursor: 'pointer',
      }}>
        ← VOLVER
      </button>
    </div>
  );
}

// === LOBBY ONLINE ===
function Lobby({ mp, onLeave }) {
  const [pendingInviteId, setPendingInviteId] = useState(null);

  useEffect(() => {
    const id = setInterval(() => mp.refreshPlayers(), 4000);
    return () => clearInterval(id);
  }, [mp]);

  function invite(socketId) {
    setPendingInviteId(socketId);
    mp.invite(socketId);
  }

  return (
    <div style={{
      maxWidth: 420, margin: '0 auto', padding: 14,
      display: 'flex', flexDirection: 'column', gap: 14, color: COLORS.ink,
      minHeight: '100vh',
    }}>
      <div style={{
        background: COLORS.card, borderRadius: 10, padding: 12,
        border: `1px solid ${COLORS.goldDeep}66`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1.5, color: COLORS.gold }}>
            CONECTADO COMO
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink }}>{mp.myName}</div>
        </div>
        <button onClick={() => { mp.disconnect(); onLeave(); }} style={{
          background: 'transparent', color: COLORS.crimson,
          border: `1px solid ${COLORS.crimson}88`,
          fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1,
          padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
        }}>DESCONECTAR</button>
      </div>

      {mp.lastError && (
        <div style={{
          background: COLORS.crimsonDeep + '33', color: COLORS.crimson,
          padding: '8px 12px', borderRadius: 6, fontSize: 12,
          border: `1px solid ${COLORS.crimson}66`,
        }}>{mp.lastError}</div>
      )}

      {/* Invitación entrante */}
      {mp.incomingInvite && (
        <div style={{
          background: COLORS.gold + '22', borderRadius: 10, padding: 12,
          border: `2px solid ${COLORS.gold}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontFamily: 'Cinzel, serif', color: COLORS.gold, fontWeight: 600, fontSize: 14, letterSpacing: 1.2 }}>
            ⚔ {mp.incomingInvite.fromName} te invitó a jugar
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => mp.accept(mp.incomingInvite.fromSocketId)} style={{
              flex: 1, padding: '10px',
              background: COLORS.green, color: '#0F1722',
              border: 'none', borderRadius: 6,
              fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: 1.5,
              fontSize: 13, cursor: 'pointer',
            }}>ACEPTAR</button>
            <button onClick={() => mp.decline(mp.incomingInvite.fromSocketId)} style={{
              flex: 1, padding: '10px',
              background: 'transparent', color: COLORS.crimson,
              border: `1px solid ${COLORS.crimson}`, borderRadius: 6,
              fontFamily: 'Cinzel, serif', fontWeight: 600, letterSpacing: 1.5,
              fontSize: 13, cursor: 'pointer',
            }}>RECHAZAR</button>
          </div>
        </div>
      )}

      {/* Invitación saliente pendiente */}
      {mp.outgoingInvite && (
        <div style={{
          background: COLORS.card, borderRadius: 10, padding: 12,
          border: `1px dashed ${COLORS.gold}88`,
        }}>
          <div style={{ fontSize: 12, color: COLORS.inkMute }}>
            Esperando respuesta de <strong style={{ color: COLORS.gold }}>{mp.outgoingInvite.toName}</strong>...
          </div>
        </div>
      )}

      <div style={{
        background: COLORS.card, borderRadius: 10, padding: 12,
        border: `1px solid ${COLORS.goldDeep}66`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1.5, color: COLORS.gold }}>
            JUGADORES ONLINE ({mp.players.length})
          </div>
          <button onClick={() => mp.refreshPlayers()} style={{
            background: 'transparent', color: COLORS.inkMute,
            border: `1px solid ${COLORS.goldDeep}66`, borderRadius: 4,
            fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1,
            padding: '4px 8px', cursor: 'pointer',
          }}>↻ ACTUALIZAR</button>
        </div>

        {mp.players.length === 0 ? (
          <div style={{ fontSize: 12, color: COLORS.inkMute, fontStyle: 'italic', textAlign: 'center', padding: 12 }}>
            Sin jugadores conectados. Esperando que entre alguien…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mp.players.map(p => (
              <div key={p.socketId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px',
                background: COLORS.cardLight, borderRadius: 6,
                border: `1px solid ${COLORS.goldDeep}33`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: COLORS.green, boxShadow: `0 0 6px ${COLORS.green}`,
                  }} />
                  <span style={{ color: COLORS.ink, fontWeight: 600 }}>{p.name}</span>
                </div>
                <button
                  onClick={() => invite(p.socketId)}
                  disabled={!!mp.outgoingInvite || !!mp.incomingInvite}
                  style={{
                    background: COLORS.gold, color: '#1A1410',
                    border: 'none', borderRadius: 4,
                    fontFamily: 'Cinzel, serif', fontWeight: 600, fontSize: 11, letterSpacing: 1,
                    padding: '6px 12px', cursor: (mp.outgoingInvite || mp.incomingInvite) ? 'not-allowed' : 'pointer',
                    opacity: (mp.outgoingInvite || mp.incomingInvite) ? 0.5 : 1,
                  }}>BUSCAR / INVITAR</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: COLORS.inkMute, textAlign: 'center', lineHeight: 1.6 }}>
        Pasale el nombre que pusiste al otro jugador para que sepa a quién invitar.
      </div>
    </div>
  );
}

// === APP PRINCIPAL ===
export default function App() {
  // Modos: 'menu' | 'setup_online' | 'lobby' | 'game_ia' | 'game_mp'
  const [mode, setMode] = useState('menu');

  // v11: el hook gestiona los handlers internamente (setRemoteHandler/setRejectHandler).
  const mp = useMultiplayer();

  // Cuando el server confirma game_start, pasamos al juego
  useEffect(() => {
    if (mp.game && mode !== 'game_mp') setMode('game_mp');
    if (!mp.game && mode === 'game_mp') setMode('lobby');
  }, [mp.game, mode]);

  function handleConnect(serverUrl, name) {
    mp.connect(serverUrl, name);
    setMode('lobby');
  }

  if (mode === 'menu') {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh' }}>
        <MainMenu
          onPickIA={() => setMode('game_ia')}
          onPickOnline={() => setMode('setup_online')}
        />
      </div>
    );
  }

  if (mode === 'setup_online') {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh' }}>
        <OnlineSetup
          onConnect={handleConnect}
          onCancel={() => setMode('menu')}
          lastError={mp.lastError}
        />
      </div>
    );
  }

  if (mode === 'lobby') {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh' }}>
        <Lobby mp={mp} onLeave={() => setMode('menu')} />
      </div>
    );
  }

  if (mode === 'game_mp' && mp.game) {
    const multiplayerProps = {
      game: mp.game,
      serverTurn: mp.serverTurn,
      sendAction: mp.sendAction,
      requestTurnState: mp.requestTurnState,
      leaveGame: () => { mp.leaveGame(); setMode('lobby'); },
      setRemoteHandler: mp.setRemoteHandler,
      setRejectHandler: mp.setRejectHandler,
    };
    return (
      <div style={{
        background: COLORS.bg, minHeight: '100vh', color: COLORS.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: 14,
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <header style={{ textAlign: 'center', marginBottom: 14 }}>
            <h1 style={{
              fontFamily: 'Cinzel, serif', fontSize: 32, fontWeight: 700,
              letterSpacing: 8, color: COLORS.ink, margin: 0,
            }}>REALEZA</h1>
          </header>
          <JugarTab multiplayer={multiplayerProps} />
        </div>
      </div>
    );
  }

  // game_ia: usar el componente Realeza original (con tabs jugar/piezas/reglas)
  if (mode === 'game_ia') {
    return (
      <div style={{ background: COLORS.bg, minHeight: '100vh' }}>
        <div style={{ padding: '10px 14px' }}>
          <button onClick={() => setMode('menu')} style={{
            background: 'transparent', color: COLORS.gold,
            border: `1px solid ${COLORS.gold}88`, borderRadius: 4,
            fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1.5,
            padding: '6px 12px', cursor: 'pointer',
          }}>← MENÚ</button>
        </div>
        <Realeza />
      </div>
    );
  }

  return null;
}
