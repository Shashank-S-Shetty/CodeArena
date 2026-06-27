# ForgeIDE

A real-time collaborative code editor where multiple users can write, run, and share code together in a shared room — live, no refresh needed.

![ForgeIDE](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js) ![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black?style=flat-square&logo=socket.io) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss)

---

## Features

- **Real-time collaboration** — code changes sync instantly across all users in a room via WebSockets
- **Multi-file editor** — create, rename, delete, and switch between files; all changes broadcast to collaborators
- **Code execution** — run code directly in the browser using [Judge0 CE](https://judge0.com/); supports Python, JavaScript, TypeScript, Java, C++, Go, Rust, and more
- **Stdin support** — provide custom input to your programs before running
- **Live participant panel** — see who's in the room with color-coded avatars in real time
- **Room system** — create a new room or join an existing one with a Room ID
- **Invite collaborators** — share a direct link or send an email invite from within the editor
- **Download files** — save any open file to your local machine
- **Dark / Light theme** — toggle between themes, persisted per session
- **State persistence** — tabs, files, and active tab are saved to `localStorage` per room

---

## Tech Stack

### Frontend
| Library | Purpose |
|---|---|
| Next.js 16 (App Router) | React framework & routing |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Styling |
| Monaco Editor (`@monaco-editor/react`) | VS Code-grade code editor |
| Socket.IO Client | Real-time WebSocket communication |
| Lucide React | Icons |

### Backend
| Library | Purpose |
|---|---|
| Node.js + Express 5 | HTTP server |
| Socket.IO 4 | WebSocket server |
| dotenv | Environment variable management |
| nodemon | Dev hot-reload |

---

## Project Structure

```
ForgeIDE/
├── backend/
│   ├── server.js          # Express + Socket.IO server
│   └── package.json
└── frontend/
    ├── app/
    │   ├── dashboard/     # Landing page — create or join a room
    │   └── room/[room]/   # Editor workspace (dynamic route)
    ├── components/
    │   ├── editor/        # Monaco editor with multi-file tabs
    │   ├── collaboration/ # Live participant list
    │   ├── terminal/      # Terminal, Stdin, Output, Problems tabs
    │   ├── navbar/        # Header with Run, Share, Invite, Theme
    │   └── sidebar/       # Sidebar layout wrapper
    └── lib/
        ├── socket.ts      # Socket.IO client singleton
        ├── piston.ts      # Judge0 CE code execution client
        └── ThemeContext.tsx
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Shashank-S-Shetty/CodeArena.git
cd CodeArena
```

### 2. Start the backend

```bash
cd backend
npm install
npm run dev
```

The server starts on **http://localhost:5001**.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The app starts on **http://localhost:3000**.

### 4. Open the app

Navigate to [http://localhost:3000](http://localhost:3000), enter your name, and create or join a room.

---

## Environment Variables

The backend supports a `.env` file for configuration:

```env
PORT=5001
```

---

## How It Works

1. A user visits the dashboard, enters a name, and either creates a room (generates a `CA-XXXX` ID) or joins one with an existing ID.
2. On entering a room, the client connects to the Socket.IO server and joins the room channel.
3. Every keystroke in the editor emits a `code-change` event with the `roomId`, `fileName`, and updated code — all other clients in the room receive and apply the change instantly.
4. File creation and deletion are similarly broadcast to all participants.
5. Clicking **Run** sends the active file's code to Judge0 CE and streams the output to the terminal panel.

---

## Supported Languages

Python, JavaScript, TypeScript, Java, C++, C, C#, Go, Rust, PHP, Ruby, Swift, Kotlin, Bash, R

---

##👨‍💻 Author

**Shashank S Shetty** — [GitHub](https://github.com/Shashank-S-Shetty)
