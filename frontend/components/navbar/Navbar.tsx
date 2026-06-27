"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Plus, Play, X, Copy, Mail, Menu, Users, ChevronLeft } from "lucide-react";
import { socket } from "@/lib/socket";
import { useTheme } from "@/lib/ThemeContext";

interface NavbarProps {
  roomId: string;
  userName: string;
  onRun: () => void;
  isRunning: boolean;
}

export default function Navbar({ roomId, userName, onRun, isRunning }: NavbarProps) {
  const { isDark, toggleTheme } = useTheme();
  const [isConnected, setIsConnected] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    setIsConnected(socket.connected);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const roomUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/room/${roomId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEmailInvite = () => {
    const subject = encodeURIComponent("Join my CodeArena session");
    const body = encodeURIComponent(
      `Hey! Join me on CodeArena for real-time collaborative coding.\n\nRoom ID: ${roomId}\nDirect link: ${roomUrl}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const initial = userName ? userName[0].toUpperCase() : "?";

  return (
    <>
      <header className={`flex items-center justify-between flex-shrink-0 h-16 md:h-20 px-4 md:px-8 border-b transition-colors duration-300 backdrop-blur-xl ${
        isDark
          ? "border-[#1E293B] bg-[#0B1120]/70 text-white"
          : "border-gray-200 bg-white/80 text-gray-900"
      }`}>

        {/* Left - Logo + Room info */}
        <div className="flex items-center gap-3 md:gap-8">
          <button
            onClick={() => window.location.href = "/dashboard"}
            className="text-2xl md:text-4xl font-black tracking-wider bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            title="Go to lobby"
          >
            CA
          </button>

          <div className="hidden sm:block">
            <h1 className={`text-lg md:text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Editor Workspace
            </h1>
            <p className={`text-xs md:text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Room: <span className="text-cyan-500 font-mono">{roomId}</span>
            </p>
          </div>

          {/* Mobile: just show room ID */}
          <div className="sm:hidden">
            <p className="text-xs text-cyan-500 font-mono">{roomId}</p>
          </div>
        </div>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={handleCopyLink}
            className="px-6 py-3 font-bold text-white transition-all duration-300 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:scale-105 hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]"
          >
            {copied ? "Copied!" : "Share Room"}
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className={`flex items-center gap-3 px-5 py-3 transition-all duration-300 border rounded-2xl hover:scale-105 ${
              isDark
                ? "border-[#1E293B] bg-[#111827] text-white hover:bg-[#1F2937]"
                : "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Invite Users
            <Plus size={18} />
          </button>

          <button
            onClick={onRun}
            disabled={isRunning}
            className={`flex items-center gap-3 px-8 py-3 font-semibold transition-all duration-300 rounded-2xl ${
              isRunning
                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                : "text-black bg-cyan-500 hover:bg-cyan-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]"
            }`}
          >
            <Play size={18} />
            {isRunning ? "Running..." : "Run"}
          </button>

          <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${
            isDark ? "bg-[#111827] border-[#1E293B]" : "bg-gray-100 border-gray-200"
          }`}>
            <div className="flex items-center justify-center w-12 h-12 font-bold rounded-full bg-gradient-to-br from-purple-400 to-pink-500 text-white">
              {initial}
            </div>
            <div>
              <h3 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{userName}</h3>
              <p className="text-sm text-green-500">Status: Online</p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center transition-all duration-300 w-14 h-14 rounded-2xl border ${
              isDark
                ? "bg-[#111827] border-[#1E293B] text-yellow-400 hover:bg-[#1F2937]"
                : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isDark ? <Sun size={22} /> : <Moon size={22} />}
          </button>

          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${
            isConnected ? "bg-[#052e16] border-green-900" : "bg-[#1c0a0a] border-red-900"
          }`}>
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`font-medium ${isConnected ? "text-green-400" : "text-red-400"}`}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Mobile right actions */}
        <div className="flex md:hidden items-center gap-2">
          {/* Connection dot */}
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />

          {/* Run button */}
          <button
            onClick={onRun}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
              isRunning
                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                : "text-black bg-cyan-500 hover:bg-cyan-400"
            }`}
          >
            <Play size={14} />
            {isRunning ? "..." : "Run"}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 ${
              isDark
                ? "bg-[#111827] border-[#1E293B] text-yellow-400"
                : "bg-gray-100 border-gray-200 text-gray-700"
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Hamburger */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-300 ${
              isDark
                ? "bg-[#111827] border-[#1E293B] text-white"
                : "bg-gray-100 border-gray-200 text-gray-700"
            }`}
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {showMobileMenu && (
        <div className={`md:hidden fixed inset-0 z-50 flex flex-col transition-colors duration-300 ${
          isDark ? "bg-[#0B1120]" : "bg-white"
        }`}>
          {/* Menu header */}
          <div className={`flex items-center justify-between h-16 px-4 border-b ${
            isDark ? "border-[#1E293B]" : "border-gray-200"
          }`}>
            <span className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}>Menu</span>
            <button onClick={() => setShowMobileMenu(false)}>
              <X size={22} className={isDark ? "text-gray-400" : "text-gray-600"} />
            </button>
          </div>

          <div className="flex flex-col gap-3 p-5">
            {/* User info */}
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
              isDark ? "bg-[#111827] border-[#1E293B]" : "bg-gray-50 border-gray-200"
            }`}>
              <div className="flex items-center justify-center w-10 h-10 font-bold rounded-full bg-gradient-to-br from-purple-400 to-pink-500 text-white text-sm">
                {initial}
              </div>
              <div>
                <p className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{userName}</p>
                <p className="text-xs text-green-500">Online · {roomId}</p>
              </div>
            </div>

            {/* Share Room */}
            <button
              onClick={() => { handleCopyLink(); setShowMobileMenu(false); }}
              className="w-full py-3 font-bold text-white rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600"
            >
              {copied ? "✓ Link Copied!" : "Share Room Link"}
            </button>

            {/* Invite Users */}
            <button
              onClick={() => { setShowInviteModal(true); setShowMobileMenu(false); }}
              className={`w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-2xl border transition-all duration-300 ${
                isDark
                  ? "border-[#1E293B] bg-[#111827] text-white"
                  : "border-gray-200 bg-gray-100 text-gray-700"
              }`}
            >
              <Users size={18} />
              Invite Users
            </button>

            {/* Go to dashboard */}
            <button
              onClick={() => window.location.href = "/dashboard"}
              className={`w-full flex items-center justify-center gap-2 py-3 font-semibold rounded-2xl border transition-all duration-300 ${
                isDark
                  ? "border-[#1E293B] bg-[#111827] text-white"
                  : "border-gray-200 bg-gray-100 text-gray-700"
              }`}
            >
              <ChevronLeft size={18} />
              Back to Dashboard
            </button>

            {/* Connection status */}
            <div className={`flex items-center justify-center gap-2 py-3 rounded-2xl border ${
              isConnected ? "bg-[#052e16] border-green-900" : "bg-[#1c0a0a] border-red-900"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              <span className={`text-sm font-medium ${isConnected ? "text-green-400" : "text-red-400"}`}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 md:p-8 transition-colors duration-300 ${
            isDark ? "bg-[#0B1120] border-[#1E293B]" : "bg-white border-gray-200"
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl md:text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                Invite Collaborators
              </h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className={`p-2 rounded-xl transition-all duration-300 ${
                  isDark ? "hover:bg-[#1E293B] text-gray-400" : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5">
              <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Share this link
              </label>
              <div className={`flex items-center gap-3 p-3 md:p-4 rounded-2xl border ${
                isDark ? "bg-[#111827] border-[#1E293B]" : "bg-gray-50 border-gray-200"
              }`}>
                <code className={`flex-1 text-xs md:text-sm font-mono truncate ${
                  isDark ? "text-cyan-400" : "text-cyan-600"
                }`}>
                  {roomUrl}
                </code>
                <button
                  onClick={handleCopyLink}
                  className={`p-2 rounded-xl flex-shrink-0 transition-all duration-300 ${
                    copied ? "bg-green-500 text-white" : isDark ? "bg-[#1E293B] text-gray-300" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  <Copy size={16} />
                </button>
              </div>
              {copied && <p className="mt-2 text-sm text-green-500">✓ Copied!</p>}
            </div>

            <div className="mb-5">
              <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Or share the Room ID
              </label>
              <div className={`p-3 md:p-4 rounded-2xl border ${
                isDark ? "bg-[#111827] border-[#1E293B]" : "bg-gray-50 border-gray-200"
              }`}>
                <code className={`text-xl md:text-2xl font-mono font-bold ${
                  isDark ? "text-white" : "text-gray-900"
                }`}>
                  {roomId}
                </code>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleEmailInvite}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 border ${
                  isDark ? "border-[#1E293B] bg-[#111827] text-white" : "border-gray-200 bg-gray-100 text-gray-700"
                }`}
              >
                <Mail size={16} />
                Email
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-3 rounded-2xl font-semibold text-white text-sm bg-gradient-to-r from-purple-500 to-indigo-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
