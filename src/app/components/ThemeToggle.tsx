"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 🛡️ Next.js Hydration Mismatch রোধ করার জন্য এই ট্রিকটি জরুরি
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // মাউন্ট হওয়ার আগে একটি সুন্দর স্কেলিটন বা ফাঁকা বাটন দেখাবে
    return <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700"></div>;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-95"
      title="Toggle Theme"
    >
      {theme === "dark" ? (
        // Sun Icon (লাইট মোডে যাওয়ার জন্য)
        <svg className="w-5 h-5 animate-in spin-in duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Moon Icon (ডার্ক মোডে যাওয়ার জন্য)
        <svg className="w-5 h-5 animate-in spin-in duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}