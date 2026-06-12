"use client";

import Link from "next/link";
import React from "react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* ========================================== */}
      {/* 🧭 NAVIGATION BAR */}
      {/* ========================================== */}
      <nav className="fixed w-full z-50 bg-white/70 dark:bg-[#0B1120]/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-sm">M</span>
            </div>
            <span className="text-xl font-black tracking-tight">Mess<span className="text-indigo-600 dark:text-indigo-400">Master</span></span>
          </div>

          {/* Desktop Links (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600 dark:text-slate-300">
            <Link href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">How it Works</Link>
            <Link href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Pricing</Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-2"
            >
              Sign In
            </Link>
            <Link 
              href="/register" 
              className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-black rounded-xl hover:shadow-lg hover:shadow-slate-900/20 dark:hover:shadow-white/20 transition-all active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ========================================== */}
      {/* 🚀 HERO SECTION */}
      {/* ========================================== */}
      <main className="flex-grow pt-32 pb-20 relative">
        {/* Abstract Background Glows */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>

        <div className="max-w-7xl mx-auto px-6 text-center mt-10 md:mt-20">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Mess Management Reimagined
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1] max-w-4xl mx-auto">
            The intelligent way to manage your <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-500">Mess & Hostels.</span>
          </h1>
          
          <p className="mt-6 text-base md:text-lg font-medium text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Automate meal tracking, calculate complex bazaar expenses, and manage resident billing with zero errors. The all-in-one platform built for modern living spaces.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/register" 
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-2xl shadow-xl shadow-indigo-500/30 transition-all hover:-translate-y-1 active:scale-95"
            >
              Create Free Mess Account
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-sm font-black rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              Member Login
            </Link>
          </div>
        </div>

        {/* ========================================== */}
        {/* ✨ FEATURES SECTION */}
        {/* ========================================== */}
        <div id="features" className="max-w-7xl mx-auto px-6 mt-32">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center text-xl mb-6">
                🍽️
              </div>
              <h3 className="text-xl font-black mb-3 text-slate-900 dark:text-white">Daily Meal Matrix</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Residents can easily update their daily meals. The system locks editing after a specific time to ensure accurate bazaar planning.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center text-xl mb-6">
                💰
              </div>
              <h3 className="text-xl font-black mb-3 text-slate-900 dark:text-white">Pure Financials</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Separated meal funds and mess rents. Managers can track bazaar expenses while calculating the exact meal rate automatically.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center text-xl mb-6">
                ⚡
              </div>
              <h3 className="text-xl font-black mb-3 text-slate-900 dark:text-white">Real-Time Sync</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Powered by Supabase Realtime. Get instant notifications for deposit approvals, billing invoices, and urgent manager notices.
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* ========================================== */}
      {/* 🏢 PROFESSIONAL FOOTER */}
      {/* ========================================== */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] pt-16 pb-8 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <span className="text-white font-black text-[10px]">M</span>
                </div>
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">MessMaster</span>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed pr-4">
                The ultimate solution for managing mess operations, financials, and residents in one place.
              </p>
            </div>

            <div>
              <h4 className="font-black text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Pricing</Link></li>
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Updates</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Resources</h4>
              <ul className="space-y-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Documentation</Link></li>
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Help Center</Link></li>
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Contact Support</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Legal</h4>
              <ul className="space-y-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>

          </div>
          
          <div className="border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} MessMaster Inc. All rights reserved.
            </p>
            <div className="flex gap-4 text-slate-400">
              <span className="cursor-pointer hover:text-indigo-500 transition-colors">Twitter</span>
              <span className="cursor-pointer hover:text-indigo-500 transition-colors">GitHub</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}