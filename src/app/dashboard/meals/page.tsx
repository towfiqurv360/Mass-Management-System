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

  // --- NEW: MISSING VARIABLES DECLARED HERE ---
  const activeBordersCount = allMeals.filter(m => m.isActive).length;
  const inactiveBordersCount = allMeals.length - activeBordersCount;
  
  const totalPortionsToday = allMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
  const totalLunchPortions = allMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.guest_lunch || 0), 0);
  const totalDinnerPortions = allMeals.reduce((acc, m) => acc + Number(m.dinner || 0) + Number(m.guest_dinner || 0), 0);
  
  const totalFullMealsCount = allMeals.filter(m => Number(m.lunch) === 1 && Number(m.dinner) === 1).length;
  const totalOneHalfMealsCount = allMeals.filter(m => (Number(m.lunch) === 1 && Number(m.dinner) === 0) || (Number(m.lunch) === 0 && Number(m.dinner) === 1)).length;
  // --------------------------------------------

  const chartTotal = monthStats.lunch + monthStats.dinner + monthStats.breakfast;
  const lPct = chartTotal > 0 ? (monthStats.lunch / chartTotal) * 100 : 0;
  const dPct = chartTotal > 0 ? (monthStats.dinner / chartTotal) * 100 : 0;
  const bPct = chartTotal > 0 ? (monthStats.breakfast / chartTotal) * 100 : 0;
  const mealRate = totalMealsMonth > 0 ? (totalBazaar / totalMealsMonth).toFixed(2) : "0.00";
  const myTotalToday = Number(myMeal.lunch) + Number(myMeal.dinner) + Number(myMeal.breakfast) + Number(myMeal.guest_lunch) + Number(myMeal.guest_dinner);

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10">
      
      {/* Background Glowing Blobs */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/20 rounded-full filter blur-3xl opacity-50 pointer-events-none -z-10"></div>
      <div className="fixed top-40 right-10 w-96 h-96 bg-purple-500/20 rounded-full filter blur-3xl opacity-50 pointer-events-none -z-10"></div>

      {/* Date & Time Lock Banner */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4 transition-all">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-rose-500">Meal Controller</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest flex items-center gap-2">
            Update Window: <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 rounded-md">{timeWindow.start} to {timeWindow.end}</span>
          </p>
        </div>
        <input 
          type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} 
          className="w-full sm:w-auto px-5 py-3 text-sm font-black bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: User Personal Form & Graph */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl relative overflow-hidden">
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Today's Meal Switch</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1">Total Booked: <span className="text-indigo-600 dark:text-indigo-400 text-sm">{myTotalToday.toFixed(1)}</span> portions</p>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                {myMeal.is_locked ? (
                  <span className="px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase shadow-sm border border-slate-200 dark:border-slate-700">
                    Status Locked
                  </span>
                ) : isTimeLocked ? (
                  <span className="px-3 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase shadow-sm border border-amber-200 dark:border-amber-500/30">
                    Time Over
                  </span>
                ) : (
                  <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase shadow-sm border border-emerald-200 dark:border-emerald-500/30">
                    Open to Edit
                  </span>
                )}
              </div>
            </div>

            {/* MEAL CONTROLS */}
            <div className={`space-y-4 ${myMeal.is_locked || isTimeLocked ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => applyPreset('full_on')} className={`py-4 flex flex-col items-center justify-center rounded-2xl border-2 transition-all ${myMeal.lunch > 0 && myMeal.dinner > 0 ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-indigo-300'}`}>
                  <span className="text-lg mb-1">🟢</span>
                  <span className="text-xs font-black uppercase">Full ON (2.5)</span>
                </button>
                <button onClick={() => applyPreset('full_off')} className={`py-4 flex flex-col items-center justify-center rounded-2xl border-2 transition-all ${myMeal.lunch === 0 && myMeal.dinner === 0 && myMeal.breakfast === 0 ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-500/20' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:border-rose-300'}`}>
                  <span className="text-lg mb-1">🔴</span>
                  <span className="text-xs font-black uppercase">Full OFF (0)</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => applyPreset('only_lunch')} className={`py-3 flex flex-col items-center justify-center rounded-2xl border transition-all ${myMeal.lunch > 0 && myMeal.dinner === 0 ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-500/20' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                  <span className="text-[10px] font-black uppercase">Day / Lunch (1.5)</span>
                </button>
                <button onClick={() => applyPreset('only_dinner')} className={`py-3 flex flex-col items-center justify-center rounded-2xl border transition-all ${myMeal.dinner > 0 && myMeal.lunch === 0 ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-500/20' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                  <span className="text-[10px] font-black uppercase">Night / Dinner (1.5)</span>
                </button>
              </div>

              {/* Guest Meals */}
              <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Add Guest Meals</p>
                {['guest_lunch', 'guest_dinner'].map((gMeal) => (
                  <div key={gMeal} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase pl-2">{gMeal.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl pointer-events-auto">
                      <button onClick={() => adjustGuestMeal(gMeal as any, -0.5)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm font-black text-slate-600 hover:text-rose-500">-</button>
                      <span className="w-8 text-center font-black text-sm text-orange-500">{myMeal[gMeal as keyof typeof myMeal]}</span>
                      <button onClick={() => adjustGuestMeal(gMeal as any, 0.5)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm font-black text-slate-600 hover:text-emerald-500">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6">
              {(!myMeal.is_locked && !isTimeLocked) ? (
                <button onClick={handleSaveMeal} disabled={actionLoading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest rounded-2xl text-sm transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                  Save & Lock Selection
                </button>
              ) : myMeal.unlock_requested ? (
                <div className="w-full py-4 bg-amber-50 dark:bg-amber-500/10 text-amber-600 font-black uppercase tracking-widest rounded-2xl text-sm text-center border border-amber-200 dark:border-amber-500/20 flex items-center justify-center gap-2">
                  Manager Approval Pending
                </div>
              ) : (
                <button onClick={handleUnlockRequest} className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest rounded-2xl text-sm transition-all hover:border-indigo-500 hover:text-indigo-600 active:scale-[0.98]">
                  Request Unlock
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex flex-col items-center">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 w-full">My Month History</h3>
            <div className="relative w-48 h-48 drop-shadow-2xl">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="12" className="dark:stroke-slate-800" />
                {chartTotal > 0 && (
                  <>
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={`${bPct * 2.51} 251.2`} strokeDashoffset="0" className="transition-all duration-1000" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#6366f1" strokeWidth="12" strokeDasharray={`${lPct * 2.51} 251.2`} strokeDashoffset={`-${bPct * 2.51}`} className="transition-all duration-1000" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#a855f7" strokeWidth="12" strokeDasharray={`${dPct * 2.51} 251.2`} strokeDashoffset={`-${(bPct + lPct) * 2.51}`} className="transition-all duration-1000" />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-800 dark:text-white">{chartTotal.toFixed(1)}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Meals</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Manager Controls */}
        {userRole !== "user" && (
          <div className="lg:col-span-2 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden text-white">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                <h3 className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-6">Live Meal Engine</h3>
                <div className="flex items-end gap-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-1 opacity-80">Total Expense</p>
                    <p className="text-xl font-black">৳{totalBazaar}</p>
                  </div>
                  <div className="text-xl font-black opacity-50">/</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-1 opacity-80">Total Meals</p>
                    <p className="text-xl font-black">{totalMealsMonth.toFixed(1)}</p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/20">
                  <p className="text-[10px] font-bold uppercase mb-1 opacity-80">Current Meal Rate</p>
                  <p className="text-4xl font-black">৳ {mealRate}</p>
                </div>
              </div>

              <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] p-6 shadow-xl border border-white/50 dark:border-slate-700/50">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-2">Time Window Settings</h3>
                <p className="text-[10px] text-slate-500 font-bold mb-6">Set daily allowed hours for meal updates</p>
                <form onSubmit={updateTimeWindow} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Time</label>
                      <input type="time" value={timeWindow.start} onChange={e => setTimeWindow({...timeWindow, start: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Time</label>
                      <input type="time" value={timeWindow.end} onChange={e => setTimeWindow({...timeWindow, end: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white outline-none" />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all">Save Config</button>
                </form>
              </div>
            </div>

            {/* Admin Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md text-center">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Active Borders</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{activeBordersCount}</p>
              </div>
              <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md text-center">
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Inactive Borders</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{inactiveBordersCount}</p>
              </div>
              <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md text-center">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Total Booked Portions</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{totalPortionsToday.toFixed(1)}</p>
              </div>
            </div>

            {/* Live Distribution Summary */}
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] p-6 border border-white/50 dark:border-slate-700/50 shadow-xl space-y-4">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/50 dark:border-slate-700/50 pb-2">Live Food Distribution Summary (Selected Date)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-amber-50/50 dark:bg-amber-500/5 p-4 rounded-2xl border border-amber-100 dark:border-amber-500/10">
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Noon / Lunch</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalLunchPortions.toFixed(1)} <span className="text-xs font-normal text-slate-400">pcs</span></p>
                </div>
                <div className="bg-purple-50/50 dark:bg-purple-500/5 p-4 rounded-2xl border border-purple-100 dark:border-purple-500/10">
                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Night / Dinner</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalDinnerPortions.toFixed(1)} <span className="text-xs font-normal text-slate-400">pcs</span></p>
                </div>
                <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/10">
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Full Meals (2.5)</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalFullMealsCount} <span className="text-xs font-normal text-slate-400">borders</span></p>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-500/5 p-4 rounded-2xl border border-rose-100 dark:border-rose-500/10">
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">1.5 Meals</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalOneHalfMealsCount} <span className="text-xs font-normal text-slate-400">borders</span></p>
                </div>
              </div>
            </div>

            {/* Border Registry Table */}
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center bg-white/40 dark:bg-slate-800/40">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Border Registry</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50">
                      <th className="px-5 py-4">Border Profile</th>
                      <th className="px-5 py-4 text-center">Meals</th>
                      <th className="px-5 py-4 text-center">Guests</th>
                      <th className="px-5 py-4 text-right">Lock Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                    {allMeals.map((m) => (
                      <tr key={m.user_id} className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-md shrink-0 ${m.isActive ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-rose-400 to-pink-500'}`}>
                              {m.full_name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-slate-200 flex items-center gap-2">
                                {m.full_name} 
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Room: {m.room_number || "N/A"}</span>
                                {m.isActive ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded text-[8px] font-black uppercase">Active</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded text-[8px] font-black uppercase">Inactive</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">L</span>
                            <input type="number" step="0.5" min="0" value={m.lunch} onChange={(e) => handleAdminAction(m.user_id, 'lunch', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-xs font-bold bg-slate-100 dark:bg-slate-900 border-none rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase ml-2">D</span>
                            <input type="number" step="0.5" min="0" value={m.dinner} onChange={(e) => handleAdminAction(m.user_id, 'dinner', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-xs font-bold bg-slate-100 dark:bg-slate-900 border-none rounded-lg outline-none focus:ring-2 focus:ring-purple-500" />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center items-center gap-1">
                            <input type="number" step="0.5" min="0" value={m.guest_lunch} onChange={(e) => handleAdminAction(m.user_id, 'guest_lunch', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-xs font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg outline-none" />
                            <span className="text-slate-400 font-black">/</span>
                            <input type="number" step="0.5" min="0" value={m.guest_dinner} onChange={(e) => handleAdminAction(m.user_id, 'guest_dinner', Number(e.target.value))} className="w-10 px-1 py-1 text-center text-xs font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg outline-none" />
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right flex flex-col items-end gap-1">
                          <button 
                            onClick={() => handleAdminAction(m.user_id, 'is_locked', !m.is_locked)} 
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${m.is_locked ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 hover:bg-emerald-200'}`}
                          >
                            {m.is_locked ? 'Unlock' : 'Lock'}
                          </button>
                          {m.unlock_requested && m.is_locked && (
                            <span className="text-[9px] font-black text-amber-500 uppercase">Req Pending</span>
                          )}
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