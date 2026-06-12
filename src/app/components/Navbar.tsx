"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  return (
    <header className="h-20 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md fixed top-0 w-full z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight">
            Mess Pro
          </h1>
        </Link>

        {/* Right Side Actions */}
        <div className="flex items-center gap-6">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 px-5 py-2.5 rounded-full font-medium text-sm transition-all shadow-sm"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </header>
  );
}