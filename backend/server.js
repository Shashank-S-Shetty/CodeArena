require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const JUDGE0_URL = process.env.JUDGE0_URL || "https://ce.judge0.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || null;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST"],
  credentials: true,
}));
app.use(express.json({ limit: "256kb" }));

// ─── Rate limiter for code execution ─────────────────────────────────────────
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 10,                   // 10 executions per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many execution requests. Please wait a moment." },
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.send("ForgeIDE Backend Running 🚀"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// ─── Execute endpoint (proxies Judge0 — keeps API key server-side) ───────────

app.post("/execute", executeLimiter, async (req, res) => {
  const { source_code, language_id, stdin } = req.body;

  if (!source_code || !language_id) {
    return res.status(400).json({ error: "source_code and language_id are required" });
  }

  try {
    const headers = { "Content-Type": "application/json" };
    if (JUDGE0_API_KEY) {
      headers["X-Auth-Token"] = JUDGE0_API_KEY;
    }

    const response = await fetch(
      `${JUDGE0_URL}/submissions?wait=true&base64_encoded=false`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ source_code, language_id, stdin: stdin || "" }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Judge0 error:", response.status, text);
      return res.status(502).json({ error: `Judge0 returned ${response.status}` });
    }

    const result = await response.json();
    return res.json(result);
  } catch (err) {
    console.error("Execute proxy error:", err);
    return res.status(500).json({ error: "Execution service unavailable" });
  }
});

// ─── Socket.IO setup ──────────────────────────────────────────────────────────

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

// ─── Redis adapter (optional — gracefully degrades if REDIS_URL not set) ──────

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  const { createClient } = require("redis");
  const { createAdapter } = require("@socket.io/redis-adapter");

  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log("Socket.IO Redis adapter connected");
    })
    .catch((err) => {
      console.warn("Redis connection failed, running without adapter:", err.message);
    });
} else {
  console.log("REDIS_URL not set — running single-instance mode (no Redis adapter)");
}

// ─── In-memory room state ─────────────────────────────────────────────────────

const rooms = {};

const COLORS = [
  "from-cyan-400 to-blue-500",
  "from-pink-400 to-purple-500",
  "from-green-400 to-teal-500",
  "from-yellow-400 to-orange-500",
  "from-red-400 to-pink-500",
  "from-indigo-400 to-purple-500",
];

// Per-socket event throttle tracker (simple in-memory)
const socketThrottle = new Map();

function isThrottled(socketId, event, limitMs = 50) {
  const key = `${socketId}:${event}`;
  const last = socketThrottle.get(key) || 0;
  const now = Date.now();
  if (now - last < limitMs) return true;
  socketThrottle.set(key, now);
  return false;
}

// ─── Yjs document state per room per file ─────────────────────────────────────
// Maps roomId -> fileName -> Uint8Array (serialized Yjs state vector)
const yjsStates = {};

// ─── Socket events ────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, userName }) => {
    if (!roomId || typeof roomId !== "string") return;

    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = {};

    const existing = Object.values(rooms[roomId]).find((u) => u.id === socket.id);
    if (existing) {
      // Name update — don't reassign color
      existing.name = userName || existing.name;
      existing.initial = (userName || existing.name)[0].toUpperCase();
      socket.emit("room-users", Object.values(rooms[roomId]));
      socket.to(roomId).emit("user-joined", existing);
    } else {
      const colorIndex = Object.keys(rooms[roomId]).length % COLORS.length;
      rooms[roomId][socket.id] = {
        id: socket.id,
        name: userName || `User-${socket.id.slice(0, 4)}`,
        color: COLORS[colorIndex],
        initial: (userName || "U")[0].toUpperCase(),
      };
      socket.emit("room-users", Object.values(rooms[roomId]));
      socket.to(roomId).emit("user-joined", rooms[roomId][socket.id]);
    }

    socket.data.roomId = roomId;
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    if (rooms[roomId]) {
      delete rooms[roomId][socket.id];
      if (Object.keys(rooms[roomId]).length === 0) {
        delete rooms[roomId];
        delete yjsStates[roomId];
      } else {
        socket.to(roomId).emit("user-left", socket.id);
      }
    }
  });

  // ── Yjs CRDT sync ─────────────────────────────────────────────────────────

  // Client requests the current Yjs state for a file when it first opens it
  socket.on("yjs-sync-request", ({ roomId, fileName }) => {
    if (!roomId || !fileName) return;
    const state = yjsStates[roomId]?.[fileName];
    if (state) {
      socket.emit("yjs-sync-response", { fileName, state: Array.from(state) });
    }
  });

  // Client sends a Yjs update (delta, not full doc) — relay to room and persist
  socket.on("yjs-update", ({ roomId, fileName, update }) => {
    if (!roomId || !fileName || !update) return;
    if (isThrottled(socket.id, `yjs-update:${fileName}`, 30)) return;

    // Persist update by merging into stored state
    if (!yjsStates[roomId]) yjsStates[roomId] = {};

    // Store raw update array for relay; merge happens on client via Yjs
    if (!yjsStates[roomId][fileName]) {
      yjsStates[roomId][fileName] = update;
    } else {
      // Keep latest update — clients handle merging via Yjs awareness
      yjsStates[roomId][fileName] = update;
    }

    socket.to(roomId).emit("yjs-update", { fileName, update });
  });

  // ── Legacy code-change (kept for non-Yjs fallback) ───────────────────────

  socket.on("code-change", ({ roomId, fileName, code }) => {
    if (!roomId || !fileName) return;
    if (isThrottled(socket.id, "code-change", 50)) return;
    socket.to(roomId).emit("receive-code", { fileName, code });
  });

  socket.on("file-created", ({ roomId, fileName, code }) => {
    if (!roomId || !fileName) return;
    socket.to(roomId).emit("remote-file-created", { fileName, code });
  });

  socket.on("file-deleted", ({ roomId, fileName }) => {
    if (!roomId || !fileName) return;
    if (yjsStates[roomId]) delete yjsStates[roomId][fileName];
    socket.to(roomId).emit("remote-file-deleted", { fileName });
  });

  socket.on("run-output", ({ roomId, lines }) => {
    if (!roomId || !lines) return;
    socket.to(roomId).emit("receive-output", { lines });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    socketThrottle.forEach((_, key) => {
      if (key.startsWith(socket.id)) socketThrottle.delete(key);
    });
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      delete rooms[roomId][socket.id];
      if (Object.keys(rooms[roomId]).length === 0) {
        delete rooms[roomId];
        delete yjsStates[roomId];
      } else {
        socket.to(roomId).emit("user-left", socket.id);
      }
    }
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
