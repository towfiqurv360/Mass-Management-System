"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardOverview() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // States
  const [profile, setProfile] = useState<any>(null);
  const [todayMeal, setMyMeal] = useState<any>(null);
  const [summary, setSummary] = useState({ totalMembers: 0, activeMealsToday: 0, monthlyBazaar: 0 });
  
  // Premium Dropdown State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchDashboardData();

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profileData) setProfile(profileData);

      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      const todayStr = today.toISOString().split("T")[0];
      
      const { data: mealData } = await supabase.from("daily_meals").select("*").eq("user_id", user.id).eq("date", todayStr).maybeSingle();
      if (mealData) setMyMeal(mealData);

      if (profileData?.role !== "user") {
        const { count: memberCount } = await supabase.from("profiles").select("*", { count: 'exact', head: true });
        const { data: activeMeals } = await supabase.from("daily_meals").select("lunch, dinner, breakfast").eq("date", todayStr);
        
        const activeCount = activeMeals?.filter(m => Number(m.lunch) > 0 || Number(m.dinner) > 0 || Number(m.breakfast) > 0).length || 0;
        
        const currentMonth = todayStr.substring(0, 7);
        const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_type", "meal").like("created_at", `${currentMonth}%`);
        const totalBazaar = expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

        setSummary({
          totalMembers: memberCount || 0,
          activeMealsToday: activeCount,
          monthlyBazaar: totalBazaar
        });
      }
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!isMounted) return null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Matrix...</p>
      </div>
    );
  }

  // Financial Variables
  const rent = Number(profile?.current_month_rent || 0);
  const maid = Number(profile?.current_month_maid || 0);
  const wifi = Number(profile?.current_month_wifi || 0);
  const electricity = Number(profile?.current_month_electricity || 0);
  const totalDues = rent + maid + wifi + electricity;

  const todayTotalMeals = todayMeal ? (Number(todayMeal.lunch || 0) + Number(todayMeal.dinner || 0) + Number(todayMeal.breakfast || 0) + Number(todayMeal.guest_lunch || 0) + Number(todayMeal.guest_dinner || 0)) : 0;

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-8 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Premium Background Glows */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      {/* ========================================== */}
      {/* 🎯 NEW TOP NAVIGATION BANNER & DROPDOWN 🎯 */}
      {/* ========================================== */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-4 md:p-6 rounded-[2.5rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex justify-between items-center relative z-50">
        
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Welcome, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">{profile?.full_name?.split(' ')[0] || "Border"}</span>
          </h1>
          <p className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider">
            Room: <span className="text-indigo-500 font-bold">{profile?.room_number || "N/A"}</span> • Rank: <span className="text-purple-500 font-bold">{profile?.role?.replace('_', ' ')}</span>
          </p>
        </div>

        {/* PRO-LEVEL AVATAR & DROPDOWN MENU */}
        <div className="relative" ref={menuRef}>
          {/* Avatar Trigger Button */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 p-1.5 pr-4 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all active:scale-95 group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white shadow-lg overflow-hidden shrink-0 border-2 border-white dark:border-slate-900">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                profile?.full_name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">My Profile</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Options ⏷</p>
            </div>
          </button>

          {/* Elegant Dropdown Modal */}
          <div className={`absolute right-0 mt-3 w-64 bg-white dark:bg-[#0F172A]/95 backdrop-blur-3xl border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-2xl p-3 transition-all duration-300 transform origin-top-right ${
            isMenuOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 -translate-y-4 pointer-events-none"
          }`}>
            
            <div className="px-3 pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Navigation Menu</p>
            </div>

            <ul className="space-y-1">
              <li>
                <Link href="/dashboard/profile" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">
                  <span className="text-indigo-500">⚙️</span> Profile Settings
                </Link>
              </li>
              <li>
                <Link href="/dashboard/meals" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">
                  <span className="text-rose-500">🍱</span> Daily Meal Control
                </Link>
              </li>
              <li>
                <Link href="/dashboard/bazaar-planner" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">
                  <span className="text-emerald-500">🛒</span> Bazaar Planner
                </Link>
              </li>
              
              {profile?.role !== 'user' && (
                <>
                  <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                  <li>
                    <Link href="/dashboard/members" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">
                      <span className="text-purple-500">👥</span> Resident Directory
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard/deposits" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">
                      <span className="text-blue-500">💰</span> Fund Deposits
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard/billing" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors">
                      <span className="text-amber-500">🗂️</span> Billing & Invoice
                    </Link>
                  </li>
                </>
              )}
            </ul>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 text-sm font-black uppercase tracking-wider transition-colors">
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* ========================================== */}
      {/* CORE FINANCIALS GRID (User View) */}
      {/* ========================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 dark:border-slate-800/80 shadow-xl relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Available Dining Funds</p>
          <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">৳ {(profile?.balance || 0).toLocaleString()}</h3>
          <p className="text-[11px] font-semibold text-slate-500 mt-2">Current active meal balance for bazaar deductions.</p>
          <div className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">৳</div>
        </div>

        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 dark:border-slate-800/80 shadow-xl relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pending Mess Invoice</p>
          <h3 className={`text-3xl font-black mt-2 ${totalDues > 0 ? 'text-rose-500' : 'text-slate-400'}`}>৳ {totalDues.toLocaleString()}</h3>
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${profile?.billing_status === 'pending_payment' ? 'bg-rose-100 text-rose-700' : profile?.billing_status === 'under_review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {profile?.billing_status?.replace('_', ' ') || 'CLEAR'}
            </span>
          </div>
          <div className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">💳</div>
        </div>

        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 dark:border-slate-800/80 shadow-xl relative overflow-hidden transition-transform duration-300 hover:-translate-y-1">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Today's Meal Registry</p>
          <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{todayTotalMeals.toFixed(1)} <span className="text-xs font-normal text-slate-400">portions</span></h3>
          <p className="text-[11px] font-semibold text-slate-500 mt-2">
            {todayMeal?.is_locked ? "🔒 Securely locked for today" : "🔓 Open for scheduled window modifications"}
          </p>
          <div className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">🍽️</div>
        </div>

      </div>

      {/* ========================================== */}
      {/* EXTRA ADMINISTRATIVE OVERVIEW (Managers Only) */}
      {/* ========================================== */}
      {profile?.role !== "user" && (
        <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Management Operational Overview</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-lg">
              <div>
                <p className="text-[10px] font-bold uppercase opacity-60 tracking-wider">Total Active Borders</p>
                <h4 className="text-xl font-black mt-1">{summary.totalMembers} Registered</h4>
              </div>
              <span className="text-xl">👥</span>
            </div>

            <div className="bg-white/50 dark:bg-[#0F172A]/50 backdrop-blur-xl p-5 rounded-2xl border border-white/40 dark:border-slate-800 shadow-md flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Mess Diners Today</p>
                <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{summary.activeMealsToday} Active</h4>
              </div>
              <span className="text-xl">🔥</span>
            </div>

            <div className="bg-white/50 dark:bg-[#0F172A]/50 backdrop-blur-xl p-5 rounded-2xl border border-white/40 dark:border-slate-800 shadow-md flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Accumulated Bazaar Expense</p>
                <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">৳ {summary.monthlyBazaar.toLocaleString()}</h4>
              </div>
              <span className="text-xl">🛒</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}