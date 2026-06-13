"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import ThemeToggle from "../components/ThemeToggle";
import NotificationBell from "../components/NotificationBell";
import ProfileModal from "../components/ProfileModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState("user");
  const [userId, setUserId] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuthAndRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setUserRole(profile?.role || "user");
    };
    checkAuthAndRole();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 🎯 Enterprise Navigation Links (History Archives Added Perfectly)
  const navItems = [
    { name: "Overview", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { name: "Meal Control", href: "/dashboard/meals", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
    { name: "Deposits & Receipts", href: "/dashboard/deposits", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { name: "Expenses", href: "/dashboard/expenses", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { name: "Notice Board", href: "/dashboard/notices", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
    { name: "Monthly Billing", href: "/dashboard/billing", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
    { name: "Bazaar Planner", href: "/dashboard/bazaar-planner", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    // 🚀 NEW HISTORY MODULE: Premium Open Book Icon Added
    { name: "History Archives", href: "/dashboard/history", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" }
  ];

  if (userRole === "super_admin") {
    navItems.push({ 
      name: "Border Management", 
      href: "/dashboard/users", 
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
    });
  }

  return (
    <div className="h-[100dvh] bg-[#F8FAFC] dark:bg-[#0B1120] flex transition-colors duration-300 overflow-hidden">
      
      {/* 📱 Mobile Menu Overlay with Blur Animation */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity cursor-pointer animate-fade-in" 
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* 🧭 Sidebar Navigation */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-[100dvh] bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        
        {/* Brand Logo */}
        <div className="h-24 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-2xl leading-none tracking-tighter">M</span>
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none">Mess Pro</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Enterprise Edition</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-rose-500 transition-colors cursor-pointer bg-slate-50 dark:bg-slate-800 p-2 rounded-xl" onClick={() => setIsMobileMenuOpen(false)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-4">Core Modules</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ease-in-out cursor-pointer group ${
                  isActive 
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-500/20" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1E293B] border border-transparent"
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? "bg-indigo-100 dark:bg-indigo-500/20" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"}`}>
                  <svg className={`w-4 h-4 transition-colors duration-200 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon} />
                  </svg>
                </div>
                <span className="tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Logout Button */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/50 pb-8 md:pb-4 shrink-0 bg-white dark:bg-[#0F172A]">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl font-black uppercase tracking-widest text-[11px] text-slate-600 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-all duration-200 cursor-pointer border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Secure Sign Out
          </button>
        </div>
      </aside>

      {/* 🖥️ Main Content Area */}
      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        
        {/* 🔝 Top Header */}
        <header className="h-24 bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between px-6 lg:px-10 z-30 transition-colors duration-300 shrink-0">
          
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2.5 -ml-2 text-slate-600 dark:text-slate-300 cursor-pointer rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h8" />
              </svg>
            </button>
            
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 hidden sm:block tracking-tight">
                {navItems.find(item => item.href === pathname)?.name || "Dashboard"}
              </h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block mt-0.5">Workspace Management</p>
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-200 dark:border-slate-700">
              {userId && <NotificationBell userId={userId} />}
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
              <ThemeToggle />
            </div>
            <ProfileModal />
          </div>
        </header>

        {/* 📄 Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 scroll-smooth custom-scrollbar animate-fade-in relative z-0">
          {children}
        </main>
      </div>

    </div>
  );
}