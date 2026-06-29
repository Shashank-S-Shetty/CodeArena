"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { socket } from "@/lib/socket";
import { useTheme } from "@/lib/ThemeContext";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export interface EditorRef {
  getActiveFile: () => { fileName: string; code: string };
}

interface EditorPanelProps {
  roomId: string;
}

const DEFAULT_FILES: Record<string, string> = {
  "main.py": `import asyncio\n\ndef calculate_sum():\n    return 42\n\nasync def process_data():\n    data = []\n\n    for item in range(10):\n        print(item)\n`,
  "app.js": `function greet() {\n  console.log("Welcome to ForgeIDE");\n}\n\ngreet();\n`,
  "config.json": `{\n  "theme": "dark",\n  "language": "python"\n}`,
};

const EditorPanel = forwardRef<EditorRef, EditorPanelProps>(({ roomId }, ref) => {
  const { isDark } = useTheme();

  const [tabs, setTabs] = useState<string[]>(Object.keys(DEFAULT_FILES));
  const [activeTab, setActiveTab] = useState("main.py");
  const [files, setFiles] = useState<Record<string, string>>(DEFAULT_FILES);

  // Prevent echo-back of remote changes
  const isRemoteChange = useRef(false);

  // Keep refs in sync for imperative handle (avoids stale closure)
  const filesRef = useRef(files);
  const activeTabRef = useRef(activeTab);
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Expose getActiveFile to parent
  useImperativeHandle(ref, () => ({
    getActiveFile: () => ({
      fileName: activeTabRef.current,
      code: filesRef.current[activeTabRef.current] ?? "",
    }),
  }));

  // Load persisted state from localStorage on mount
  useEffect(() => {
    if (!roomId) return;
    const savedTabs = localStorage.getItem(`forgeid-tabs-${roomId}`);
    const savedFiles = localStorage.getItem(`forgeid-files-${roomId}`);
    const savedActiveTab = localStorage.getItem(`forgeid-active-tab-${roomId}`);
    if (savedTabs) { try { setTabs(JSON.parse(savedTabs)); } catch { /* ignore */ } }
    if (savedFiles) { try { setFiles(JSON.parse(savedFiles)); } catch { /* ignore */ } }
    if (savedActiveTab) setActiveTab(savedActiveTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Persist state to localStorage on every change
  useEffect(() => {
    if (!roomId) return;
    localStorage.setItem(`forgeid-tabs-${roomId}`, JSON.stringify(tabs));
    localStorage.setItem(`forgeid-files-${roomId}`, JSON.stringify(files));
    localStorage.setItem(`forgeid-active-tab-${roomId}`, activeTab);
  }, [tabs, files, activeTab, roomId]);

  // Socket listeners — receive remote changes
  useEffect(() => {
    const handleReceiveCode = ({ fileName, code }: { fileName: string; code: string }) => {
      isRemoteChange.current = true;
      setFiles((prev) => ({ ...prev, [fileName]: code }));
    };

    const handleRemoteFileCreated = ({ fileName, code }: { fileName: string; code: string }) => {
      setTabs((prev) => prev.includes(fileName) ? prev : [...prev, fileName]);
      setFiles((prev) => ({ ...prev, [fileName]: code }));
    };

    const handleRemoteFileDeleted = ({ fileName }: { fileName: string }) => {
      setTabs((prev) => {
        const updated = prev.filter((t) => t !== fileName);
        setActiveTab((cur) => cur === fileName ? updated[0] ?? "" : cur);
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
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    const code = value ?? "";
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }
    setFiles((prev) => ({ ...prev, [activeTab]: code }));
    socket.emit("code-change", { roomId, fileName: activeTab, code });
  };

  const getLanguage = (fileName: string) => {
    if (fileName.endsWith(".py")) return "python";
    if (fileName.endsWith(".js")) return "javascript";
    if (fileName.endsWith(".json")) return "json";
    if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return "typescript";
    if (fileName.endsWith(".cpp") || fileName.endsWith(".cc")) return "cpp";
    if (fileName.endsWith(".java")) return "java";
    if (fileName.endsWith(".go")) return "go";
    if (fileName.endsWith(".rs")) return "rust";
    if (fileName.endsWith(".rb")) return "ruby";
    if (fileName.endsWith(".cs")) return "csharp";
    return "plaintext";
  };

  const createNewFile = () => {
    const fileName = prompt("Enter file name");
    if (!fileName) return;
    if (tabs.includes(fileName)) { alert("File already exists"); return; }
    setTabs((prev) => [...prev, fileName]);
    setFiles((prev) => ({ ...prev, [fileName]: "" }));
    setActiveTab(fileName);
    socket.emit("file-created", { roomId, fileName, code: "" });
  };

  const deleteFile = (fileName: string) => {
    if (tabs.length === 1) { alert("At least one file must exist"); return; }
    const updatedTabs = tabs.filter((t) => t !== fileName);
    setTabs(updatedTabs);
    setFiles((prev) => { const u = { ...prev }; delete u[fileName]; return u; });
    if (activeTab === fileName) setActiveTab(updatedTabs[0]);
    socket.emit("file-deleted", { roomId, fileName });
  };

  const downloadActiveFile = () => {
    const content = files[activeTab] ?? "";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = activeTab; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col flex-1 min-w-0 overflow-hidden border rounded-3xl shadow-[0_0_40px_rgba(34,211,238,0.08)] transition-colors duration-300 ${
      isDark ? "bg-[#0B1120]/80 backdrop-blur-xl border-cyan-500/10" : "bg-white border-gray-200"
    }`}>
      {/* Header / Tabs */}
      <div className={`flex items-center justify-between flex-shrink-0 h-16 px-4 border-b transition-colors duration-300 ${
        isDark ? "bg-[#111827] border-[#1E293B]" : "bg-gray-50 border-gray-200"
      }`}>
        <div className="flex items-center gap-3 overflow-x-auto">
          {tabs.map((tab) => (
            <div key={tab} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
              activeTab === tab
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-500 border border-cyan-500/20"
                : isDark ? "text-gray-400 hover:bg-[#1E293B] hover:text-white" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
            }`}>
              <button onClick={() => setActiveTab(tab)} className="whitespace-nowrap">{tab}</button>
              <button onClick={() => deleteFile(tab)} className="text-xs hover:text-red-400 transition-all duration-300">✕</button>
            </div>
          ))}
        </div>
        <button
          onClick={downloadActiveFile}
          className={`px-4 py-2 text-sm rounded-xl transition-all duration-300 ${
            isDark ? "text-gray-300 bg-[#1E293B] hover:text-white hover:bg-[#273449]" : "text-gray-600 bg-gray-200 hover:text-gray-900 hover:bg-gray-300"
          }`}
        >
          Save
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Explorer */}
        <div className={`w-64 p-4 border-r flex-shrink-0 overflow-y-auto transition-colors duration-300 ${
          isDark ? "bg-[#0A0F1C] border-[#1E293B]" : "bg-gray-50 border-gray-200"
        }`}>
          <h3 className={`mb-4 text-xs font-bold tracking-widest uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Explorer
          </h3>
          <button onClick={createNewFile} className="w-full mb-4 px-3 py-2 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-all duration-300">
            + New File
          </button>
          <div className="space-y-1">
            {tabs.map((tab) => (
              <div key={tab} className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all duration-300 ${
                activeTab === tab
                  ? isDark ? "bg-[#1E293B] text-cyan-400" : "bg-cyan-50 text-cyan-600"
                  : isDark ? "text-gray-400 hover:bg-[#111827] hover:text-white hover:translate-x-1" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900 hover:translate-x-1"
              }`}>
                <button onClick={() => setActiveTab(tab)} className="flex-1 text-left">{tab}</button>
                <button onClick={() => deleteFile(tab)} className="text-xs hover:text-red-400">✕</button>
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
});

EditorPanel.displayName = "EditorPanel";
export default EditorPanel;
