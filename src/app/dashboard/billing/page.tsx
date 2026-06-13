"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast"; // 🎯 Enterprise Toast Notifications

const getCurrentMonth = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().substring(0, 7);
};

export default function MonthlyBillingPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState("user");

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isMonthClosed, setIsMonthClosed] = useState(false); // 🎯 History Lock State
  
  // Financial Core States
  const [mealRate, setMealRate] = useState(0);
  const [totalMonthExpense, setTotalMonthExpense] = useState(0);
  const [totalMonthMeals, setTotalMonthMeals] = useState(0);
  const [membersBilling, setMembersBilling] = useState<any[]>([]);

  // Bulk Configuration States (For Super Admin)
  const [bulkCategory, setBulkCategory] = useState("All");
  const [bulkRent, setBulkRent] = useState("");
  const [bulkMaid, setBulkMaid] = useState("");
  const [bulkWifi, setBulkWifi] = useState("");
  const [bulkElectricity, setBulkElectricity] = useState("");

  // Modal & Individual Edit States
  const [selectedModalUser, setSelectedModalUser] = useState<any>(null);
  const [isEditingIndividual, setIsEditingIndividual] = useState(false);
  const [editForm, setEditForm] = useState({ rent: 0, maid: 0, wifi: 0, electricity: 0 });

  useEffect(() => {
    setIsMounted(true);
    fetchBillingData();
  }, [selectedMonth]);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const role = profile?.role || "user";
      setUserRole(role);

      // 🎯 1. Check if Month is Archived in History (Month Isolation)
      const { data: archiveData } = await supabase.from("monthly_reports").select("*").eq("month", selectedMonth).maybeSingle();
      
      let tExpense = 0;
      let tMeals = 0;
      let mRate = 0;

      if (archiveData) {
        // 🔒 If archived, load frozen history data (Cannot be edited)
        setIsMonthClosed(true);
        tExpense = Number(archiveData.total_bazaar || 0);
        tMeals = Number(archiveData.total_meals || 0);
        mRate = Number(archiveData.meal_rate || 0);
      } else {
        // 🟢 If open, calculate live data based on variable daily inputs
        setIsMonthClosed(false);
        const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_type", "meal").like("date", `${selectedMonth}%`);
        tExpense = expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

        const { data: liveMeals } = await supabase.from("daily_meals").select("*").like("date", `${selectedMonth}%`);
        tMeals = liveMeals?.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0) || 0;
        
        mRate = tMeals > 0 ? (tExpense / tMeals) : 0;
      }

      setTotalMonthExpense(tExpense);
      setTotalMonthMeals(tMeals);
      setMealRate(mRate);

      // 2. Fetch Profiles & Calculate Individual Data (Your Default Features)
      const { data: allMeals } = await supabase.from("daily_meals").select("*").like("date", `${selectedMonth}%`);
      const { data: profilesData } = await supabase.from("profiles").select("*").order("room_number", { ascending: true });
      
      const billingArray = (profilesData || []).map(p => {
        const myMeals = (allMeals || []).filter(m => m.user_id === p.id);
        const myTotalMeals = myMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
        
        // Meal Calculation (Isolated month's data * isolated month's rate)
        const myMealCost = myTotalMeals * mRate;
        const myMealDeposit = Number(p.balance || 0); 
        const mealDueOrRefund = myMealDeposit - myMealCost;

        // Fixed Mess Bill Calculation (Zeroes out automatically on close)
        const fixedMessBill = Number(p.current_month_rent || 0) + Number(p.current_month_maid || 0) + Number(p.current_month_wifi || 0) + Number(p.current_month_electricity || 0);

        return { 
          ...p, 
          totalMeals: myTotalMeals, 
          mealCost: myMealCost, 
          mealDeposit: myMealDeposit,
          mealDueOrRefund, 
          fixedMessBill 
        };
      });

      setMembersBilling(role === "user" ? billingArray.filter(b => b.id === user.id) : billingArray);

      if (selectedModalUser) {
        const updatedUser = billingArray.find(b => b.id === selectedModalUser.id);
        if (updatedUser) setSelectedModalUser(updatedUser);
      }

    } catch (error) {
      toast.error("Failed to generate isolated month's billing data.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 ARCHIVE MONTH LOGIC (Finalize Dues & Reset for New Month)
  const handleArchiveMonth = async () => {
    if (userRole !== "super_admin") return;
    if (!window.confirm(`⚠️ WARNING: You are about to permanently CLOSE the month of ${selectedMonth}.\n\n1. This month's bazaar/meal history will be archived (frozen).\n2. Members' fixed bills (Rent, Maid, etc.) will reset to 0 for next month.\n3. Members' real-time balance will be updated to meal dues.\n\nProceed?`)) return;

    setActionLoading(true);
    const toastId = toast.loading(`Closing and archiving month ${selectedMonth}...`);

    try {
      // 🎯 Step A: Save Frozen Report to History
      const { error: archiveError } = await supabase.from("monthly_reports").insert({
        month: selectedMonth,
        total_bazaar: totalMonthExpense,
        total_meals: totalMonthMeals,
        meal_rate: mealRate
      });

      if (archiveError) throw archiveError;

      // 🎯 Step B: Update Residents' Meal Balance to finalize dues for the isolated month
      const { data: allMealsForIsolation } = await supabase.from("daily_meals").select("*").like("date", `${selectedMonth}%`);
      const { data: profilesToIsolate } = await supabase.from("profiles").select("id, balance");
      const currentRate = mealRate;

      for(let p of profilesToIsolate || []) {
        const myMealsIsolation = (allMealsForIsolation || []).filter(m => m.user_id === p.id);
        const myMealsIsolationTotal = myMealsIsolation.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
        const myMealsIsolationCost = myMealsIsolationTotal * currentRate;
        
        // 🎯 The core isolation logic: finalized balance = previous advance/deposit - variable cost. It correctly isolates but finalizes money.
        const finalizedIsolatedBalance = Number(p.balance || 0) - myMealsIsolationCost;

        await supabase.from("profiles").update({ balance: finalizedIsolatedBalance }).eq("id", p.id);
      }

      // 🧹 Step C: Resetting profiles fixed bills to 0 for the fresh isolated new month
      await supabase.from("profiles").update({
        current_month_rent: 0,
        current_month_maid: 0,
        current_month_wifi: 0,
        current_month_electricity: 0
      }).not("id", "is", null);

      toast.success("Month successfully closed! Data archived, balances finalized, and bills reset for the new isolated month.", { id: toastId, duration: 8000 });
      setIsMonthClosed(true);
      fetchBillingData();
    } catch (error) {
      toast.error("Failed to complete month isolation and archiving.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk update logic and other features remain the same. The design is kept intact.
  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return toast.error("Unauthorized action.");
    if (isMonthClosed) return toast.error("Cannot edit bills for a closed month.");

    const confirmMsg = bulkCategory === "All" 
      ? "Are you sure you want to apply these bills to ALL members?" 
      : `Apply these bills to all ${bulkCategory} room members?`;
    
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    const toastId = toast.loading(`Applying bulk updates for ${bulkCategory}...`);

    try {
      let query = supabase.from("profiles").update({
        ...(bulkRent && { current_month_rent: Number(bulkRent) }),
        ...(bulkMaid && { current_month_maid: Number(bulkMaid) }),
        ...(bulkWifi && { current_month_wifi: Number(bulkWifi) }),
        ...(bulkElectricity && { current_month_electricity: Number(bulkElectricity) })
      });

      if (bulkCategory !== "All") {
        query = query.eq("room_category", bulkCategory);
      } else {
        query = query.not("id", "is", null);
      }

      const { error } = await query;
      if (error) throw error;

      toast.success("Bulk update successful!", { id: toastId });
      setBulkRent(""); setBulkMaid(""); setBulkWifi(""); setBulkElectricity("");
      fetchBillingData();
    } catch (error) {
      toast.error("Bulk update failed.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const openIndividualEdit = () => {
    setIsEditingIndividual(true);
    setEditForm({
      rent: Number(selectedModalUser.current_month_rent || 0),
      maid: Number(selectedModalUser.current_month_maid || 0),
      wifi: Number(selectedModalUser.current_month_wifi || 0),
      electricity: Number(selectedModalUser.current_month_electricity || 0)
    });
  };

  const saveIndividualEdit = async () => {
    setActionLoading(true);
    const toastId = toast.loading("Updating resident's isolated bills...");
    try {
      const { error } = await supabase.from("profiles").update({
        current_month_rent: editForm.rent,
        current_month_maid: editForm.maid,
        current_month_wifi: editForm.wifi,
        current_month_electricity: editForm.electricity
      }).eq("id", selectedModalUser.id);

      if (error) throw error;
      toast.success("Bills updated successfully!", { id: toastId });
      setIsEditingIndividual(false);
      fetchBillingData(); 
    } catch (error) {
      toast.error("Failed to save bills.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Background Glows (Intact) */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none -z-10 print:hidden transition-transform duration-500 hover:scale-110"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-rose-500/10 rounded-full filter blur-3xl pointer-events-none -z-10 print:hidden transition-transform duration-500 hover:scale-110"></div>

      {/* 🎯 HEADER BANNER (Intact) */}
      <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 print:hidden transition-all duration-300 hover:shadow-amber-500/5">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-rose-600 tracking-tight">Master Billing Engine</h2>
            {isMonthClosed ? (
              <span className="px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5 shadow-inner">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> 🔒 Month Closed
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1.5 animate-pulse shadow-inner">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 🟢 Live isolated Data
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] font-bold mt-1.5 uppercase tracking-widest flex items-center gap-2">Financial Settlement & History Archiving</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-end sm:items-center">
          {/* Print Button (Intact) */}
          <button onClick={() => window.print()} className="px-5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer hover:shadow-md">
             🖨️ Print Isolated Ledger
          </button>
          
          {/* Close Month Button (Only Super Admin - Intact) */}
          {userRole === "super_admin" && !isMonthClosed && (
            <button 
              onClick={handleArchiveMonth} 
              disabled={actionLoading}
              className="px-5 py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl hover:shadow-rose-500/30 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100 cursor-pointer"
            >
               🔒 Close Month & Archive
            </button>
          )}

          {/* Date Picker (Intact) */}
          <input 
            type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} 
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-black bg-slate-100 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 shadow-inner cursor-pointer appearance-none transition-all"
          />
        </div>
      </div>

      {/* 🎯 BULK CONFIGURATION PANEL (Super Admin Only - Intact) */}
      {userRole === "super_admin" && (
        <div className={`bg-gradient-to-br from-slate-900 via-[#0F172A] to-black p-6 md:p-8 rounded-[2rem] border border-slate-700 shadow-2xl print:hidden text-white transition-all duration-300 ${isMonthClosed ? 'opacity-60 pointer-events-none grayscale hover:shadow-none' : 'hover:shadow-amber-500/5 hover:-translate-y-1'}`}>
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </span>
             Global Isolated Fixed Bill Configurator {isMonthClosed && "(Month Isolated - Locked)"}
          </h3>
          <form onSubmit={handleBulkUpdate} className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
            
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Apply To (Filter)</label>
              <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="cursor-pointer w-full px-4 py-3 text-xs font-bold bg-slate-800/80 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500 appearance-none shadow-inner">
                <option value="All">All Members (Global)</option>
                <option value="Single">Single Rooms Only</option>
                <option value="Double">Double Rooms Only</option>
                <option value="Triple">Triple Rooms Only</option>
                <option value="Quad">Quad Rooms Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Seat Rent</label>
              <input type="number" placeholder="৳ Auto" value={bulkRent} onChange={e => setBulkRent(e.target.value)} className="w-full px-4 py-3 text-xs font-bold bg-slate-800/80 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Maid Bill</label>
              <input type="number" placeholder="৳ Auto" value={bulkMaid} onChange={e => setBulkMaid(e.target.value)} className="w-full px-4 py-3 text-xs font-bold bg-slate-800/80 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">WiFi Bill</label>
              <input type="number" placeholder="৳ Auto" value={bulkWifi} onChange={e => setBulkWifi(e.target.value)} className="w-full px-4 py-3 text-xs font-bold bg-slate-800/80 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Electricity</label>
              <input type="number" placeholder="৳ Auto" value={bulkElectricity} onChange={e => setBulkElectricity(e.target.value)} className="w-full px-4 py-3 text-xs font-bold bg-slate-800/80 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 shadow-inner" />
            </div>
            
            <div className="col-span-2 md:col-span-1">
              <button type="submit" disabled={actionLoading || isMonthClosed} className="cursor-pointer w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-xl shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-95 disabled:opacity-50">
                 Apply Isolated Update
              </button>
            </div>
          </form>
          <p className="text-[10px] text-slate-500 mt-5 font-semibold">* Leave empty to not update. Set 0 to reset for this isolated month. *This is isolated per month*.</p>
        </div>
      )}

      {/* CORE SYSTEM METRICS (Intact) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:hidden">
        <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex justify-between items-center group hover:-translate-y-1 transition-all hover:shadow-amber-500/5 hover:bg-white dark:hover:bg-[#0F172A]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Total Month Meals (Isolated)</p>
            <h3 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tighter">{totalMonthMeals.toFixed(1)}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-md border-2 border-white dark:border-slate-700 animate-fade-in delay-100">🍽️</div>
        </div>
        <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex justify-between items-center group hover:-translate-y-1 transition-all hover:shadow-emerald-500/5 hover:bg-white dark:hover:bg-[#0F172A]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Total Bazaar Cost (Isolated)</p>
            <h3 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tighter">৳ {totalMonthExpense.toLocaleString()}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-md border-2 border-white dark:border-slate-700 animate-fade-in delay-200">🛒</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-rose-600 p-6 rounded-[2rem] shadow-xl shadow-rose-500/10 text-white flex justify-between items-center relative overflow-hidden group hover:-translate-y-1 transition-all hover:shadow-rose-500/20">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="z-10">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-1">Final isolated Meal Rate</p>
            <h3 className="text-4xl md:text-5xl font-black tracking-tighter">৳ {mealRate.toFixed(2)}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl z-10 group-hover:scale-110 transition-transform shadow-lg border-2 border-white/30 animate-fade-in delay-300">📈</div>
        </div>
      </div>

      {/* PRINT ONLY HEADER (Intact) */}
      <div className="hidden print:block border-b-4 border-slate-900 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase">Monthly Master isolated Settlement Ledger</h1>
        <p className="text-sm font-bold text-slate-600 mt-1">Billing Month: {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} {isMonthClosed ? "(ARCHIVED isolated)" : "(LIVE isolated)"}</p>
        <div className="flex gap-8 mt-4">
          <p className="text-xs font-black uppercase tracking-widest">Portions: <span className="text-slate-600">{totalMonthMeals.toFixed(1)}</span></p>
          <p className="text-xs font-black uppercase tracking-widest">Bazaar: <span className="text-slate-600">৳ {totalMonthExpense.toLocaleString()}</span></p>
          <p className="text-xs font-black uppercase bg-slate-200 px-3 py-1.5 rounded tracking-widest font-black">Rate: ৳ {mealRate.toFixed(2)}</p>
        </div>
      </div>

      {/* 🧾 COMPACT LIST VIEW 🧾 (Intact) */}
      <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden hover:shadow-amber-500/5 transition-all duration-300 hover:border-white/90">
        <div className="p-6 md:p-8 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/20 print:hidden flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 shadow-inner">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Resident isolated Directory & Ledger</h3>
              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Click any row for detailed month settlement isolated view</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar min-h-[40vh]">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/50 dark:border-slate-700/50 print:bg-slate-200 print:text-black">
                <th className="px-6 py-5">Resident isolated Profile</th>
                <th className="px-6 py-5">Meal Cost (Isolated Eat)</th>
                <th className="px-6 py-5">Fixed isolated Mess Bill</th>
                <th className="px-6 py-5 text-right">isolated Net Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50 print:divide-slate-300">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-20 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Isolated Master Ledger Data...</td></tr>
              ) : membersBilling.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-20 text-sm text-slate-400 font-bold">No isolated billing profiles found for this month. All seems isolated zero.</td></tr>
              ) : membersBilling.map((member) => (
                <tr 
                  key={member.id} 
                  onClick={() => { setSelectedModalUser(member); setIsEditingIndividual(false); }}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all cursor-pointer group active:scale-[0.99] hover:z-10 relative"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-black text-indigo-600 dark:text-slate-300 shadow-sm border border-white/50 dark:border-slate-600">
                        {member.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white print:text-black group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors tracking-tight">{member.full_name}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md shadow-inner">Room {member.room_number || "N/A"}</span>
                          <span className="text-[9px] font-black text-slate-400/90 uppercase tracking-wider">{member.room_category || "Isolated"}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-sm text-slate-800 dark:text-slate-200 print:text-black">৳ {member.mealCost.toFixed(2)}</div>
                    <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{member.totalMeals.toFixed(1)} Portions (Isolated)</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-black text-sm text-slate-800 dark:text-slate-200 print:text-black">৳ {member.fixedMessBill.toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Fixed Dues (Isolated)</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                       <span className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2.5 transition-all duration-300 hover:-translate-x-1 hover:shadow-md ${member.mealDueOrRefund >= 0 && member.fixedMessBill === 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-inner' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-inner'}`}>
                        Details
                        <svg className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                       </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🎯 DETAILED MODAL (Pop-up on Click) (Intact) 🎯 */}
      {/* ========================================== */}
      {selectedModalUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 print:hidden"
          onClick={(e) => { if(e.target === e.currentTarget) setSelectedModalUser(null); }}
        >
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-4xl rounded-[2.5rem] shadow-2xl border-2 border-slate-200/50 dark:border-slate-700/80 overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 hover:border-amber-500/10 transition-colors">
            
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 border-b-2 border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4 shadow-inner">
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-2xl shadow-xl border-4 border-white animate-fade-in delay-100">
                  {selectedModalUser.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight animate-fade-in delay-200">{selectedModalUser.full_name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2.5 animate-fade-in delay-300">
                    <span className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 uppercase shadow-sm">Room: {selectedModalUser.room_number || "N/A"}</span>
                    <span className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 uppercase">{selectedModalUser.room_category} (Isolated)</span>
                    <span className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {selectedModalUser.phone || "Isolated"}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedModalUser(null)} className="cursor-pointer w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center text-xl font-bold transition-all shadow active:scale-90">
                 ✕
              </button>
            </div>

            {/* Modal Body: Split Ledger Card */}
            <div className="p-6 md:p-8 md:px-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              {/* LEFT: Meal Ledger */}
              <div className="space-y-6 animate-fade-in delay-200">
                <h4 className="text-[10px] md:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b-2 border-slate-100 dark:border-slate-800 pb-3.5">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500 shadow-inner">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  Isolated Meal Ledger Account
                </h4>
                
                <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-inner">
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-400">
                    <span className="tracking-tight">Isolated Portions Eaten</span>
                    <span className="font-black text-slate-900 dark:text-white tracking-tight">{selectedModalUser.totalMeals.toFixed(1)} Pcs</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-400">
                    <span className="tracking-tight">Deposited isolated Balance</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 tracking-tight">৳ {selectedModalUser.mealDeposit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="tracking-tight">Isolated calculated Meal Cost</span>
                    <span className="font-black text-rose-500 tracking-tight">- ৳ {selectedModalUser.mealCost.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className={`mt-5 p-6 rounded-2xl border-2 flex justify-between items-center transition-all hover:scale-[1.01] ${selectedModalUser.mealDueOrRefund >= 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:shadow-emerald-500/5' : 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 hover:shadow-rose-500/5'}`}>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">{selectedModalUser.mealDueOrRefund >= 0 ? 'isolated Meal Advance / Refundable' : 'isolated Meal Due Amount'}</p>
                    <h3 className="text-3xl md:text-4xl font-black mt-1 tracking-tighter">৳ {Math.abs(selectedModalUser.mealDueOrRefund).toFixed(2)}</h3>
                  </div>
                  <div className="text-4xl">{selectedModalUser.mealDueOrRefund >= 0 ? '😊' : '⚠️'}</div>
                </div>
              </div>

              {/* RIGHT: Fixed Mess Bills (Intact) */}
              <div className="space-y-6 border-t md:border-t-0 md:border-l-2 border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-10 animate-fade-in delay-300">
                <div className="flex justify-between items-center border-b-2 border-slate-100 dark:border-slate-800 pb-3.5">
                  <h4 className="text-[10px] md:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-500 shadow-inner">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </span>
                     Isolated Fixed Mess Dues
                  </h4>
                  {userRole === "super_admin" && !isEditingIndividual && !isMonthClosed && (
                    <button onClick={openIndividualEdit} className="cursor-pointer text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 px-3.5 py-2.5 rounded-lg transition-all shadow-sm border border-indigo-100 dark:border-indigo-500/20 active:scale-95 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                       Edit/Discount
                    </button>
                  )}
                </div>
                
                {isEditingIndividual ? (
                  // INDIVIDUAL EDIT MODE (Super Admin Only)
                  <div className="space-y-5 bg-slate-50 dark:bg-slate-900/50 p-5 md:p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-inner">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">Seat Rent</label>
                        <input type="number" value={editForm.rent} onChange={e => setEditForm({...editForm, rent: Number(e.target.value)})} className="w-full px-4 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">Maid Bill</label>
                        <input type="number" value={editForm.maid} onChange={e => setEditForm({...editForm, maid: Number(e.target.value)})} className="w-full px-4 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">WiFi Bill</label>
                        <input type="number" value={editForm.wifi} onChange={e => setEditForm({...editForm, wifi: Number(e.target.value)})} className="w-full px-4 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">Electricity</label>
                        <input type="number" value={editForm.electricity} onChange={e => setEditForm({...editForm, electricity: Number(e.target.value)})} className="w-full px-4 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner" />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-3">
                      <button onClick={() => setIsEditingIndividual(false)} className="cursor-pointer flex-1 py-3.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors active:scale-95">Discard</button>
                      <button onClick={saveIndividualEdit} disabled={actionLoading} className="cursor-pointer flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95">Save Details</button>
                    </div>
                  </div>
                ) : (
                  // VIEW MODE
                  <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-5 md:p-6 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-inner">
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400"><span>Seat Rent (Isolated)</span> <span className="text-slate-900 dark:text-white font-bold">৳ {selectedModalUser.current_month_rent || 0}</span></div>
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400"><span>Maid/Cook (Isolated)</span> <span className="text-slate-900 dark:text-white font-bold">৳ {selectedModalUser.current_month_maid || 0}</span></div>
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400"><span>WiFi Bill (Isolated)</span> <span className="text-slate-900 dark:text-white font-bold">৳ {selectedModalUser.current_month_wifi || 0}</span></div>
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3"><span>Electricity (Isolated)</span> <span className="text-slate-900 dark:text-white font-bold">৳ {selectedModalUser.current_month_electricity || 0}</span></div>
                    
                    <div className="mt-5 p-6 rounded-2xl border-2 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 transition-all hover:scale-[1.01] hover:shadow-amber-500/5">
                      <div>
                        <p className="text-[10px] md:text-[11px] font-black uppercase tracking-widest">Total isolated Mess Rent (Payable)</p>
                        <h3 className="text-3xl md:text-4xl font-black mt-1 tracking-tighter">৳ {selectedModalUser.fixedMessBill.toLocaleString()}</h3>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="hidden print:block absolute bottom-4 left-6 text-[8px] font-mono text-slate-400">Ledger final isolated snapshot generated on {new Date().toLocaleString()} for {selectedMonth} (Isolated System).</div>
          </div>
        </div>
      )}

    </div>
  );
}