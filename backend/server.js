require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Allow Express to handle CORS for all routes too
app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST"],
  credentials: true,
}));

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

app.get("/", (req, res) => {
  res.send("CodeArena Backend Running 🚀");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Track users per room: roomId -> Map<socketId, { name, color }>
const rooms = {};

// Deterministic avatar color assigned by join order
const COLORS = [
  "from-cyan-400 to-blue-500",
  "from-pink-400 to-purple-500",
  "from-green-400 to-teal-500",
  "from-yellow-400 to-orange-500",
  "from-red-400 to-pink-500",
  "from-indigo-400 to-purple-500",
];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join room
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} (${userName}) joined room ${roomId}`);

    // Init room tracking
    if (!rooms[roomId]) rooms[roomId] = {};

    // Assign a color based on how many people are already in the room
    const colorIndex = Object.keys(rooms[roomId]).length % COLORS.length;

    rooms[roomId][socket.id] = {
      id: socket.id,
      name: userName || `User-${socket.id.slice(0, 4)}`,
      color: COLORS[colorIndex],
      initial: (userName || "U")[0].toUpperCase(),
    };

    // Send the new user the current participant list
    socket.emit("room-users", Object.values(rooms[roomId]));

    // Notify everyone else in the room that this user joined
    socket.to(roomId).emit("user-joined", rooms[roomId][socket.id]);

    // Store roomId on the socket for cleanup on disconnect
    socket.data.roomId = roomId;
  });

  // Leave room explicitly
  socket.on("leave-room", (roomId) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);

    if (rooms[roomId]) {
      const user = rooms[roomId][socket.id];
      delete rooms[roomId][socket.id];

      if (Object.keys(rooms[roomId]).length === 0) {
        delete rooms[roomId];
      } else {
        socket.to(roomId).emit("user-left", socket.id);
      }
    }
  });

  // Code sync — broadcast to everyone else in the room
  socket.on("code-change", ({ roomId, fileName, code }) => {
    if (!roomId) {
      console.warn("code-change received without roomId, ignoring");
      return;
    }
    if (!fileName) {
      console.warn("code-change received without fileName, ignoring");
      return;
    }
    console.log(`Code change in room ${roomId}, file ${fileName} from ${socket.id}`);
    socket.to(roomId).emit("receive-code", { fileName, code });
  });

  // File created — broadcast new file name + initial content to the room
  socket.on("file-created", ({ roomId, fileName, code }) => {
    if (!roomId || !fileName) return;
    console.log(`File created in room ${roomId}: ${fileName} by ${socket.id}`);
    socket.to(roomId).emit("remote-file-created", { fileName, code });
  });

  // File deleted — broadcast deleted file name to the room
  socket.on("file-deleted", ({ roomId, fileName }) => {
    if (!roomId || !fileName) return;
    console.log(`File deleted in room ${roomId}: ${fileName} by ${socket.id}`);
    socket.to(roomId).emit("remote-file-deleted", { fileName });
  });

  // Handle disconnect — clean up room membership
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      delete rooms[roomId][socket.id];
      if (Object.keys(rooms[roomId]).length === 0) {
        delete rooms[roomId];
      } else {
        socket.to(roomId).emit("user-left", socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
