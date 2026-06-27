"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/ThemeContext";

export default function Sidebar() {
  const router = useRouter();
  const { isDark } = useTheme();

  return (
    <aside className="flex items-center justify-center px-8 py-6 flex-shrink-0">
      <button
        onClick={() => router.push("/dashboard")}
        className="hover:opacity-80 transition-opacity"
        title="Go to lobby"
      >
        <Image
          src={isDark ? "/logo-dark.svg" : "/logo-light.svg"}
          alt="ForgeIDE"
          width={64}
          height={32}
          className="object-contain"
        />
      </button>
    </aside>
  );
}
