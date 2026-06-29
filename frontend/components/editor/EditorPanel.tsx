"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { socket } from "@/lib/socket";
import { useTheme } from "@/lib/ThemeContext";
import type * as Monaco from "monaco-editor";

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

  // Yjs docs: one per file. Keyed by fileName.
  const ydocsRef = useRef<Map<string, Y.Doc>>(new Map());
  // Current Monaco binding
  const bindingRef = useRef<MonacoBinding | null>(null);
  // Monaco editor instance
  const editorRef2 = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  // Monaco module ref
  const monacoRef = useRef<typeof Monaco | null>(null);

  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // ── Expose getActiveFile to parent via ref ──────────────────────────────────
  useImperativeHandle(ref, () => ({
    getActiveFile: () => {
      const fileName = activeTabRef.current;
      const ydoc = ydocsRef.current.get(fileName);
      const code = ydoc ? ydoc.getText("content").toString() : "";
      return { fileName, code };
    },
  }));

  // ── Get or create a Y.Doc for a file ───────────────────────────────────────
  const getOrCreateDoc = useCallback((fileName: string): Y.Doc => {
    if (ydocsRef.current.has(fileName)) {
      return ydocsRef.current.get(fileName)!;
    }
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");

    // Seed with default or persisted content
    const savedFiles = localStorage.getItem(`forgeid-files-${roomId}`);
    let initialContent = DEFAULT_FILES[fileName] ?? "";
    if (savedFiles) {
      try {
        const parsed = JSON.parse(savedFiles);
        if (parsed[fileName] !== undefined) initialContent = parsed[fileName];
      } catch { /* ignore */ }
    }

    if (ytext.toString() === "" && initialContent) {
      ydoc.transact(() => ytext.insert(0, initialContent));
    }

    // Observe changes — emit Yjs updates over socket
    ydoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return; // Don't echo back remote updates
      socket.emit("yjs-update", {
        roomId,
        fileName,
        update: Array.from(update),
      });
      // Also persist to localStorage
      persistFile(fileName, ytext.toString());
    });

    ydocsRef.current.set(fileName, ydoc);
    return ydoc;
  }, [roomId]);

  // ── Persist file content to localStorage ───────────────────────────────────
  const persistFile = useCallback((fileName: string, content: string) => {
    try {
      const savedFiles = localStorage.getItem(`forgeid-files-${roomId}`);
      const files = savedFiles ? JSON.parse(savedFiles) : {};
      files[fileName] = content;
      localStorage.setItem(`forgeid-files-${roomId}`, JSON.stringify(files));
    } catch { /* ignore */ }
  }, [roomId]);

  // ── Bind the active file's Y.Doc to Monaco ─────────────────────────────────
  const bindDocToEditor = useCallback((fileName: string) => {
    if (!editorRef2.current || !monacoRef.current) return;

    // Destroy previous binding
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    const ydoc = getOrCreateDoc(fileName);
    const ytext = ydoc.getText("content");

    // Set language on the model
    const model = editorRef2.current.getModel();
    if (model) {
      monacoRef.current.editor.setModelLanguage(model, getLanguage(fileName));
    }

    bindingRef.current = new MonacoBinding(
      ytext,
      editorRef2.current.getModel()!,
      new Set([editorRef2.current]),
      null
    );

    // Request sync from server in case we're joining mid-session
    socket.emit("yjs-sync-request", { roomId, fileName });
  }, [getOrCreateDoc, roomId]);

  // ── Handle tab switch ───────────────────────────────────────────────────────
  const switchTab = useCallback((fileName: string) => {
    setActiveTab(fileName);
    bindDocToEditor(fileName);
    localStorage.setItem(`forgeid-active-tab-${roomId}`, fileName);
  }, [bindDocToEditor, roomId]);

  // ── Monaco onMount ──────────────────────────────────────────────────────────
  const handleEditorMount = useCallback((
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => {
    editorRef2.current = editor;
    monacoRef.current = monaco;
    bindDocToEditor(activeTabRef.current);
  }, [bindDocToEditor]);

  // ── Socket listeners for Yjs ────────────────────────────────────────────────
  useEffect(() => {
    const handleYjsUpdate = ({ fileName, update }: { fileName: string; update: number[] }) => {
      const ydoc = getOrCreateDoc(fileName);
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
    };

    const handleYjsSyncResponse = ({ fileName, state }: { fileName: string; state: number[] }) => {
      const ydoc = getOrCreateDoc(fileName);
      Y.applyUpdate(ydoc, new Uint8Array(state), "remote");
    };

    const handleRemoteFileCreated = ({ fileName, code }: { fileName: string; code: string }) => {
      setTabs((prev) => prev.includes(fileName) ? prev : [...prev, fileName]);
      const ydoc = getOrCreateDoc(fileName);
      const ytext = ydoc.getText("content");
      if (ytext.toString() === "" && code) {
        ydoc.transact(() => ytext.insert(0, code), "remote");
      }
      persistFile(fileName, code);
    };

    const handleRemoteFileDeleted = ({ fileName }: { fileName: string }) => {
      ydocsRef.current.get(fileName)?.destroy();
      ydocsRef.current.delete(fileName);
      setTabs((prev) => {
        const updated = prev.filter((t) => t !== fileName);
        setActiveTab((current) => {
          if (current === fileName) {
            const next = updated[0] ?? "";
            if (next) setTimeout(() => bindDocToEditor(next), 0);
            return next;
          }
          return current;
        });
        return updated;
      });
    };

    socket.on("yjs-update", handleYjsUpdate);
    socket.on("yjs-sync-response", handleYjsSyncResponse);
    socket.on("remote-file-created", handleRemoteFileCreated);
    socket.on("remote-file-deleted", handleRemoteFileDeleted);

    return () => {
      socket.off("yjs-update", handleYjsUpdate);
      socket.off("yjs-sync-response", handleYjsSyncResponse);
      socket.off("remote-file-created", handleRemoteFileCreated);
      socket.off("remote-file-deleted", handleRemoteFileDeleted);
    };
  }, [getOrCreateDoc, bindDocToEditor, persistFile]);

  // ── Load saved tabs from localStorage on mount ─────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const savedTabs = localStorage.getItem(`forgeid-tabs-${roomId}`);
    const savedActiveTab = localStorage.getItem(`forgeid-active-tab-${roomId}`);
    if (savedTabs) {
      try { setTabs(JSON.parse(savedTabs)); } catch { /* ignore */ }
    }
    if (savedActiveTab) setActiveTab(savedActiveTab);
  }, [roomId]);

  // Persist tabs list
  useEffect(() => {
    if (roomId) {
      localStorage.setItem(`forgeid-tabs-${roomId}`, JSON.stringify(tabs));
    }
  }, [tabs, roomId]);

  // Re-bind when activeTab changes (handles initial load)
  useEffect(() => {
    if (editorRef2.current) bindDocToEditor(activeTab);
  }, [activeTab, bindDocToEditor]);

  // ── File operations ─────────────────────────────────────────────────────────
  const createNewFile = () => {
    const fileName = prompt("Enter file name");
    if (!fileName || tabs.includes(fileName)) {
      if (fileName) alert("File already exists");
      return;
    }
    setTabs((prev) => [...prev, fileName]);
    getOrCreateDoc(fileName); // init empty doc
    setActiveTab(fileName);
    socket.emit("file-created", { roomId, fileName, code: "" });
  };

  const deleteFile = (fileName: string) => {
    if (tabs.length === 1) { alert("At least one file must exist"); return; }
    const updatedTabs = tabs.filter((t) => t !== fileName);
    ydocsRef.current.get(fileName)?.destroy();
    ydocsRef.current.delete(fileName);
    setTabs(updatedTabs);
    if (activeTab === fileName) switchTab(updatedTabs[0]);
    socket.emit("file-deleted", { roomId, fileName });
  };

  const getLanguage = (fileName: string) => {
    if (fileName.endsWith(".py")) return "python";
    if (fileName.endsWith(".js")) return "javascript";
    if (fileName.endsWith(".json")) return "json";
    if (fileName.endsWith(".ts")) return "typescript";
    if (fileName.endsWith(".tsx")) return "typescript";
    if (fileName.endsWith(".cpp") || fileName.endsWith(".cc")) return "cpp";
    if (fileName.endsWith(".java")) return "java";
    if (fileName.endsWith(".go")) return "go";
    if (fileName.endsWith(".rs")) return "rust";
    if (fileName.endsWith(".rb")) return "ruby";
    if (fileName.endsWith(".cs")) return "csharp";
    return "plaintext";
  };

  const downloadActiveFile = () => {
    const ydoc = ydocsRef.current.get(activeTab);
    const content = ydoc ? ydoc.getText("content").toString() : "";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeTab;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col flex-1 min-w-0 overflow-hidden border rounded-3xl shadow-[0_0_40px_rgba(34,211,238,0.08)] transition-colors duration-300 ${
      isDark
        ? "bg-[#0B1120]/80 backdrop-blur-xl border-cyan-500/10"
        : "bg-white border-gray-200"
    }`}>
      {/* Header / Tabs */}
      <div className={`flex items-center justify-between flex-shrink-0 h-16 px-4 border-b transition-colors duration-300 ${
        isDark ? "bg-[#111827] border-[#1E293B]" : "bg-gray-50 border-gray-200"
      }`}>
        <div className="flex items-center gap-3 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                activeTab === tab
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-500 border border-cyan-500/20"
                  : isDark
                  ? "text-gray-400 hover:bg-[#1E293B] hover:text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
              }`}
            >
              <button onClick={() => switchTab(tab)} className="whitespace-nowrap">{tab}</button>
              <button onClick={() => deleteFile(tab)} className="text-xs hover:text-red-400 transition-all duration-300">✕</button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadActiveFile}
            className={`px-4 py-2 text-sm rounded-xl transition-all duration-300 ${
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
          <h3 className={`mb-4 text-xs font-bold tracking-widest uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
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
                <button onClick={() => switchTab(tab)} className="flex-1 text-left">{tab}</button>
                <button onClick={() => deleteFile(tab)} className="text-xs hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Monaco */}
        <div className="relative flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={getLanguage(activeTab)}
            theme={isDark ? "vs-dark" : "light"}
            onMount={handleEditorMount}
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
