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
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setIsMounted(true);
    
    // Set time-based greeting
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

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
      setProfile(profileData || { full_name: "Resident", role: "user" });

      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      const todayStr = today.toISOString().split("T")[0];
      const currentMonth = todayStr.substring(0, 7);
      
      const { data: mealData } = await supabase.from("daily_meals").select("*").eq("user_id", user.id).eq("date", todayStr).maybeSingle();
      if (mealData) setMyMeal(mealData);

      // Fetch Admin Summary ONLY if the user is admin or super_admin
      if (profileData?.role !== "user") {
        const { count: memberCount } = await supabase.from("profiles").select("*", { count: 'exact', head: true });
        
        const { data: activeMeals } = await supabase.from("daily_meals").select("lunch, dinner, breakfast, guest_lunch, guest_dinner").eq("date", todayStr);
        const activeCount = activeMeals?.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0) || 0;
        
        // Fixed: Use 'date' instead of 'created_at' to match the isolated expense ledger logic
        const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_type", "meal").like("date", `${currentMonth}%`);
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
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-5 animate-in fade-in duration-500">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-indigo-200 dark:border-slate-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Dashboard Core...</p>
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
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-8 animate-fade-in z-0 pb-12 px-4 md:px-0">
      
      {/* 🌟 Background Glowing Effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full filter blur-[120px] pointer-events-none -z-10 animate-pulse duration-1000"></div>
      <div className="absolute bottom-20 right-10 w-[400px] h-[400px] bg-purple-500/10 dark:bg-purple-500/5 rounded-full filter blur-[100px] pointer-events-none -z-10"></div>
      
      {/* 🎯 PREMIUM WELCOME BANNER */}
      <div className="relative bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-10 rounded-[2.5rem] border border-white/60 dark:border-slate-700/50 shadow-2xl overflow-hidden group">
        <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/20 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
          <div className="flex items-center gap-5 md:gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-3xl md:text-4xl shadow-xl shadow-indigo-500/30 border-4 border-white dark:border-slate-800 rotate-3 group-hover:rotate-0 transition-transform duration-300">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-[1.75rem]" />
              ) : (
                profile?.full_name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div>
              <p className="text-[11px] md:text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">
                {greeting},
              </p>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                {profile?.full_name || "Resident"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-3">
                <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider border border-slate-200 dark:border-slate-700 shadow-sm">
                  Room: {profile?.room_number || "N/A"}
                </span>
                <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                  Role: {profile?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          
          {/* Quick Date Display */}
          <div className="hidden md:flex flex-col items-end text-right">
             <p className="text-4xl font-black text-slate-800 dark:text-slate-200">{new Date().getDate()}</p>
             <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* 👑 ADMIN GLANCE SUMMARY (Only visible to managers/admins) */}
      {profile?.role !== "user" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-fade-in delay-100">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 md:p-8 rounded-[2rem] shadow-xl shadow-indigo-500/20 text-white flex justify-between items-center relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
            <div className="absolute -right-4 -top-4 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500">👥</div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Total Mess Members</p>
              <h3 className="text-4xl font-black">{summary.totalMembers} <span className="text-sm font-normal text-indigo-200 tracking-normal">users</span></h3>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 md:p-8 rounded-[2rem] shadow-xl shadow-emerald-500/20 text-white flex justify-between items-center relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
            <div className="absolute -right-4 -top-4 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500">🍽️</div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-1">Today's Active Meals</p>
              <h3 className="text-4xl font-black">{summary.activeMealsToday.toFixed(1)} <span className="text-sm font-normal text-emerald-100 tracking-normal">portions</span></h3>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 md:p-8 rounded-[2rem] shadow-xl shadow-orange-500/20 text-white flex justify-between items-center relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
            <div className="absolute -right-4 -top-4 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-500">🛒</div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-200 mb-1">Current Month Bazaar</p>
              <h3 className="text-4xl font-black tracking-tighter">৳ {summary.monthlyBazaar.toLocaleString()}</h3>
            </div>
          </div>
        </div>
      )}

      {/* 📊 PERSONAL METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-fade-in delay-200">
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-2xl shadow-inner group-hover:scale-110 transition-transform">💰</div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Meal Fund</p>
          <h3 className="text-3xl md:text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tighter">৳ {(profile?.balance || 0).toLocaleString()}</h3>
        </div>
        
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform ${totalDues > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>🧾</div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Fixed Invoice</p>
          <h3 className={`text-3xl md:text-4xl font-black mt-1 tracking-tighter ${totalDues > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>৳ {totalDues.toLocaleString()}</h3>
        </div>
        
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-2xl shadow-inner group-hover:scale-110 transition-transform">🍱</div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Meal Entry</p>
          <h3 className="text-3xl md:text-4xl font-black text-indigo-600 dark:text-indigo-400 mt-1 tracking-tighter">{todayTotalMeals.toFixed(1)} <span className="text-sm font-normal text-slate-400 tracking-normal">portions</span></h3>
        </div>
      </div>

      {/* 🚀 QUICK UTILITIES & APP TILES */}
      <div className="bg-white/50 dark:bg-[#0F172A]/50 backdrop-blur-3xl p-6 md:p-8 rounded-[2.5rem] border border-white/40 dark:border-slate-700/50 shadow-2xl animate-fade-in delay-300">
        <div className="flex items-center gap-3 mb-6">
           <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></div>
           <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Quick Applications</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          <Link href="/dashboard/deposits" className="group p-5 md:p-6 bg-white dark:bg-slate-800/80 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-md hover:shadow-xl hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors"></div>
            <div className="text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">💰</div> 
            <span className="font-black text-[10px] md:text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 text-center">Meal Deposits</span>
          </Link>
          
          <Link href="/dashboard/expenses" className="group p-5 md:p-6 bg-white dark:bg-slate-800/80 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-md hover:shadow-xl hover:border-rose-500/50 dark:hover:border-rose-500/50 transition-all duration-300 hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-rose-500/0 group-hover:bg-rose-500/5 transition-colors"></div>
            <div className="text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">📉</div> 
            <span className="font-black text-[10px] md:text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 text-center">Expenses Log</span>
          </Link>
          
          <Link href="/dashboard/meals" className="group p-5 md:p-6 bg-white dark:bg-slate-800/80 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-md hover:shadow-xl hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/5 transition-colors"></div>
            <div className="text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">🍱</div> 
            <span className="font-black text-[10px] md:text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 text-center">Meal Control</span>
          </Link>
          
          <Link href="/dashboard/billing" className="group p-5 md:p-6 bg-white dark:bg-slate-800/80 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-md hover:shadow-xl hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors"></div>
            <div className="text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">🗂️</div> 
            <span className="font-black text-[10px] md:text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 text-center">Billing Ledger</span>
          </Link>
          
          <Link href="/dashboard/bazaar-planner" className="group p-5 md:p-6 bg-white dark:bg-slate-800/80 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-md hover:shadow-xl hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-center gap-3 relative overflow-hidden sm:col-span-2 lg:col-span-1">
            <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors"></div>
            <div className="text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">🛒</div> 
            <span className="font-black text-[10px] md:text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 text-center">Bazaar Planner</span>
          </Link>
        </div>
      </div>

    </div>
  );
}