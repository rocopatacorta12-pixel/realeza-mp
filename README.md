# Realeza Multiplayer — V11

Juego Realeza versión multiplayer Android con servidor privado.

## Qué incluye

- **`app/`** — App React + Vite + Capacitor. Frontend del juego, listo para compilarse como APK de Android.
- **`server/`** — Servidor Node.js + Socket.IO. Matchmaking + árbitro de turno en tiempo real.
- **`.github/workflows/build-apk.yml`** — Workflow de GitHub Actions que compila el APK automáticamente. **No necesitás Android Studio.**

## Cambios de la V11 (arreglos de multiplayer)

La V11 reescribe cómo se maneja el turno en partidas online para eliminar de raíz los bugs que aparecían al jugar contra otra persona:

1. **Servidor árbitro del turno (lo más importante).** Antes cada celular llevaba su propio contador de turno y descartaba en silencio las jugadas del rival si los contadores se desfasaban en 1 — eso causaba el bug de "un jugador juega solo todo el día y el otro queda congelado". Ahora **el servidor es el único dueño del turno**: lleva `currentTurn` y `turnNumber`, valida cada jugada y se lo confirma a ambos celulares. Es imposible que diverjan.
2. **Bug de habilidad del Jinete arreglado.** Al activar Doble Galope y arrepentirse tocando otra pieza, quedaban estados internos colgados que hacían parecer que las habilidades se "desactivaban". Ahora se limpia todo el estado al cambiar de pieza o cancelar.
3. **Sonidos en online arreglados.** Se desbloquean los mp3 en Android (necesario para que suenen al *recibir* la jugada del rival) y se reintenta si el navegador los bloquea. Antes sonaban de forma aleatoria.
4. **Color determinista.** El que invita es siempre 🟡 Dorado y empieza; el que acepta es 🔴 Carmesí. Antes era aleatorio y causaba inconsistencias de orientación del tablero.
5. **Indicador de turno** visible en partida online ("ES TU TURNO" / "Esperando a…") y re-sincronización automática al volver de segundo plano.

El modo **vs IA** funciona exactamente igual que antes (no se tocó su lógica de turno).

---

## ⚙ Pasos para actualizar a la V11

Como ya tenés todo desplegado, actualizar es: (1) reemplazar el código en GitHub, (2) esperar el APK nuevo, (3) Railway se redespliega solo.

### 1. Reemplazar el código en GitHub

Subí el contenido de esta carpeta al repo `rocopatacorta12-pixel/realeza-mp` reemplazando los archivos. (Ver instrucciones paso a paso con capturas en el chat.)

### 2. Esperar el APK

GitHub Actions compila el APK nuevo automáticamente en cada push. Andá a **Actions → "Build Android APK" → último run → Artifacts → `realeza-debug-apk`**.

### 3. Railway se redespliega solo

Railway detecta el push y redespliega el servidor (`server/`) automáticamente. La URL pública sigue siendo la misma: `https://realeza-mp-production.up.railway.app`.

**Importante:** los dos celulares tienen que tener la V11 instalada. Un celu con V10 y otro con V11 NO son compatibles (el protocolo de red cambió).

---

## Protocolo de mensajes (referencia técnica V11)

Cliente → Server:
- `register { name }` → responde `registered { name, socketId }`
- `list_players`
- `invite { targetSocketId }`
- `accept { fromSocketId }` / `decline { fromSocketId }`
- `action <payload>` — envía una jugada. El server valida el turno; si es válida la reenvía al rival y actualiza el turno. Si llega fuera de turno, responde `action_rejected`.
- `request_turn_state` — pide el estado de turno actual (resync).
- `leave_game`

Payload de jugada (`turnEnds` default true; el 1er Doble Galope usa `turnEnds:false`):
```js
{ kind: 'move', pieceId, toRow, toCol, isAbility?, abilityLabel?, galopePhase?, turnEnds? }
{ kind: 'galope_pass' }
{ kind: 'spell', abilityKey, attackerId, victimId, cooldownVal, abilityLabel }
{ kind: 'brote', spawnId, color, row, col }
{ kind: 'promote', pieceId, newType }
```

Server → Cliente:
- `registered { name, socketId }`
- `players_update [{name, socketId}]`
- `invitation { fromName, fromSocketId }`
- `invite_sent` / `invite_declined` / `invite_error`
- `game_start { gameId, color, opponentName }`
- `action <payload>` — reenvío de la jugada del rival, con `_tn` (sello de turno del server)
- `turn_state { currentTurn, turnNumber }` — turno autoritativo, tras cada jugada
- `action_rejected { reason, currentTurn, turnNumber }` — la jugada propia llegó fuera de turno
- `opponent_left { reason }`

---

## Estructura del repo

```
realeza-mp/
├── app/                              # Frontend (Vite + React + Capacitor)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                   # Menú, lobby, wrapper de partida
│   │   └── components/
│   │       ├── Realeza.jsx           # Juego completo + multiplayer V11
│   │       └── useMultiplayer.js     # Hook Socket.IO (turno autoritativo)
│   ├── public/sounds/                # 17 efectos de sonido (.mp3)
│   ├── package.json
│   ├── vite.config.js
│   ├── capacitor.config.json
│   └── index.html
│
├── server/                           # Servidor multiplayer
│   ├── server.js                     # Socket.IO relay + árbitro de turno
│   ├── package.json
│   ├── Procfile
│   └── railway.json
│
└── .github/workflows/
    └── build-apk.yml                 # GitHub Actions para compilar APK
```

---

## Troubleshooting

**Un celu no ve al otro en la lista.** Los dos tienen que estar en el mismo servidor (misma URL). La V11 ya trae la URL de Railway como default.

**Se buguea el turno / un jugador no puede mover.** En la V11 esto no debería pasar nunca. Si pasa, cerrá y reabrí la app: al volver pide el estado de turno al servidor y se resincroniza. Verificá también que AMBOS tengan la V11 (no mezclar con V10).

**El APK no se instala.** Habilitá "Instalar apps desconocidas" para la app desde donde abrís el APK. Puede que tengas que pausar Play Protect.

---

V11 — multiplayer estable con turno autoritativo del servidor.
