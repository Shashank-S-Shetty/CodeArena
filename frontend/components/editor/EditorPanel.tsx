"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { socket } from "@/lib/socket";
import { useTheme } from "@/lib/ThemeContext";

// Monaco dynamic import (no SSR)
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// Exposed interface for parent to call
export interface EditorRef {
  getActiveFile: () => { fileName: string; code: string };
}

interface EditorPanelProps {
  roomId: string;
}

const EditorPanel = forwardRef<EditorRef, EditorPanelProps>(({ roomId }, ref) => {
  const { isDark } = useTheme();
  const [tabs, setTabs] = useState<string[]>([
    "main.py",
    "app.js",
    "config.json",
  ]);

  const [activeTab, setActiveTab] = useState("main.py");

  const [files, setFiles] = useState<Record<string, string>>({
    "main.py": `import asyncio\n\ndef calculate_sum():\n    return 42\n\nasync def process_data():\n    data = []\n\n    for item in range(10):\n        print(item)\n`,
    "app.js": `function greet() {\n  console.log("Welcome to ForgeIDE");\n}\n\ngreet();\n`,
    "config.json": `{\n  "theme": "dark",\n  "language": "python"\n}`,
  });

  // Flag to prevent re-emitting code that came in from the socket (echo loop)
  const isRemoteChange = useRef(false);

  // Keep refs of files and activeTab in sync for imperative handle (avoids stale closure)
  const filesRef = useRef(files);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Expose active file data to parent via ref
  useImperativeHandle(ref, () => ({
    getActiveFile: () => {
      const currentFile = activeTabRef.current;
      const currentCode = filesRef.current[currentFile] ?? "";
      console.log("getActiveFile called:", { currentFile, codeLength: currentCode.length });
      return {
        fileName: currentFile,
        code: currentCode,
      };
    },
  }));

  // Load saved state from localStorage once on mount (scoped to roomId)
  useEffect(() => {
    if (!roomId) return; // Wait until roomId is available

    const savedTabs = localStorage.getItem(`forgeid-tabs-${roomId}`);
    const savedFiles = localStorage.getItem(`forgeid-files-${roomId}`);
    const savedActiveTab = localStorage.getItem(`forgeid-active-tab-${roomId}`);

    if (savedTabs) setTabs(JSON.parse(savedTabs));
    if (savedFiles) setFiles(JSON.parse(savedFiles));
    if (savedActiveTab) setActiveTab(savedActiveTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // Only run when roomId changes

  // Persist state to localStorage whenever it changes (scoped to roomId)
  useEffect(() => {
    localStorage.setItem(`forgeid-tabs-${roomId}`, JSON.stringify(tabs));
    localStorage.setItem(`forgeid-files-${roomId}`, JSON.stringify(files));
    localStorage.setItem(`forgeid-active-tab-${roomId}`, activeTab);
  }, [tabs, files, activeTab, roomId]);

  // Receive realtime code — fileName comes from the payload so no stale closure risk
  useEffect(() => {
    const handleReceiveCode = ({ fileName, code }: { fileName: string; code: string }) => {
      console.log(`Received realtime code for file: ${fileName}`);
      isRemoteChange.current = true;
      setFiles((prev) => ({
        ...prev,
        [fileName]: code,
      }));
    };

    // Remote user created a new file
    const handleRemoteFileCreated = ({ fileName, code }: { fileName: string; code: string }) => {
      console.log(`Remote file created: ${fileName}`);
      setTabs((prev) => prev.includes(fileName) ? prev : [...prev, fileName]);
      setFiles((prev) => ({ ...prev, [fileName]: code }));
    };

    // Remote user deleted a file
    const handleRemoteFileDeleted = ({ fileName }: { fileName: string }) => {
      console.log(`Remote file deleted: ${fileName}`);
      setTabs((prev) => {
        const updated = prev.filter((t) => t !== fileName);
        // If the deleted file was active here, switch to first remaining
        setActiveTab((current) => current === fileName ? updated[0] ?? "" : current);
        return updated;
      });
      setFiles((prev) => {
        const updated = { ...prev };
        delete updated[fileName];
        return updated;
      });
    };

    socket.on("receive-code", handleReceiveCode);
    socket.on("remote-file-created", handleRemoteFileCreated);
    socket.on("remote-file-deleted", handleRemoteFileDeleted);

    return () => {
      socket.off("receive-code", handleReceiveCode);
      socket.off("remote-file-created", handleRemoteFileCreated);
      socket.off("remote-file-deleted", handleRemoteFileDeleted);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — all data comes from payloads

  const getLanguage = (fileName: string) => {
    if (fileName.endsWith(".py")) return "python";
    if (fileName.endsWith(".js")) return "javascript";
    if (fileName.endsWith(".json")) return "json";
    if (fileName.endsWith(".ts")) return "typescript";
    if (fileName.endsWith(".cpp")) return "cpp";
    if (fileName.endsWith(".java")) return "java";
    return "plaintext";
  };

  const createNewFile = () => {
    const fileName = prompt("Enter file name");
    if (!fileName) return;

    if (tabs.includes(fileName)) {
      alert("File already exists");
      return;
    }

    setTabs((prev) => [...prev, fileName]);
    setFiles((prev) => ({ ...prev, [fileName]: "" }));
    setActiveTab(fileName);

    // Notify other users in the room
    socket.emit("file-created", { roomId, fileName, code: "" });
  };

  const deleteFile = (fileName: string) => {
    if (tabs.length === 1) {
      alert("At least one file must exist");
      return;
    }

    const updatedTabs = tabs.filter((tab) => tab !== fileName);
    setTabs(updatedTabs);

    setFiles((prev) => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });

    if (activeTab === fileName) {
      setActiveTab(updatedTabs[0]);
    }

    // Notify other users in the room
    socket.emit("file-deleted", { roomId, fileName });
  };

  const handleEditorChange = (value: string | undefined) => {
    const code = value || "";

    // If this change came from the socket, don't emit it back
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    setFiles((prev) => ({ ...prev, [activeTab]: code }));

    socket.emit("code-change", { roomId, fileName: activeTab, code });
  };

  return (
    <div className={`flex flex-col flex-1 min-w-0 overflow-hidden border rounded-3xl shadow-[0_0_40px_rgba(34,211,238,0.08)] transition-colors duration-300 ${
      isDark
        ? "bg-[#0B1120]/80 backdrop-blur-xl border-cyan-500/10"
        : "bg-white border-gray-200"
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between flex-shrink-0 h-16 px-4 border-b transition-colors duration-300 ${
        isDark ? "bg-[#111827] border-[#1E293B]" : "bg-gray-50 border-gray-200"
      }`}>
        {/* Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                activeTab === tab
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-500 border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                  : isDark
                  ? "text-gray-400 hover:bg-[#1E293B] hover:text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
              }`}
            >
              <button onClick={() => setActiveTab(tab)} className="whitespace-nowrap">
                {tab}
              </button>
              <button onClick={() => deleteFile(tab)} className="text-xs hover:text-red-400 transition-all duration-300">
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const content = files[activeTab] || "";
              const blob = new Blob([content], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = activeTab;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className={`px-4 py-2 text-sm transition-all duration-300 rounded-xl ${
              isDark
                ? "text-gray-300 bg-[#1E293B] hover:text-white hover:bg-[#273449]"
                : "text-gray-600 bg-gray-200 hover:text-gray-900 hover:bg-gray-300"
            }`}
          >
            Save
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Explorer */}
        <div className={`w-64 p-4 border-r flex-shrink-0 overflow-y-auto transition-colors duration-300 ${
          isDark ? "bg-[#0A0F1C] border-[#1E293B]" : "bg-gray-50 border-gray-200"
        }`}>
          <h3 className={`mb-4 text-xs font-bold tracking-widest uppercase ${
            isDark ? "text-gray-400" : "text-gray-500"
          }`}>
            Explorer
          </h3>

          <button
            onClick={createNewFile}
            className="w-full mb-4 px-3 py-2 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-all duration-300"
          >
            + New File
          </button>

          <div className="space-y-1">
            {tabs.map((tab) => (
              <div
                key={tab}
                className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-300 ${
                  activeTab === tab
                    ? isDark ? "bg-[#1E293B] text-cyan-400" : "bg-cyan-50 text-cyan-600"
                    : isDark
                    ? "text-gray-400 hover:bg-[#111827] hover:text-white hover:translate-x-1"
                    : "text-gray-500 hover:bg-gray-200 hover:text-gray-900 hover:translate-x-1"
                }`}
              >
                <button onClick={() => setActiveTab(tab)} className="flex-1 text-left">
                  {tab}
                </button>
                <button onClick={() => deleteFile(tab)} className="text-xs hover:text-red-400 transition-all duration-300">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="relative flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={getLanguage(activeTab)}
            value={files[activeTab]}
            onChange={handleEditorChange}
            theme={isDark ? "vs-dark" : "light"}
            options={{
              fontSize: 14,
              fontFamily: "JetBrains Mono, Courier New, monospace",
              minimap: { enabled: false },
              smoothScrolling: true,
              padding: { top: 20 },
              cursorBlinking: "smooth",
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    </div>
  );
})


EditorPanel.displayName = "EditorPanel";
export default EditorPanel;
