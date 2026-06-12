"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // Adjust path as needed
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardOverview() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [profile, setProfile] = useState<any>(null);
  const [todayMeal, setMyMeal] = useState<any>(null);
  const [summary, setSummary] = useState({ totalMembers: 0, activeMealsToday: 0, monthlyBazaar: 0 });

  useEffect(() => {
    setIsMounted(true);
    fetchDashboardData();
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
      setProfile(profileData || { full_name: "Border", role: "user" });

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

        setSummary({ totalMembers: memberCount || 0, activeMealsToday: activeCount, monthlyBazaar: totalBazaar });
      }
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Dashboard Core...</p>
      </div>
    );
  }

  const rent = Number(profile?.current_month_rent || 0);
  const maid = Number(profile?.current_month_maid || 0);
  const wifi = Number(profile?.current_month_wifi || 0);
  const electricity = Number(profile?.current_month_electricity || 0);
  const totalDues = rent + maid + wifi + electricity;
  const todayTotalMeals = todayMeal ? (Number(todayMeal.lunch || 0) + Number(todayMeal.dinner || 0) + Number(todayMeal.breakfast || 0)) : 0;

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-8 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Background Glowing Effects */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-full filter blur-3xl pointer-events-none -z-10 animate-pulse"></div>
      
      {/* 🎯 SIMPLE WELCOME BANNER (No extra menus here) */}
      <div className="bg-white/60 dark:bg-[#0F172A]/60 backdrop-blur-2xl p-6 md:p-8 rounded-[2.5rem] border border-white/50 dark:border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-2xl shadow-lg border-2 border-white dark:border-slate-800">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              profile?.full_name?.charAt(0).toUpperCase() || "U"
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Welcome, <span className="text-indigo-600 dark:text-indigo-400">{profile?.full_name || "Resident"}</span>
            </h1>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
              Room: <span className="text-indigo-600 dark:text-indigo-400">{profile?.room_number || "N/A"}</span> • Role: <span className="text-purple-500">{profile?.role?.replace('_', ' ')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 📊 METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 dark:border-slate-800/80 shadow-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Meal Fund</p>
          <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">৳ {(profile?.balance || 0).toLocaleString()}</h3>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 dark:border-slate-800/80 shadow-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Mess Invoice</p>
          <h3 className={`text-3xl font-black mt-2 ${totalDues > 0 ? 'text-rose-500' : 'text-slate-400'}`}>৳ {totalDues.toLocaleString()}</h3>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 dark:border-slate-800/80 shadow-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Meal Entry</p>
          <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{todayTotalMeals.toFixed(1)} <span className="text-xs font-normal text-slate-400">portions</span></h3>
        </div>
      </div>

      {/* 🚀 QUICK UTILITIES & LINKS */}
      <div className="bg-white/40 dark:bg-[#0F172A]/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/30 dark:border-slate-800 shadow-xl">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Quick Navigation Links</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Link href="/dashboard/deposits" className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm text-center font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-all hover:-translate-y-1 active:scale-95">
            <div className="text-xl mb-1">💰</div> Meal Deposits
          </Link>
          <Link href="/dashboard/expenses" className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm text-center font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-rose-500 transition-all hover:-translate-y-1 active:scale-95">
            <div className="text-xl mb-1">📉</div> Expenses Log
          </Link>
          <Link href="/dashboard/meals" className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm text-center font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-purple-500 transition-all hover:-translate-y-1 active:scale-95">
            <div className="text-xl mb-1">🍱</div> Meal Control
          </Link>
          <Link href="/dashboard/billing" className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm text-center font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-amber-500 transition-all hover:-translate-y-1 active:scale-95">
            <div className="text-xl mb-1">🗂️</div> Billing Ledger
          </Link>
          <Link href="/dashboard/bazaar-planner" className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm text-center font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition-all hover:-translate-y-1 active:scale-95">
            <div className="text-xl mb-1">🛒</div> Bazaar Planner
          </Link>
        </div>
      </div>

    </div>
  );
}