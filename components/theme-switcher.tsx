"use client";

import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    setToast(`Switched to ${next} mode`);
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={toggle}>
        {isDark ? (
          <Moon key="dark" size={16} className="text-muted-foreground" />
        ) : (
          <Sun key="light" size={16} className="text-muted-foreground" />
        )}
      </Button>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-lg bg-surface border border-app-border shadow-lg text-sm text-heading animate-in fade-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}
    </>
  );
};

export { ThemeSwitcher };
