"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function generateRoomId() {
  return "CA-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState("");

  const validate = (): boolean => {
    if (!userName.trim()) {
      setError("Please enter your name.");
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!validate()) return;
    localStorage.setItem("codearena-username", userName.trim());
    const newRoomId = generateRoomId();
    router.push(`/room/${newRoomId}`);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!joinRoomId.trim()) {
      setError("Please enter a room ID.");
      return;
    }
    localStorage.setItem("codearena-username", userName.trim());
    router.push(`/room/${joinRoomId.trim()}`);
  };

  return (
    <main className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md px-6 py-10 md:px-8 md:py-12 rounded-3xl border border-[#1E293B] bg-[#0B1120]/80 backdrop-blur-xl shadow-[0_0_60px_rgba(34,211,238,0.06)] flex flex-col gap-6 md:gap-7">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent tracking-wider">
            CodeArena
          </h1>
          <p className="mt-2 text-gray-400 text-sm">
            Real-time collaborative code editor
          </p>
        </div>

        {/* Name input — required for both actions */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">
            Your Name
          </label>
          <input
            type="text"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              setError("");
            }}
            placeholder="Enter your display name"
            maxLength={30}
            className="w-full px-5 py-4 rounded-2xl bg-[#111827] border border-[#1E293B] text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all duration-300"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Create Room */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">
            New Session
          </label>
          <button
            onClick={handleCreate}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold text-lg hover:opacity-90 hover:scale-[1.02] transition-all duration-300 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          >
            + Create Room
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-[#1E293B]" />
          <span className="text-gray-500 text-sm">or join existing</span>
          <div className="flex-1 h-px bg-[#1E293B]" />
        </div>

        {/* Join Room */}
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">
            Join Session
          </label>
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => {
              setJoinRoomId(e.target.value);
              setError("");
            }}
            placeholder="Enter Room ID (e.g. CA-A3F9)"
            className="w-full px-5 py-4 rounded-2xl bg-[#111827] border border-[#1E293B] text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 focus:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all duration-300 font-mono"
          />
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-[#1E293B] text-white font-bold text-lg hover:bg-[#273449] hover:scale-[1.02] transition-all duration-300 border border-[#334155]"
          >
            Join Room →
          </button>
        </form>
      </div>
    </main>
  );
}
