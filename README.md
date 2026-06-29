# ForgeIDE

A production-grade real-time collaborative code editor. Multiple users write, run, and share code together in a shared room — live, with no refresh needed.

![ForgeIDE](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black?style=flat-square&logo=socket.io) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss) ![Redis](https://img.shields.io/badge/Redis-Upstash-red?style=flat-square&logo=redis)

---

## Features

- **Real-time collaboration** — code changes sync instantly across all users via WebSockets
- **Multi-file editor** — create, delete, and switch between files; all operations broadcast to collaborators
- **Code execution** — run code via a secure backend proxy to Judge0 CE; supports 15+ languages
- **Stdin support** — provide custom input to your programs before running
- **Live output sync** — run output is broadcast to all participants in the room simultaneously
- **Live participant panel** — see who's in the room with color-coded avatars in real time
- **Room system** — create a room (generates a `FI-XXXX` ID) or join an existing one
- **Invite collaborators** — share a direct link or send an email invite from within the editor
- **Inline name editing** — change your display name from the navbar without leaving the room
- **Download files** — save any open file to your local machine
- **Dark / Light theme** — toggle between themes, persisted per session
- **State persistence** — tabs, files, and active tab saved to `localStorage` per room
- **Mobile responsive** — full mobile UI with tab switching and collapsible terminal
- **Rate limiting** — 10 code executions per IP per minute
- **Redis adapter** — Socket.IO scales horizontally across multiple backend instances

---

## Tech Stack

### Frontend
| Library | Version | Purpose |
|---|---|---|
| Next.js (App Router) | 16 | React framework & routing |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling |
| Monaco Editor | 4.7 | VS Code-grade code editor |
| Socket.IO Client | 4.8 | Real-time WebSocket communication |
| Lucide React | 1.16 | Icons |

### Backend
| Library | Version | Purpose |
|---|---|---|
| Node.js + Express | 5 | HTTP server |
| Socket.IO | 4.8 | WebSocket server |
| @socket.io/redis-adapter | 8.3 | Horizontal scaling via Redis |
| ioredis / redis | 4/5 | Redis client |
| express-rate-limit | 7.4 | Execution endpoint rate limiting |
| dotenv | 17 | Environment variable management |

### Infrastructure
| Service | Purpose |
|---|---|
| Railway | Hosts frontend and backend services |
| Upstash Redis | Socket.IO adapter for multi-instance scaling |
| Judge0 CE | Sandboxed code execution API |
| GitHub | Source control + auto-deploy trigger |

---

## System Design

```mermaid
flowchart TB
    subgraph Client["Client Browser (Next.js 16)"]
        direction TB
        Dashboard["Dashboard Page\nCreate / Join Room\nGenerates FI-XXXX ID"]
        RoomPage["Room Page\nOrchestrates all state\nuserName · outputLines · stdin"]
        Navbar["Navbar\nRun · Share · Invite\nTheme · Edit Name"]
        EditorPanel["EditorPanel Monaco\nMulti-file tabs\nlocalStorage persistence\nEmits code-change"]
        CollabPanel["CollaborationPanel\nLive participant list\nroom-users · user-joined\nuser-left"]
        TerminalPanel["TerminalPanel\nTerminal · Stdin\nOutput · Problems"]
        SocketClient["socket.ts\nSocket.IO Client\npolling → websocket\nwithCredentials"]
    end

    subgraph Backend["Backend (Node.js + Express + Socket.IO)"]
        direction TB
        HTTP["Express HTTP\nGET /health\nPOST /execute\nRate limit: 10 req/min/IP"]
        SocketServer["Socket.IO Server\nIn-memory rooms\nSocket throttle 50ms\nCORS from FRONTEND_URL"]
        subgraph Events["Socket Events"]
            direction LR
            E1["join-room · leave-room"]
            E2["code-change · receive-code"]
            E3["file-created · remote-file-created"]
            E4["file-deleted · remote-file-deleted"]
            E5["run-output · receive-output"]
        end
    end

    subgraph Infra["Infrastructure"]
        Redis["Upstash Redis\nSocket.IO adapter\nHorizontal scaling"]
        Judge0["Judge0 CE API\nce.judge0.com\nSandboxed execution\n15+ languages"]
        Railway["Railway\nFrontend service\nBackend service\nAuto-deploy on push"]
        GitHub["GitHub\nShashank-S-Shetty/ForgeIDE"]
    end

    subgraph Storage["Client-Side Storage"]
        LS["localStorage\nforgeid-username\nforgeid-tabs-roomId\nforgeid-files-roomId\nforgeid-active-tab-roomId\nforgeid-theme"]
    end

    Dashboard -->|"router.push /room/FI-XXXX"| RoomPage
    RoomPage --> Navbar & EditorPanel & CollabPanel & TerminalPanel
    RoomPage <-->|"EditorRef.getActiveFile"| EditorPanel

    EditorPanel <-->|"emit code-change\non receive-code"| SocketClient
    CollabPanel <-->|"on room-users\nuser-joined · user-left"| SocketClient
    RoomPage <-->|"emit run-output\non receive-output"| SocketClient

    SocketClient <-->|"HTTPS WebSocket"| SocketServer
    HTTP --- SocketServer
    SocketServer --- Events
    SocketServer <-->|"pub/sub"| Redis

    RoomPage -->|"POST /execute"| HTTP
    HTTP -->|"POST /submissions"| Judge0
    Judge0 -->|"stdout · stderr · exitCode"| HTTP

    GitHub -->|"git push → auto deploy"| Railway
    Railway -->|"serves"| Client
    Railway -->|"runs"| Backend

    EditorPanel <-->|"read/write"| LS
    RoomPage <-->|"read/write"| LS
```

---

## Project Structure

```
ForgeIDE/
├── backend/
│   ├── server.js              # Express + Socket.IO + /execute proxy
│   └── package.json
└── frontend/
    ├── app/
    │   ├── dashboard/         # Landing — create or join a room
    │   └── room/[room]/       # Editor workspace (dynamic route)
    ├── components/
    │   ├── editor/            # Monaco editor with multi-file tabs
    │   ├── collaboration/     # Live participant list
    │   ├── terminal/          # Terminal, Stdin, Output, Problems tabs
    │   ├── navbar/            # Header with Run, Share, Invite, Theme, Edit Name
    │   └── sidebar/           # Sidebar layout wrapper
    ├── lib/
    │   ├── socket.ts          # Socket.IO client singleton
    │   ├── piston.ts          # Execution client → backend proxy
    │   └── ThemeContext.tsx
    └── public/
        ├── logo-dark.svg      # Dark theme keyboard logo
        └── logo-light.svg     # Light theme keyboard logo
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Shashank-S-Shetty/ForgeIDE.git
cd ForgeIDE
```

### 2. Start the backend

```bash
cd backend
npm install
npm run dev
```

Server starts on **http://localhost:5001**.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

App starts on **http://localhost:3000**.

---

## Environment Variables

### Backend `.env`

```env
PORT=5001
FRONTEND_URL=http://localhost:3000
REDIS_URL=rediss://default:password@host:6379   # optional — Upstash Redis
JUDGE0_URL=https://ce.judge0.com                # optional — defaults to free endpoint
JUDGE0_API_KEY=your_key_here                    # optional — for paid Judge0 tier
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5001
```

---

## Deployment (Railway)

### Services
- **Backend** — Root directory: `backend`, start command: `npm start`
- **Frontend** — Root directory: `frontend`, start command: `npm start`

### Backend environment variables on Railway
| Key | Value |
|---|---|
| `FRONTEND_URL` | `https://your-frontend.up.railway.app` |
| `REDIS_URL` | Your Upstash Redis URL (`rediss://...`) |

### Frontend environment variables on Railway
| Key | Value |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend.up.railway.app` |

Railway auto-deploys on every push to `main`.

---

## Supported Languages

Python, JavaScript, TypeScript, Java, C++, C, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, Bash, R

---

## Architecture Notes

- **Code execution is proxied through the backend** — the browser never calls Judge0 directly, keeping API credentials server-side
- **Rate limiting** — 10 executions per IP per minute on `/execute`
- **Socket.IO Redis adapter** — when `REDIS_URL` is set, room events are shared across multiple backend instances via Redis pub/sub, enabling horizontal scaling
- **Graceful degradation** — Redis is optional; without it the server runs in single-instance mode with in-memory room state
- **Real-time sync** — last-write-wins per file with 50ms server-side throttle per socket

---

## Author

**Shashank S Shetty** — [GitHub](https://github.com/Shashank-S-Shetty)
