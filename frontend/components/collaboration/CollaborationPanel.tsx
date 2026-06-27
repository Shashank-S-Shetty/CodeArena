"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useTheme } from "@/lib/ThemeContext";

interface Participant {
  id: string;
  name: string;
  color: string;
  initial: string;
}

export default function CollaborationPanel() {
  const { isDark } = useTheme();
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    // Receive the full list of current users when we first join the room
    const handleRoomUsers = (users: Participant[]) => {
      setParticipants(users);
    };

    // A new user joined — add them to the list
    const handleUserJoined = (user: Participant) => {
      setParticipants((prev) => {
        // Avoid duplicates in case of re-join
        const exists = prev.find((p) => p.id === user.id);
        if (exists) return prev;
        return [...prev, user];
      });
    };

    // A user left — remove them from the list
    const handleUserLeft = (socketId: string) => {
      setParticipants((prev) => prev.filter((p) => p.id !== socketId));
    };

    socket.on("room-users", handleRoomUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);

    return () => {
      socket.off("room-users", handleRoomUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
    };
  }, []);

  return (
    <div className={`flex w-full md:w-80 flex-shrink-0 flex-col rounded-3xl border p-5 shadow-[0_0_40px_rgba(139,92,246,0.08)] backdrop-blur-xl transition-colors duration-300 ${
      isDark
        ? "border-purple-500/10 bg-[#0B1120]/80"
        : "border-gray-200 bg-white"
    }`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
          Active Participants
        </h2>
        <p className={`mt-1 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {participants.length === 0
            ? "No one else in the room"
            : `${participants.length} user${participants.length !== 1 ? "s" : ""} connected`}
        </p>
      </div>

      {/* Participant list */}
      <div className="space-y-4 overflow-y-auto flex-1">
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isDark ? "bg-[#1E293B]" : "bg-gray-100"
            }`}>
              <span className="text-2xl">👤</span>
            </div>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Share the room link to invite collaborators.
            </p>
          </div>
        ) : (
          participants.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition-all duration-300 ${
                isDark
                  ? "border-[#1E293B] bg-[#111827] hover:bg-[#1F2937]"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ${user.color}`}>
                {user.initial}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
                  {user.name}
                </h3>
                <p className="text-sm text-green-500">Active in session</p>
              </div>
              <div className="h-3 w-3 animate-pulse rounded-full bg-green-400 flex-shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
