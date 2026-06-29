export interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
}

// Judge0 CE language IDs
const JUDGE0_LANG_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  typescript: 74,
  java: 62,
  cpp: 54,
  c: 50,
  csharp: 51,
  go: 60,
  rust: 73,
  php: 68,
  ruby: 72,
  swift: 83,
  kotlin: 78,
  bash: 46,
  r: 80,
};

function getLanguageId(fileName: string): number | null {
  if (fileName.endsWith(".py")) return JUDGE0_LANG_IDS.python;
  if (fileName.endsWith(".js")) return JUDGE0_LANG_IDS.javascript;
  if (fileName.endsWith(".ts")) return JUDGE0_LANG_IDS.typescript;
  if (fileName.endsWith(".java")) return JUDGE0_LANG_IDS.java;
  if (fileName.endsWith(".cpp") || fileName.endsWith(".cc")) return JUDGE0_LANG_IDS.cpp;
  if (fileName.endsWith(".c")) return JUDGE0_LANG_IDS.c;
  if (fileName.endsWith(".cs")) return JUDGE0_LANG_IDS.csharp;
  if (fileName.endsWith(".go")) return JUDGE0_LANG_IDS.go;
  if (fileName.endsWith(".rs")) return JUDGE0_LANG_IDS.rust;
  if (fileName.endsWith(".php")) return JUDGE0_LANG_IDS.php;
  if (fileName.endsWith(".rb")) return JUDGE0_LANG_IDS.ruby;
  if (fileName.endsWith(".swift")) return JUDGE0_LANG_IDS.swift;
  if (fileName.endsWith(".kt")) return JUDGE0_LANG_IDS.kotlin;
  if (fileName.endsWith(".sh")) return JUDGE0_LANG_IDS.bash;
  if (fileName.endsWith(".r") || fileName.endsWith(".R")) return JUDGE0_LANG_IDS.r;
  return null;
}

// All execution goes through our backend proxy — API key stays server-side
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

export async function executeCode(
  fileName: string,
  code: string,
  stdin: string = ""
): Promise<ExecutionResult> {
  const languageId = getLanguageId(fileName);

  if (!languageId) {
    return {
      output: "",
      error: `Unsupported file type: ${fileName}`,
      exitCode: 1,
    };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin,
      }),
    });

    if (response.status === 429) {
      return {
        output: "",
        error: "Rate limit reached. Please wait a moment before running again.",
        exitCode: 1,
      };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    return {
      output: result.stdout || "",
      error: result.stderr || result.compile_output || "",
      exitCode: result.status?.id === 3 ? 0 : 1,
    };
  } catch (err) {
    return {
      output: "",
      error: `Execution failed: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: 1,
    };
  }
}
