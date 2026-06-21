# Realeza Multiplayer

Juego Realeza V4 — versión multiplayer Android con servidor privado.

## Qué incluye

- **`app/`** — App React + Vite + Capacitor. Es el frontend del juego, listo para compilarse como APK de Android.
- **`server/`** — Servidor Node.js + Socket.IO. Hace de relay para matchmaking y reenvío de movimientos en tiempo real.
- **`.github/workflows/build-apk.yml`** — Workflow de GitHub Actions que compila el APK automáticamente. **No necesitás Android Studio.**

## Cambios respecto a V3

1. **Solución A — Doble Galope**: bloqueado en jinetes creados o promocionados en los últimos 2 turnos. Cada pieza guarda `createdAtTurn`, y la validación se aplica tanto al jugador humano como a la IA.
2. **Solución B — Coronación Anticipada**: solo se puede usar si el Infante está en mitad enemiga del tablero (filas 0–3 para Dorado, 5–8 para Carmesí).
3. **Multiplayer online**: menú principal con nombre de jugador, lobby con lista de jugadores conectados, invitaciones y partidas en tiempo real vía WebSocket.
4. **Modo vs IA**: sigue funcionando igual que V3 con todas las dificultades.

---

## ⚙ Pasos para tener todo andando

Necesitás hacer **dos cosas**: (1) desplegar el servidor, (2) compilar el APK. Después se lo pasás a quien quieras.

### 1. Desplegar el servidor (lo hacés una sola vez)

#### Opción A — Railway (recomendado, gratis con $5 de crédito mensual)

1. Crear cuenta en https://railway.app
2. New Project → Deploy from GitHub repo (o subí el contenido de `server/` como repo nuevo)
3. Railway detecta el `package.json` y arranca automáticamente con `node server.js`
4. En la pestaña "Settings" → "Networking" → "Generate Domain"
5. Te queda algo como `https://realeza-server-production.up.railway.app`. Guardá esa URL.

#### Opción B — Render (también gratis)

1. https://render.com → New → Web Service → Connect repo
2. Runtime: Node, Build Command: `npm install`, Start Command: `node server.js`
3. Render te asigna una URL `https://realeza-server.onrender.com`

#### Opción C — Local en tu PC (solo para tests en red local)

```bash
cd server
npm install
node server.js
```

Servidor en `http://localhost:3001`. Si querés que tu amigo se conecte desde otro celular en la misma red Wi-Fi, usá la IP local de tu PC (`http://192.168.X.X:3001`).

### 2. Compilar el APK con GitHub Actions

1. Crear repo en GitHub y subir todo el contenido de `project/`:

   ```bash
   cd project
   git init
   git add .
   git commit -m "Realeza MP v4"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/realeza-mp.git
   git push -u origin main
   ```

2. En GitHub: pestaña **Actions** → vas a ver el workflow "Build Android APK" corriendo. Tarda 4–6 minutos.

3. Cuando termina, hacé click en el workflow → bajá a "Artifacts" → descargá **`realeza-debug-apk`**. Adentro hay un `app-debug.apk`.

4. **Importante antes de compilar**: editá `app/src/App.jsx` línea ~10:
   ```js
   const DEFAULT_SERVER_URL = 'http://localhost:3001';
   ```
   Cambialo por la URL de tu servidor desplegado (Railway/Render). Hacé commit y push, y se vuelve a compilar el APK con la URL correcta como default.

   (Si no querés recompilar cada vez, la app tiene un toggle "▸ Servidor" en la pantalla de Conectar donde se puede pegar la URL a mano; ahí queda guardada en `localStorage`.)

### 3. Instalar el APK

1. Descargá el `app-debug.apk` (de Actions o del Release de GitHub).
2. Pasalo al celular (WhatsApp, Bluetooth, mail, lo que sea).
3. En Android: tocá el APK → permitir "Instalar de fuentes desconocidas" si lo pide → instalar.
4. Pasale el mismo APK a tu amigo y que haga lo mismo.

### 4. Jugar una partida

1. Los dos abren la app → "JUGAR ONLINE" → ponen un nombre → "CONECTAR"
2. Ven la lista de jugadores conectados. Tocás **BUSCAR / INVITAR** en el nombre del rival.
3. El rival recibe la invitación → ACEPTAR.
4. Empieza la partida: el que invitó es **🟡 Dorado** (juega primero), el que aceptó es **🔴 Carmesí**.
5. Los movimientos se sincronizan en tiempo real.

---

## Compilar APK localmente (alternativa, si no querés usar GitHub Actions)

Requiere: Node 20+, Java JDK 17, Android Studio (con Android SDK 33+).

```bash
cd app
npm install
npm run build
npx cap add android      # solo la primera vez
npx cap sync android
cd android
./gradlew assembleDebug
# El APK queda en android/app/build/outputs/apk/debug/app-debug.apk
```

Para abrir en Android Studio: `npx cap open android`.

---

## Estructura del repo

```
project/
├── app/                              # Frontend (Vite + React + Capacitor)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                   # Menú principal, lobby, wrapper de partida
│   │   └── components/
│   │       ├── Realeza.jsx           # Juego completo (Soluciones A y B + multiplayer)
│   │       └── useMultiplayer.js     # Hook Socket.IO
│   ├── package.json
│   ├── vite.config.js
│   ├── capacitor.config.json
│   └── index.html
│
├── server/                           # Servidor multiplayer
│   ├── server.js                     # Socket.IO relay + matchmaking
│   ├── package.json
│   ├── Procfile                      # Heroku
│   └── railway.json                  # Railway
│
└── .github/workflows/
    └── build-apk.yml                 # GitHub Actions para compilar APK
```

---

## Protocolo de mensajes (referencia técnica)

Cliente → Server:
- `register { name }` — registra al jugador. El server responde con `registered { name, socketId }`.
- `list_players` — solicita lista actualizada.
- `invite { targetSocketId }` — invita a otro jugador.
- `accept { fromSocketId }` / `decline { fromSocketId }`
- `move <payload>` — envía un movimiento. El server lo reenvía al rival con `move <payload>`.
- `leave_game` — abandona la partida.

Tipos de payload de movimiento (clientes son la fuente de verdad, server solo hace relay):
```js
{ kind: 'move', pieceId, toRow, toCol, isAbility?, abilityLabel?, galopePhase? }
{ kind: 'galope_pass' }
{ kind: 'spell', abilityKey, attackerId, victimId, cooldownVal, abilityLabel }
{ kind: 'brote', spawnId, color, row, col }
{ kind: 'promote', pieceId, newType }
```

Server → Cliente:
- `registered { name, socketId }`
- `players_update [{name, socketId}]`
- `invitation { fromName, fromSocketId }`
- `invite_sent { toName }` / `invite_declined { byName }` / `invite_error { reason }`
- `game_start { gameId, color, opponentName }`
- `move <payload>` — reenvío del rival
- `opponent_left { reason }`

---

## Troubleshooting

**No veo a mi amigo en la lista.**
Asegurate de que los dos estén conectados al mismo servidor (misma URL en el toggle "Servidor" al conectar). Si usás Railway/Render, ambos deben usar la URL pública.

**Mi amigo no recibe la invitación.**
El servidor solo lista jugadores "idle" (no en partida). Si tu amigo aparece pero no recibe nada, fijate en la consola del server (Railway/Render: pestaña Logs) si los socket IDs coinciden.

**El APK no se instala.**
Habilitá "Instalar apps desconocidas" en el ajuste de Android para la app desde donde abrís el APK (WhatsApp, navegador, etc.).

**Servidor en Render se "duerme".**
El plan free de Render duerme servicios inactivos. La primera conexión tras un rato puede tardar 30-60 seg. Railway es mejor para evitar esto.

---

V4 — soluciones A y B aplicadas + multiplayer privado vía Socket.IO.
