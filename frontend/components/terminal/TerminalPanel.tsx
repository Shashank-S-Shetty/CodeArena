"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/ThemeContext";

export interface TerminalLine {
  type: "info" | "output" | "error" | "success" | "command";
  text: string;
}

interface TerminalPanelProps {
  outputLines?: TerminalLine[];
  onCommand?: (
    command: string,
    addLines: (lines: TerminalLine[]) => void,
    stdin: string
  ) => void;
  onStdinChange?: (stdin: string) => void;
}

export default function TerminalPanel({
  outputLines = [],
  onCommand,
  onStdinChange,
}: TerminalPanelProps) {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"terminal" | "stdin" | "output" | "problems">("terminal");
  const [terminalInput, setTerminalInput] = useState("");
  const [stdin, setStdin] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([
    { type: "success", text: "✓ ForgeIDE terminal ready" },
    { type: "info",    text: 'Use the "Stdin" tab to provide input for your program.' },
    { type: "info",    text: 'Type "help" for available commands.' },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalHistory, outputLines, activeTab]);

  useEffect(() => {
    if (outputLines.length > 0) setActiveTab("output");
  }, [outputLines]);

  useEffect(() => {
    if (activeTab === "terminal") inputRef.current?.focus();
  }, [activeTab]);

  // Notify parent whenever stdin changes
  useEffect(() => {
    onStdinChange?.(stdin);
  }, [stdin, onStdinChange]);

  const addLines = (lines: TerminalLine[]) => {
    setTerminalHistory((prev) => {
      if (lines.some((l) => l.text === "__clear__")) {
        return [{ type: "info", text: 'Terminal cleared. Type "help" for commands.' }];
      }
      return [...prev, ...lines];
    });
  };

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = terminalInput.trim();
    if (!input || isExecuting) return;

    setTerminalHistory((prev) => [...prev, { type: "command", text: `$ ${input}` }]);
    setTerminalInput("");
    setIsExecuting(true);

    if (onCommand) {
      await onCommand(input, addLines, stdin);
    } else {
      addLines([{ type: "info", text: "(No execution backend connected)" }]);
    }

    setIsExecuting(false);
    inputRef.current?.focus();
  };

  const colorMap: Record<TerminalLine["type"], string> = {
    success: isDark ? "text-green-400" : "text-green-600",
    info:    isDark ? "text-gray-400"  : "text-gray-600",
    output:  isDark ? "text-white"     : "text-gray-900",
    error:   isDark ? "text-red-400"   : "text-red-600",
    command: isDark ? "text-cyan-400"  : "text-cyan-600",
  };

  const tabs = ["terminal", "stdin", "output", "problems"] as const;

  return (
    <div className={`h-56 border-t flex flex-col overflow-hidden flex-shrink-0 transition-colors duration-300 ${
      isDark ? "bg-[#050816] border-[#1E293B]" : "bg-gray-50 border-gray-200"
    }`}>
      {/* Tab bar */}
      <div className={`h-14 border-b flex items-center px-6 gap-2 flex-shrink-0 transition-colors duration-300 ${
        isDark ? "border-[#1E293B] bg-[#0B1120]" : "border-gray-200 bg-white"
      }`}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 capitalize ${
              activeTab === tab
                ? isDark ? "bg-[#1E293B] text-cyan-400" : "bg-gray-200 text-cyan-600"
                : isDark ? "text-gray-400 hover:bg-[#1E293B] hover:text-white"
                         : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {tab === "stdin" ? "Stdin" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {/* Show dot if stdin has content */}
            {tab === "stdin" && stdin.trim() && (
              <span className="ml-1 inline-block w-2 h-2 rounded-full bg-cyan-500 align-middle" />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className={`flex-1 overflow-hidden font-mono text-sm transition-colors duration-300 ${
        isDark ? "bg-[#020617]" : "bg-white"
      }`}>

        {/* Terminal tab */}
        {activeTab === "terminal" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto p-4 space-y-1">
              {terminalHistory.map((line, i) => (
                <p key={i} className={colorMap[line.type]} style={{ whiteSpace: "pre-wrap" }}>
                  {line.text}
                </p>
              ))}
              {isExecuting && (
                <p className={`animate-pulse ${isDark ? "text-yellow-400" : "text-yellow-600"}`}>
                  Running...
                </p>
              )}
              <div ref={bottomRef} />
            </div>
            <form
              onSubmit={handleTerminalSubmit}
              className={`flex items-center gap-2 px-4 py-2 border-t transition-colors duration-300 ${
                isDark ? "border-[#1E293B] bg-[#0B1120]" : "border-gray-200 bg-gray-50"
              }`}
            >
              <span className={isDark ? "text-cyan-400" : "text-cyan-600"}>$</span>
              <input
                ref={inputRef}
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder={isExecuting ? "Running..." : "python3 main.py  |  node app.js  |  help"}
                disabled={isExecuting}
                className={`flex-1 bg-transparent outline-none transition-colors duration-300 ${
                  isDark ? "text-white placeholder-gray-600" : "text-gray-900 placeholder-gray-400"
                } ${isExecuting ? "opacity-50 cursor-not-allowed" : ""}`}
                autoComplete="off"
                spellCheck={false}
              />
            </form>
          </div>
        )}

        {/* Stdin tab */}
        {activeTab === "stdin" && (
          <div className="flex flex-col h-full p-3 gap-2">
            <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Type your program inputs here — one per line. These will be passed to your program when you click <span className="text-cyan-500 font-semibold">Run</span> or run from the terminal.
            </p>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder={"e.g.\nJohn\n25\nHello World"}
              className={`flex-1 w-full resize-none rounded-xl p-3 outline-none text-sm font-mono transition-colors duration-300 ${
                isDark
                  ? "bg-[#0B1120] border border-[#1E293B] text-white placeholder-gray-600"
                  : "bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400"
              }`}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        )}

        {/* Output tab */}
        {activeTab === "output" && (
          <div className="p-4 space-y-1 overflow-auto h-full">
            {outputLines.length === 0 ? (
              <p className={isDark ? "text-gray-500" : "text-gray-400"}>
                No output yet. Press <span className="text-cyan-500 font-semibold">Run</span> to execute your code.
              </p>
            ) : (
              outputLines.map((line, i) => (
                <p key={i} className={colorMap[line.type]} style={{ whiteSpace: "pre-wrap" }}>
                  {line.text}
                </p>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Problems tab */}
        {activeTab === "problems" && (
          <div className="p-4">
            <p className={isDark ? "text-green-400" : "text-green-600"}>
              ✓ No problems detected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
