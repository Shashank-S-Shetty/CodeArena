"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { useTheme } from "@/lib/ThemeContext";
import { executeCode } from "@/lib/piston";
import Navbar from "@/components/navbar/Navbar";
import EditorPanel from "@/components/editor/EditorPanel";
import CollaborationPanel from "@/components/collaboration/CollaborationPanel";
import TerminalPanel, { TerminalLine } from "@/components/terminal/TerminalPanel";
import { Users, Code2, ChevronUp, ChevronDown } from "lucide-react";

export interface EditorRef {
  getActiveFile: () => { fileName: string; code: string };
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();

  const roomId =
    typeof params.room === "string"
      ? params.room
      : Array.isArray(params.room)
      ? params.room[0]
      : "";

  const isValidRoomId = /^FI-[A-Z0-9]{4}$/i.test(roomId);

  const [userName, setUserName] = useState("Anonymous");
  const [outputLines, setOutputLines] = useState<TerminalLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const [mobileTab, setMobileTab] = useState<"editor" | "users">("editor");
  const [terminalOpen, setTerminalOpen] = useState(true);

  const editorRef = useRef<EditorRef | null>(null);
  // Keep a ref so handleNameChange can always access the latest roomId without stale closure
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  useEffect(() => {
    const saved = localStorage.getItem("forgeid-username");
    if (saved) setUserName(saved);
  }, []);

  useEffect(() => {
    if (roomId && !isValidRoomId) {
      alert(`Invalid room ID: ${roomId}\n\nRoom IDs must be in the format FI-XXXX (e.g., FI-A3F9)`);
      router.push("/dashboard");
    }
  }, [roomId, isValidRoomId, router]);

  useEffect(() => {
    if (!roomId || !isValidRoomId) return;

    const joinRoom = () => {
      const name = localStorage.getItem("forgeid-username") || "Anonymous";
      socket.emit("join-room", { roomId, userName: name });
    };

    if (!socket.connected) {
      socket.connect();
    }

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on("connect", joinRoom);
    }

    const handleRemoteOutput = ({ lines }: { lines: TerminalLine[] }) => {
      setOutputLines(lines);
      setTerminalOpen(true);
    };
    socket.on("receive-output", handleRemoteOutput);

    return () => {
      socket.off("connect", joinRoom);
      socket.off("receive-output", handleRemoteOutput);
      socket.disconnect();
    };
  }, [roomId, isValidRoomId]);

  const handleRun = async () => {
    if (!editorRef.current || isRunning) return;

    const { fileName, code } = editorRef.current.getActiveFile();

    if (!code.trim()) {
      setOutputLines([{ type: "error", text: "Error: No code to execute." }]);
      setTerminalOpen(true);
      return;
    }

    setIsRunning(true);
    setTerminalOpen(true);
    setOutputLines([{ type: "info", text: `▶ Running ${fileName}...` }]);

    try {
      const result = await executeCode(fileName, code, stdin);

      const lines: TerminalLine[] = [{ type: "info", text: `▶ Executed ${fileName}` }];
      if (result.output) lines.push({ type: "output", text: result.output.trim() });
      if (result.error) lines.push({ type: "error", text: result.error.trim() });
      lines.push({
        type: result.exitCode === 0 ? "success" : "error",
        text: result.exitCode === 0 ? "✓ Process exited with code 0" : `✗ Process exited with code ${result.exitCode}`,
      });

      setOutputLines(lines);
      socket.emit("run-output", { roomId, lines });
    } catch (err: unknown) {
      setOutputLines([{ type: "error", text: `Execution failed: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleNameChange = (newName: string) => {
    setUserName(newName);
    localStorage.setItem("forgeid-username", newName);
    // Emit directly — no reconnect needed, server will update the participant entry
    if (socket.connected) {
      socket.emit("join-room", { roomId: roomIdRef.current, userName: newName });
    }
  };

  const handleTerminalCommand = async (
    command: string,
    addLines: (lines: TerminalLine[]) => void,
    terminalStdin: string
  ) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    const runPatterns = [
      { regex: /^python3?\s+(\S+)/ },
      { regex: /^node\s+(\S+)/ },
      { regex: /^ts-node\s+(\S+)/ },
      { regex: /^java\s+(\S+)/ },
    ];

    let fileName: string | null = null;
    for (const { regex } of runPatterns) {
      const match = trimmed.match(regex);
      if (match) { fileName = match[1]; break; }
    }

    if (!fileName && /\.\w+$/.test(trimmed)) fileName = trimmed;

    if (fileName && editorRef.current) {
      const { fileName: activeFile, code } = editorRef.current.getActiveFile();
      const targetFile = fileName === activeFile ? activeFile : fileName;
      addLines([{ type: "info", text: `▶ Running ${targetFile}...` }]);
      try {
        const result = await executeCode(targetFile, code, terminalStdin);
        const lines: TerminalLine[] = [];
        if (result.output) lines.push({ type: "output", text: result.output.trim() });
        if (result.error) lines.push({ type: "error", text: result.error.trim() });
        lines.push({ type: result.exitCode === 0 ? "success" : "error", text: `Process exited with code ${result.exitCode}` });
        addLines(lines);
      } catch (err) {
        addLines([{ type: "error", text: `Failed: ${err instanceof Error ? err.message : String(err)}` }]);
      }
      return;
    }

    if (trimmed === "clear") { addLines([{ type: "info", text: "__clear__" }]); return; }
    if (trimmed === "help") {
      addLines([
        { type: "info", text: "Available commands:" },
        { type: "command", text: "  python3 <file>  — Run a Python file" },
        { type: "command", text: "  node <file>     — Run a JavaScript file" },
        { type: "command", text: "  <filename>      — Run the file directly" },
        { type: "command", text: "  clear           — Clear the terminal" },
      ]);
      return;
    }

    addLines([
      { type: "error", text: `Unknown command: ${trimmed}` },
      { type: "info", text: `Type "help" for available commands.` },
    ]);
  };

  const { isDark } = useTheme();

  return (
    <main className={`flex flex-col h-screen overflow-hidden transition-colors duration-300 ${
      isDark ? "bg-[#0F172A] text-white" : "bg-gray-100 text-gray-900"
    }`}>
      <Navbar roomId={roomId} userName={userName} onRun={handleRun} isRunning={isRunning} onNameChange={handleNameChange} />

      {/* Mobile tab switcher */}
      <div className={`md:hidden flex flex-shrink-0 border-b transition-colors duration-300 ${
        isDark ? "bg-[#0B1120] border-[#1E293B]" : "bg-white border-gray-200"
      }`}>
        <button
          onClick={() => setMobileTab("editor")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all duration-300 ${
            mobileTab === "editor"
              ? "text-cyan-500 border-b-2 border-cyan-500"
              : isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          <Code2 size={15} />
          Editor
        </button>
        <button
          onClick={() => setMobileTab("users")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all duration-300 ${
            mobileTab === "users"
              ? "text-cyan-500 border-b-2 border-cyan-500"
              : isDark ? "text-gray-400" : "text-gray-500"
          }`}
        >
          <Users size={15} />
          Participants
        </button>
      </div>

      {/* Main content */}
      <div className={`flex min-h-0 flex-1 gap-4 md:gap-6 p-3 md:p-6 overflow-hidden transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-[#0F172A] to-[#020617]"
          : "bg-gradient-to-br from-gray-100 to-gray-200"
      }`}>
        {/* Editor — hidden on mobile when users tab is active */}
        <div className={`flex-1 min-w-0 min-h-0 overflow-hidden ${
          mobileTab === "users" ? "hidden md:flex" : "flex"
        }`}>
          <EditorPanel roomId={roomId} ref={editorRef} />
        </div>

        {/* Collaboration panel — full width on mobile when users tab active, sidebar on desktop */}
        <div className={`min-h-0 overflow-hidden ${
          mobileTab === "users"
            ? "flex flex-1 md:flex-none md:w-80"
            : "hidden md:flex md:w-80"
        }`}>
          <CollaborationPanel />
        </div>
      </div>

      {/* Terminal — collapsible on mobile */}
      <div className="flex-shrink-0">
        {/* Terminal toggle bar (mobile only) */}
        <button
          onClick={() => setTerminalOpen((o) => !o)}
          className={`md:hidden w-full flex items-center justify-between px-4 py-2 text-sm font-semibold border-t transition-colors duration-300 ${
            isDark
              ? "bg-[#0B1120] border-[#1E293B] text-gray-300"
              : "bg-white border-gray-200 text-gray-600"
          }`}
        >
          <span>Terminal</span>
          {terminalOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        <div className={`${terminalOpen ? "block" : "hidden md:block"}`}>
          <TerminalPanel
            outputLines={outputLines}
            onCommand={handleTerminalCommand}
            onStdinChange={setStdin}
          />
        </div>
      </div>
    </main>
  );
}
