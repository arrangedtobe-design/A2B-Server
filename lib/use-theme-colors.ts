"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { themes, type ThemeColorSet } from "@/lib/theme-colors";

export function useThemeColors(): ThemeColorSet {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Before mount, resolvedTheme is undefined — default to light
  // After mount, derive colors directly from resolvedTheme (no useEffect delay)
  return mounted ? themes[resolvedTheme === "dark" ? "dark" : "light"] : themes.light;
}
