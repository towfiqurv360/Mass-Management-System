"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

const getLocalToday = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().split("T")[0];
};

export default function MealControlPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const realTimeToday = getLocalToday();
  const [selectedDate, setSelectedDate] = useState(realTimeToday);

  // System Settings for Time Window
  const [timeWindow, setTimeWindow] = useState({ start: "20:00", end: "22:00" });
  const [isTimeLocked, setIsTimeLocked] = useState(false);

  // User's Personal Meal State
  const [myMeal, setMyMeal] = useState({ 
    breakfast: 0, lunch: 0, dinner: 0, 
    guest_lunch: 0, guest_dinner: 0,
    is_locked: false,
    unlock_requested: false
  });

  // Chart Data State
  const [monthStats, setMonthStats] = useState({ lunch: 0, dinner: 0, breakfast: 0 });

  // Admin State
  const [allMeals, setAllMeals] = useState<any[]>([]);
  const [totalBazaar, setTotalBazaar] = useState(0);
  const [totalMealsMonth, setTotalMealsMonth] = useState(0);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  useEffect(() => {
    checkTimeLock();
    const interval = setInterval(checkTimeLock, 60000);
    return () => clearInterval(interval);
  }, [selectedDate, timeWindow]);

  const checkTimeLock = () => {
    const now = new Date();
    const currentString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    if (selectedDate === realTimeToday) {
      if (currentString >= timeWindow.start && currentString <= timeWindow.end) {
        setIsTimeLocked(false);
      } else {
        setIsTimeLocked(true);
      }
    } else if (selectedDate < realTimeToday) {
      setIsTimeLocked(true);
    } else {
      setIsTimeLocked(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUser(user);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const role = profile?.role || "user";
      setUserRole(role);

      const { data: settings } = await supabase.from("system_settings").select("meal_update_start, meal_update_end").eq("id", 1).maybeSingle();
      if (settings) {
        setTimeWindow(prev => {
          const newStart = settings.meal_update_start?.substring(0,5) || "20:00";
          const newEnd = settings.meal_update_end?.substring(0,5) || "22:00";
          if (prev.start !== newStart || prev.end !== newEnd) {
            return { start: newStart, end: newEnd };
          }
          return prev;
        });
      }

      let { data: myMealData } = await supabase.from("daily_meals").select("*").eq("user_id", user.id).eq("date", selectedDate).maybeSingle();
      
      if (myMealData) {
        setMyMeal({ 
          breakfast: Number(myMealData.breakfast || 0), 
          lunch: Number(myMealData.lunch || 0), 
          dinner: Number(myMealData.dinner || 0), 
          guest_lunch: Number(myMealData.guest_lunch || 0), 
          guest_dinner: Number(myMealData.guest_dinner || 0),
          is_locked: myMealData.is_locked || false,
          unlock_requested: myMealData.unlock_requested || false
        });
      } else {
        const yesterday = new Date(new Date(selectedDate).getTime() - 86400000).toISOString().split("T")[0];
        const { data: yesterdayMeal } = await supabase.from("daily_meals").select("lunch, dinner").eq("user_id", user.id).eq("date", yesterday).maybeSingle();
        
        let initLunch = yesterdayMeal ? Number(yesterdayMeal.lunch) : 0;
        let initDinner = yesterdayMeal ? Number(yesterdayMeal.dinner) : 0;
        let initBreakfast = (initLunch > 0 || initDinner > 0) ? 0.5 : 0;

        setMyMeal({ 
          breakfast: initBreakfast, lunch: initLunch, dinner: initDinner, 
          guest_lunch: 0, guest_dinner: 0, 
          is_locked: false, unlock_requested: false
        });
      }

      const currentMonth = selectedDate.substring(0, 7);
      const { data: monthMeals } = await supabase.from("daily_meals").select("breakfast, lunch, dinner").eq("user_id", user.id).like("date", `${currentMonth}%`);
      if (monthMeals) {
        const mLunch = monthMeals.reduce((a, b) => a + Number(b.lunch || 0), 0);
        const mDinner = monthMeals.reduce((a, b) => a + Number(b.dinner || 0), 0);
        const mBreak = monthMeals.reduce((a, b) => a + Number(b.breakfast || 0), 0);
        setMonthStats({ lunch: mLunch, dinner: mDinner, breakfast: mBreak });
      }

      if (role !== "user") {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, room_number");
        const { data: mealsDate } = await supabase.from("daily_meals").select("*").eq("date", selectedDate);
        
        if (profiles) {
          const combined = profiles.map(p => {
            const m = mealsDate?.find(meal => meal.user_id === p.id);
            const l = Number(m?.lunch || 0);
            const d = Number(m?.dinner || 0);
            const b = Number(m?.breakfast || 0);
            const isActive = (l > 0 || d > 0 || b > 0);
            
            return {
              ...m,
              user_id: p.id, full_name: p.full_name, room_number: p.room_number,
              lunch: l, dinner: d, breakfast: b,
              guest_lunch: Number(m?.guest_lunch || 0), guest_dinner: Number(m?.guest_dinner || 0),
              is_locked: m?.is_locked || false, unlock_requested: m?.unlock_requested || false,
              isActive: isActive
            };
          });
          setAllMeals(combined);
        }

        const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_type", "meal").like("created_at", `${currentMonth}%`);
        setTotalBazaar(expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0);

        const { data: allMonthMeals } = await supabase.from("daily_meals").select("breakfast, lunch, dinner, guest_lunch, guest_dinner").like("date", `${currentMonth}%`);
        const totalM = allMonthMeals?.reduce((acc, curr) => acc + Number(curr.breakfast || 0) + Number(curr.lunch || 0) + Number(curr.dinner || 0) + Number(curr.guest_lunch || 0) + Number(curr.guest_dinner || 0), 0) || 0;
        setTotalMealsMonth(totalM);
      }
    } catch (error) {
      toast.error("An error occurred while loading data.");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: "full_on" | "full_off" | "only_lunch" | "only_dinner") => {
    if (myMeal.is_locked || isTimeLocked) return;
    if (preset === "full_on") setMyMeal(prev => ({ ...prev, lunch: 1, dinner: 1, breakfast: 0.5 }));
    if (preset === "full_off") setMyMeal(prev => ({ ...prev, lunch: 0, dinner: 0, breakfast: 0 }));
    if (preset === "only_lunch") setMyMeal(prev => ({ ...prev, lunch: 1, dinner: 0, breakfast: 0.5 }));
    if (preset === "only_dinner") setMyMeal(prev => ({ ...prev, lunch: 0, dinner: 1, breakfast: 0.5 }));
  };

  const adjustGuestMeal = (field: "guest_lunch" | "guest_dinner", amount: number) => {
    if (myMeal.is_locked || isTimeLocked) return;
    setMyMeal(prev => ({ ...prev, [field]: Math.max(0, prev[field] + amount) }));
  };

  const handleSaveMeal = async () => {
    if (myMeal.is_locked || isTimeLocked) return toast.error("Time window closed or meal locked.");
    const toastId = toast.loading("Securing meal status...");
    setActionLoading(true);
    try {
      const { error } = await supabase.from("daily_meals").upsert({
        user_id: currentUser.id, date: selectedDate,
        breakfast: myMeal.breakfast, lunch: myMeal.lunch, dinner: myMeal.dinner,
        guest_lunch: myMeal.guest_lunch, guest_dinner: myMeal.guest_dinner,
        is_locked: true, unlock_requested: false
      }, { onConflict: 'user_id, date' });

      if (error) throw error;
      toast.success("Meal Status Saved Successfully!", { id: toastId });
      setMyMeal(prev => ({ ...prev, is_locked: true }));
      fetchData();
    } catch (error: any) {
      toast.error("Failed to save.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlockRequest = async () => {
    const toastId = toast.loading("Sending Request...");
    try {
      await supabase.from("daily_meals").update({ unlock_requested: true }).eq("user_id", currentUser.id).eq("date", selectedDate);
      toast.success("Unlock Request Sent!", { id: toastId });
      setMyMeal(prev => ({ ...prev, unlock_requested: true }));
    } catch (error) {
      toast.error("Request failed.", { id: toastId });
    }
  };

  const updateTimeWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "admin" && userRole !== "super_admin") return;
    const toastId = toast.loading("Updating Configuration...");
    try {
      await supabase.from("system_settings").update({ meal_update_start: timeWindow.start + ":00", meal_update_end: timeWindow.end + ":00" }).eq("id", 1);
      toast.success("Time window configured!", { id: toastId });
      checkTimeLock();
    } catch (error) {
      toast.error("Update failed.", { id: toastId });
    }
  };

  const handleAdminAction = async (userId: string, field: string, value: any) => {
    try {
      const uMeal = allMeals.find(m => m.user_id === userId);
      await supabase.from("daily_meals").upsert({ 
        user_id: userId, date: selectedDate,
        breakfast: uMeal.breakfast, lunch: uMeal.lunch, dinner: uMeal.dinner,
        guest_lunch: uMeal.guest_lunch, guest_dinner: uMeal.guest_dinner,
        is_locked: uMeal.is_locked, unlock_requested: uMeal.unlock_requested,
        [field]: value 
      }, { onConflict: 'user_id, date' });
      
      setAllMeals(allMeals.map(m => {
        if (m.user_id === userId) {
          const updated = { ...m, [field]: value };
          updated.isActive = (updated.lunch > 0 || updated.dinner > 0 || updated.breakfast > 0);
          return updated;
        }
        return m;
      }));
      
      if (field === 'is_locked' && value === false) {
        toast.success("Meal Unlocked Successfully.");
      }
    } catch (error) {
      toast.error("Action failed.");
    }
  };

  const activeBordersCount = allMeals.filter(m => m.isActive).length;
  const inactiveBordersCount = allMeals.length - activeBordersCount;
  
  const totalPortionsToday = allMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
  const totalLunchPortions = allMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.guest_lunch || 0), 0);
  const totalDinnerPortions = allMeals.reduce((acc, m) => acc + Number(m.dinner || 0) + Number(m.guest_dinner || 0), 0);
  
  const totalFullMealsCount = allMeals.filter(m => Number(m.lunch) === 1 && Number(m.dinner) === 1).length;
  const totalOneHalfMealsCount = allMeals.filter(m => (Number(m.lunch) === 1 && Number(m.dinner) === 0) || (Number(m.lunch) === 0 && Number(m.dinner) === 1)).length;

  const chartTotal = monthStats.lunch + monthStats.dinner + monthStats.breakfast;
  const lPct = chartTotal > 0 ? (monthStats.lunch / chartTotal) * 100 : 0;
  const dPct = chartTotal > 0 ? (monthStats.dinner / chartTotal) * 100 : 0;
  const bPct = chartTotal > 0 ? (monthStats.breakfast / chartTotal) * 100 : 0;
  const mealRate = totalMealsMonth > 0 ? (totalBazaar / totalMealsMonth).toFixed(2) : "0.00";
  const myTotalToday = Number(myMeal.lunch) + Number(myMeal.dinner) + Number(myMeal.breakfast) + Number(myMeal.guest_lunch) + Number(myMeal.guest_dinner);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 dark:border-slate-800"></div>
          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest animate-pulse">Syncing Database...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in z-0 pb-10">
      
      {/* 🌟 Premium Background Glowing Blobs */}
      <div className="fixed top-20 left-10 w-72 md:w-96 h-72 md:h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full filter blur-[100px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-40 right-10 w-72 md:w-96 h-72 md:h-96 bg-purple-500/10 dark:bg-purple-500/20 rounded-full filter blur-[100px] pointer-events-none -z-10"></div>

      {/* 🗓️ Date & Time Lock Banner */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl shadow-indigo-500/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 transition-all">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Meal Controller</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] font-bold mt-1.5 uppercase tracking-widest flex items-center gap-2">
            Update Window: 
            <span className="px-2.5 py-1 bg-indigo-100/80 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 rounded-lg shadow-sm">
              {timeWindow.start} to {timeWindow.end}
            </span>
          </p>
        </div>
        <div className="w-full sm:w-auto relative group">
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-black bg-white dark:bg-slate-800 border-2 border-indigo-50 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-800 dark:text-slate-200 shadow-sm cursor-pointer transition-all hover:border-indigo-200 dark:hover:border-slate-600 appearance-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* =========================================
            LEFT COLUMN: User Personal Form & Graph
        ============================================= */}
        <div className="lg:col-span-1 space-y-6 sm:space-y-8">
          
          {/* User Meal Switch Card */}
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl relative overflow-hidden group">
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Today's Selection</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1.5">
                  Total Booked: <span className="text-indigo-600 dark:text-indigo-400 text-sm bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md ml-1">{myTotalToday.toFixed(1)}</span> portions
                </p>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                {myMeal.is_locked ? (
                  <span className="px-3 py-1.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Locked
                  </span>
                ) : isTimeLocked ? (
                  <span className="px-3 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase shadow-sm border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Time Over
                  </span>
                ) : (
                  <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase shadow-sm border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1 animate-pulse">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> Open
                  </span>
                )}
              </div>
            </div>

            {/* PRESET BUTTONS */}
            <div className={`space-y-4 transition-opacity duration-300 ${myMeal.is_locked || isTimeLocked ? 'opacity-50 pointer-events-none grayscale-[30%]' : ''}`}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button onClick={() => applyPreset('full_on')} className={`cursor-pointer py-4 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-95 ${myMeal.lunch > 0 && myMeal.dinner > 0 ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20 shadow-md' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-slate-600 dark:text-slate-300'}`}>
                  <span className="text-xl mb-1.5">🟢</span>
                  <span className="text-[11px] font-black uppercase tracking-wide">Full ON (2.5)</span>
                </button>
                <button onClick={() => applyPreset('full_off')} className={`cursor-pointer py-4 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-95 ${myMeal.lunch === 0 && myMeal.dinner === 0 && myMeal.breakfast === 0 ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-500/20 shadow-md' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/50 text-slate-600 dark:text-slate-300'}`}>
                  <span className="text-xl mb-1.5">🔴</span>
                  <span className="text-[11px] font-black uppercase tracking-wide">Full OFF (0)</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button onClick={() => applyPreset('only_lunch')} className={`cursor-pointer py-3.5 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${myMeal.lunch > 0 && myMeal.dinner === 0 ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-500/20' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300 dark:hover:border-amber-500/50'}`}>
                  <span className="text-[10px] font-black uppercase tracking-wider">Day / Lunch</span>
                </button>
                <button onClick={() => applyPreset('only_dinner')} className={`cursor-pointer py-3.5 flex flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${myMeal.dinner > 0 && myMeal.lunch === 0 ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-500/20' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-500/50'}`}>
                  <span className="text-[10px] font-black uppercase tracking-wider">Night / Dinner</span>
                </button>
              </div>

              {/* Guest Meals Section */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-700/50 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex items-center justify-center gap-2">
                  <span className="w-4 h-[1px] bg-slate-200 dark:bg-slate-700"></span> Add Guest Meals <span className="w-4 h-[1px] bg-slate-200 dark:bg-slate-700"></span>
                </p>
                {['guest_lunch', 'guest_dinner'].map((gMeal) => (
                  <div key={gMeal} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide pl-1">{gMeal.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm pointer-events-auto">
                      <button onClick={() => adjustGuestMeal(gMeal as any, -0.5)} className="cursor-pointer w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/20 font-black text-slate-500 hover:text-rose-500 transition-colors active:scale-90">-</button>
                      <span className="w-8 text-center font-black text-sm text-indigo-600 dark:text-indigo-400">{myMeal[gMeal as keyof typeof myMeal]}</span>
                      <button onClick={() => adjustGuestMeal(gMeal as any, 0.5)} className="cursor-pointer w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/20 font-black text-slate-500 hover:text-emerald-500 transition-colors active:scale-90">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-8">
              {(!myMeal.is_locked && !isTimeLocked) ? (
                <button onClick={handleSaveMeal} disabled={actionLoading} className="cursor-pointer w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black uppercase tracking-widest rounded-2xl text-sm transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 flex justify-center items-center gap-2">
                  {actionLoading ? "Securing..." : "Save & Lock Selection"}
                  {!actionLoading && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                </button>
              ) : myMeal.unlock_requested ? (
                <div className="w-full py-4 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest rounded-2xl text-xs text-center border border-amber-200 dark:border-amber-500/20 flex items-center justify-center gap-2 animate-pulse">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Manager Approval Pending
                </div>
              ) : (
                <button onClick={handleUnlockRequest} className="cursor-pointer w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest rounded-2xl text-xs transition-all duration-300 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md active:scale-[0.98] flex justify-center items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> Request Unlock
                </button>
              )}
            </div>
          </div>

          {/* User History Circular Chart */}
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex flex-col items-center group transition-all hover:shadow-2xl">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest w-full text-center sm:text-left mb-6 flex items-center justify-center sm:justify-start gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg> My Month History
            </h3>
            <div className="relative w-48 h-48 drop-shadow-2xl transition-transform duration-500 group-hover:scale-105">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" className="dark:stroke-slate-800 transition-colors" />
                {chartTotal > 0 && (
                  <>
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${bPct * 2.51} 251.2`} strokeDashoffset="0" className="transition-all duration-1000 ease-out" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#6366f1" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${lPct * 2.51} 251.2`} strokeDashoffset={`-${bPct * 2.51}`} className="transition-all duration-1000 ease-out" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#a855f7" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dPct * 2.51} 251.2`} strokeDashoffset={`-${(bPct + lPct) * 2.51}`} className="transition-all duration-1000 ease-out" />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{chartTotal.toFixed(1)}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Meals</span>
              </div>
            </div>
            
            {/* Chart Legend */}
            <div className="flex gap-4 mt-6">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Break</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Lunch</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#a855f7]"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Dinner</span></div>
            </div>
          </div>
        </div>

        {/* =========================================
            RIGHT COLUMN: Admin / Manager Controls
        ============================================= */}
        {userRole !== "user" && (
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Beautiful Gradient Engine Card */}
              <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 rounded-[2rem] p-6 md:p-8 shadow-2xl shadow-indigo-500/20 relative overflow-hidden text-white group transition-all hover:shadow-indigo-500/40 hover:-translate-y-1">
                <div className="absolute -right-10 -top-10 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 delay-100"></div>
                
                <h3 className="text-indigo-100 text-[10px] md:text-xs font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                  <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Live Meal Engine
                </h3>
                <div className="flex items-end gap-6 relative z-10">
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-1 opacity-80 tracking-wider">Total Expense</p>
                    <p className="text-xl md:text-2xl font-black">৳{totalBazaar.toLocaleString()}</p>
                  </div>
                  <div className="text-2xl font-black opacity-40 mb-1">/</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-1 opacity-80 tracking-wider">Total Meals</p>
                    <p className="text-xl md:text-2xl font-black">{totalMealsMonth.toFixed(1)}</p>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-white/20 relative z-10 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-1 opacity-80 tracking-wider">Current Meal Rate</p>
                    <p className="text-4xl md:text-5xl font-black tracking-tighter">৳ {mealRate}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                </div>
              </div>

              {/* Time Settings Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl rounded-[2rem] p-6 md:p-8 shadow-xl border border-white/50 dark:border-slate-700/50 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Time Window</h3>
                </div>
                <p className="text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-6">Set daily allowed hours for borders to update meals.</p>
                <form onSubmit={updateTimeWindow} className="space-y-5">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Time</label>
                      <input type="time" value={timeWindow.start} onChange={e => setTimeWindow({...timeWindow, start: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Time</label>
                      <input type="time" value={timeWindow.end} onChange={e => setTimeWindow({...timeWindow, end: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer" />
                    </div>
                  </div>
                  <button type="submit" className="cursor-pointer w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95">Save Config</button>
                </form>
              </div>
            </div>

            {/* Quick Admin Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-lg text-center transition-all hover:-translate-y-1 hover:shadow-xl">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Active Borders</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{activeBordersCount}</p>
              </div>
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-lg text-center transition-all hover:-translate-y-1 hover:shadow-xl">
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5">Inactive Borders</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{inactiveBordersCount}</p>
              </div>
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-lg text-center transition-all hover:-translate-y-1 hover:shadow-xl">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">Total Booked (Today)</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{totalPortionsToday.toFixed(1)}</p>
              </div>
            </div>

            {/* Distribution Summary Cards */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl rounded-[2rem] p-6 md:p-8 border border-white/50 dark:border-slate-700/50 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="text-xs md:text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Live Food Distribution</h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-amber-50/80 dark:bg-amber-500/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20 transition-transform hover:scale-[1.03]">
                  <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Noon / Lunch</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{totalLunchPortions.toFixed(1)} <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">pcs</span></p>
                </div>
                <div className="bg-purple-50/80 dark:bg-purple-500/10 p-5 rounded-2xl border border-purple-100 dark:border-purple-500/20 transition-transform hover:scale-[1.03]">
                  <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Night / Dinner</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{totalDinnerPortions.toFixed(1)} <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">pcs</span></p>
                </div>
                <div className="bg-indigo-50/80 dark:bg-indigo-500/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 transition-transform hover:scale-[1.03]">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Full Meals (2.5)</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{totalFullMealsCount} <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">heads</span></p>
                </div>
                <div className="bg-rose-50/80 dark:bg-rose-500/10 p-5 rounded-2xl border border-rose-100 dark:border-rose-500/20 transition-transform hover:scale-[1.03]">
                  <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">1.5 Meals</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{totalOneHalfMealsCount} <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">heads</span></p>
                </div>
              </div>
            </div>

            {/* Massive Admin Table */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden">
              <div className="p-6 md:p-8 border-b border-slate-200/50 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-800/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Border Registry</h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Manage daily status</p>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-800/50">
                      <th className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50">Border Profile</th>
                      <th className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 text-center">Meals Setup</th>
                      <th className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 text-center">Guest Add-on</th>
                      <th className="px-6 py-5 border-b border-slate-200/50 dark:border-slate-700/50 text-right">Lock Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                    {allMeals.map((m) => (
                      <tr key={m.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-md shrink-0 transition-transform group-hover:scale-105 ${m.isActive ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700'}`}>
                              {m.full_name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div>
                              <div className="font-black text-sm text-slate-900 dark:text-slate-200 tracking-tight">
                                {m.full_name} 
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Room: {m.room_number || "N/A"}</span>
                                {m.isActive ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md text-[9px] font-black uppercase tracking-wider">
                                    Inactive
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center items-center gap-2">
                            <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-black uppercase pl-2 pr-1">L</span>
                              <input type="number" step="0.5" min="0" value={m.lunch} onChange={(e) => handleAdminAction(m.user_id, 'lunch', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-sm font-black bg-transparent border-none outline-none text-slate-800 dark:text-white cursor-pointer" />
                            </div>
                            <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-purple-500/50 transition-all">
                              <span className="text-[10px] text-purple-500 dark:text-purple-400 font-black uppercase pl-2 pr-1">D</span>
                              <input type="number" step="0.5" min="0" value={m.dinner} onChange={(e) => handleAdminAction(m.user_id, 'dinner', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-sm font-black bg-transparent border-none outline-none text-slate-800 dark:text-white cursor-pointer" />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center items-center">
                            <div className="flex items-center bg-orange-50 dark:bg-orange-500/10 p-1.5 rounded-xl border border-orange-200 dark:border-orange-500/20 focus-within:ring-2 focus-within:ring-orange-500/50 transition-all">
                              <input type="number" step="0.5" min="0" value={m.guest_lunch} onChange={(e) => handleAdminAction(m.user_id, 'guest_lunch', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-sm font-black bg-transparent text-orange-600 dark:text-orange-400 border-none outline-none cursor-pointer" />
                              <span className="text-orange-300 dark:text-orange-500/50 font-black">/</span>
                              <input type="number" step="0.5" min="0" value={m.guest_dinner} onChange={(e) => handleAdminAction(m.user_id, 'guest_dinner', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-sm font-black bg-transparent text-orange-600 dark:text-orange-400 border-none outline-none cursor-pointer" />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <button 
                              onClick={() => handleAdminAction(m.user_id, 'is_locked', !m.is_locked)} 
                              className={`cursor-pointer px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5 hover:shadow-md active:scale-95 ${m.is_locked ? 'bg-slate-800 text-white dark:bg-slate-700 hover:bg-slate-900' : 'bg-white border border-slate-200 dark:border-slate-600 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600'}`}
                            >
                              {m.is_locked ? (
                                <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> Unlock</>
                              ) : (
                                <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> Lock</>
                              )}
                            </button>
                            {m.unlock_requested && m.is_locked && (
                              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 animate-pulse bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md border border-amber-100 dark:border-amber-500/20">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Requesting
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}