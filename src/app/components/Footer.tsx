"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          &copy; {currentYear} Mess Manager Pro. All rights reserved.
        </p>
        <div className="flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
          <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms of Service</Link>
          <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
