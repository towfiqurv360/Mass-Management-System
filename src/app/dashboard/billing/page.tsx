"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

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
  const [isMonthClosed, setIsMonthClosed] = useState(false);
  
  // 💰 Financial Core States
  const [mealRate, setMealRate] = useState(0);
  const [totalMonthExpense, setTotalMonthExpense] = useState(0);
  const [totalMonthMeals, setTotalMonthMeals] = useState(0);
  
  // 🔥 Gas Core States
  const [totalGasExpense, setTotalGasExpense] = useState(0);
  const [totalGasCollected, setTotalGasCollected] = useState(0);
  
  const [membersBilling, setMembersBilling] = useState<any[]>([]);

  // =========================================================
  // 🚀 ENTERPRISE: FIXED MESS RENT CARD (Pure Mess Settings)
  // =========================================================
  const defaultRates = {
    Single: { rent: 2500, maid: 500, wifi: 200 },
    Double: { rent: 1800, maid: 400, wifi: 150 },
    Triple: { rent: 1500, maid: 300, wifi: 120 },
    Quad: { rent: 1200, maid: 300, wifi: 100 }
  };
  
  const [categoryRates, setCategoryRates] = useState<any>(defaultRates);
  const [globalElectricity, setGlobalElectricity] = useState("");
  const [globalGas, setGlobalGas] = useState(""); 

  // Modal & Individual Edit States
  const [selectedModalUser, setSelectedModalUser] = useState<any>(null);
  const [isEditingIndividual, setIsEditingIndividual] = useState(false);
  const [editForm, setEditForm] = useState({ rent: 0, maid: 0, wifi: 0, electricity: 0, gas: 0 });

  useEffect(() => {
    setIsMounted(true);
    const savedRates = localStorage.getItem("mess_pro_rate_card");
    if(savedRates) setCategoryRates(JSON.parse(savedRates));
    
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

      const { data: archiveData = null } = await supabase.from("monthly_reports").select("*").eq("month", selectedMonth).maybeSingle();
      
      let tExpense = 0; let tMeals = 0; let mRate = 0;
      let tGasExp = 0; let tGasCol = 0;

      if (archiveData) {
        setIsMonthClosed(true);
        tExpense = Number(archiveData.total_bazaar || 0);
        tMeals = Number(archiveData.total_meals || 0);
        mRate = Number(archiveData.meal_rate || 0);
        tGasExp = Number(archiveData.total_gas_expense || 0);
        tGasCol = Number(archiveData.total_gas_collected || 0);
      } else {
        setIsMonthClosed(false);
        // Meal Expenses
        const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_type", "meal").like("date", `${selectedMonth}%`);
        tExpense = expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

        // Gas Expenses
        const { data: gasExpenses } = await supabase.from("expenses").select("amount").eq("expense_type", "gas").like("date", `${selectedMonth}%`);
        tGasExp = gasExpenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

        // Gas Collections
        const { data: gasDeposits } = await supabase.from("deposits").select("amount").eq("deposit_category", "gas").eq("status", "approved").like("date", `${selectedMonth}%`);
        tGasCol = gasDeposits?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

        const { data: liveMeals } = await supabase.from("daily_meals").select("*").like("date", `${selectedMonth}%`);
        tMeals = liveMeals?.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0) || 0;
        
        mRate = tMeals > 0 ? (tExpense / tMeals) : 0;
      }

      setTotalMonthExpense(tExpense);
      setTotalMonthMeals(tMeals);
      setMealRate(mRate);
      setTotalGasExpense(tGasExp);
      setTotalGasCollected(tGasCol);

      const { data: allMeals } = await supabase.from("daily_meals").select("*").like("date", `${selectedMonth}%`);
      const { data: profilesData } = await supabase.from("profiles").select("*").order("room_number", { ascending: true });
      
      const billingArray = (profilesData || []).map(p => {
        const myMeals = (allMeals || []).filter(m => m.user_id === p.id);
        const myTotalMeals = myMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
        
        const myMealCost = myTotalMeals * mRate;
        const myMealDeposit = Number(p.balance || 0); 
        const mealDueOrRefund = myMealDeposit - myMealCost;

        const fixedMessBill = Number(p.current_month_rent || 0) + Number(p.current_month_maid || 0) + Number(p.current_month_wifi || 0) + Number(p.current_month_electricity || 0);
        const gasBill = Number(p.current_month_gas || 0);
        const gasDeposit = Number(p.gas_balance || 0);
        const gasDueOrRefund = gasDeposit - gasBill;

        return { 
          ...p, totalMeals: myTotalMeals, mealCost: myMealCost, mealDeposit: myMealDeposit, mealDueOrRefund, fixedMessBill, gasBill, gasDeposit, gasDueOrRefund
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

  const gasDeficit = totalGasExpense > totalGasCollected ? totalGasExpense - totalGasCollected : 0;
  const gasSurplus = totalGasCollected > totalGasExpense ? totalGasCollected - totalGasExpense : 0;

  // 🔒 STRICT: ONLY ADMIN (MEAL MANAGER) CLOSES THE MONTH
  const handleArchiveMonth = async () => {
    if (userRole !== "admin") return toast.error("Only the active Meal Manager can close the month.");
    if (!window.confirm(`⚠️ WARNING: You are about to CLOSE the month of ${selectedMonth}.\n\nThis will permanently deduct final meal costs and gas dues from everyone's balance. Proceed?`)) return;

    setActionLoading(true);
    const toastId = toast.loading(`Closing month ${selectedMonth}...`);

    try {
      const { error: archiveError } = await supabase.from("monthly_reports").insert({
        month: selectedMonth, total_bazaar: totalMonthExpense, total_meals: totalMonthMeals, meal_rate: mealRate,
        total_gas_expense: totalGasExpense, total_gas_collected: totalGasCollected, manager_gas_deficit: gasDeficit
      });
      if (archiveError) throw archiveError;

      const { data: allMealsForIsolation } = await supabase.from("daily_meals").select("*").like("date", `${selectedMonth}%`);
      const { data: profilesToIsolate } = await supabase.from("profiles").select("*");

      for(let p of profilesToIsolate || []) {
        const myMealsIsolation = (allMealsForIsolation || []).filter(m => m.user_id === p.id);
        const myMealsIsolationTotal = myMealsIsolation.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
        const myMealsIsolationCost = myMealsIsolationTotal * mealRate;
        
        const newMealBalance = Number(p.balance || 0) - myMealsIsolationCost;
        const newMessBalance = Number(p.mess_balance || 0) - (Number(p.current_month_rent || 0) + Number(p.current_month_maid || 0) + Number(p.current_month_wifi || 0) + Number(p.current_month_electricity || 0));
        const newGasBalance = Number(p.gas_balance || 0) - Number(p.current_month_gas || 0);

        await supabase.from("profiles").update({ 
          balance: newMealBalance,
          mess_balance: newMessBalance,
          gas_balance: newGasBalance
        }).eq("id", p.id);
      }

      // Reset Dues for the fresh month
      await supabase.from("profiles").update({
        current_month_rent: 0, current_month_maid: 0, current_month_wifi: 0, current_month_electricity: 0, current_month_gas: 0
      }).not("id", "is", null);

      toast.success("Month archived successfully!", { id: toastId });
      setIsMonthClosed(true);
      fetchBillingData();
    } catch (error) {
      toast.error("Failed to close month.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRateChange = (category: string, field: string, value: string) => {
    const updatedRates = {
      ...categoryRates,
      [category]: { ...categoryRates[category], [field]: Number(value) }
    };
    setCategoryRates(updatedRates);
    localStorage.setItem("mess_pro_rate_card", JSON.stringify(updatedRates));
  };

  // 🛡️ ROLE SEPARATION: Super Admin applies Mess Rent + Electricity
  const handleGlobalMessGenerate = async () => {
    if (userRole !== "super_admin") return toast.error("Unauthorized. Only the Super Admin manages Mess rent.");
    if (isMonthClosed) return toast.error("Cannot bill a closed month.");
    if (!window.confirm("⚡ Apply fixed room rents and electricity bills to everyone?")) return;

    setActionLoading(true);
    const toastId = toast.loading("Executing Global Mess Billing Engine...");
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, room_category, current_month_electricity");
      const promises = (profiles || []).map(p => {
        const cat = p.room_category && categoryRates[p.room_category] ? p.room_category : null;
        const myRates = cat ? categoryRates[cat] : { rent: 0, maid: 0, wifi: 0 };
        const myElectricity = globalElectricity !== "" ? Number(globalElectricity) : Number(p.current_month_electricity || 0);

        return supabase.from("profiles").update({
          current_month_rent: myRates.rent,
          current_month_maid: myRates.maid,
          current_month_wifi: myRates.wifi,
          current_month_electricity: myElectricity
        }).eq("id", p.id);
      });
      await Promise.all(promises);
      toast.success("Mess Bills successfully applied!", { id: toastId });
      setGlobalElectricity(""); 
      fetchBillingData();
    } catch (error) {
      toast.error("Global Mess Billing failed.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  // 🍳 ROLE SEPARATION: Admin (Meal Manager) applies Flat Gas Bill
  const handleGlobalGasGenerate = async () => {
    if (userRole !== "admin") return toast.error("Unauthorized. Only the active Admin (Meal Manager) handles Gas.");
    if (isMonthClosed) return toast.error("Cannot bill a closed month.");
    if (!globalGas || Number(globalGas) <= 0) return toast.error("Please provide a valid gas bill amount.");
    if (!window.confirm("⚡ Apply this flat Gas bill to all residents?")) return;

    setActionLoading(true);
    const toastId = toast.loading("Executing Global Gas Billing Engine...");
    try {
      const { data: profiles } = await supabase.from("profiles").select("id");
      const promises = (profiles || []).map(p => {
        return supabase.from("profiles").update({ current_month_gas: Number(globalGas) }).eq("id", p.id);
      });
      await Promise.all(promises);
      toast.success("Gas bills successfully assigned globally!", { id: toastId });
      setGlobalGas(""); 
      fetchBillingData();
    } catch (error) {
      toast.error("Global Gas Billing failed.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  // 🛠️ BUG FIX: Added the missing openIndividualEdit function
  const openIndividualEdit = () => {
    setIsEditingIndividual(true);
    setEditForm({
      rent: Number(selectedModalUser.current_month_rent || 0),
      maid: Number(selectedModalUser.current_month_maid || 0),
      wifi: Number(selectedModalUser.current_month_wifi || 0),
      electricity: Number(selectedModalUser.current_month_electricity || 0),
      gas: Number(selectedModalUser.current_month_gas || 0)
    });
  };

  // Selective Individual Save based on Role
  const saveIndividualEdit = async () => {
    setActionLoading(true);
    const toastId = toast.loading("Updating resident's billing profile...");
    try {
      let updatePayload = {};
      if (userRole === "super_admin") {
        updatePayload = {
          current_month_rent: editForm.rent, current_month_maid: editForm.maid,
          current_month_wifi: editForm.wifi, current_month_electricity: editForm.electricity
        };
      } else if (userRole === "admin") {
        updatePayload = { current_month_gas: editForm.gas };
      }

      const { error } = await supabase.from("profiles").update(updatePayload).eq("id", selectedModalUser.id);
      if (error) throw error;
      toast.success("Profile saved successfully!", { id: toastId });
      setIsEditingIndividual(false);
      fetchBillingData(); 
    } catch (error) {
      toast.error("Failed to save changes.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 md:space-y-8 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Background Glows (Premium Enterprise Look) */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-amber-500/10 rounded-full filter blur-[120px] pointer-events-none -z-10 print:hidden transition-transform duration-1000"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-rose-500/10 rounded-full filter blur-[120px] pointer-events-none -z-10 print:hidden transition-transform duration-1000"></div>

      {/* 🎯 HEADER BANNER */}
      <div className="bg-white/70 dark:bg-[#0F172A]/80 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 print:hidden transition-all duration-300 hover:shadow-amber-500/10 hover:border-white/80 dark:hover:border-slate-600/50">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-rose-600 tracking-tight drop-shadow-sm">Master Billing Engine</h2>
            <span className="px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-inner">
               {userRole === "super_admin" ? "🛡️ Super Admin View" : userRole === "admin" ? "🍳 Admin (Meal Manager)" : "Border Access"}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] font-bold mt-2 uppercase tracking-widest">Financial Settlement Terminal & Month End Ledger</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-end sm:items-center">
          <button onClick={() => window.print()} className="px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 cursor-pointer">
             🖨️ Print Ledger
          </button>
          
          {/* Only accessible to Rotating Admin */}
          {userRole === "admin" && !isMonthClosed && (
            <button onClick={handleArchiveMonth} disabled={actionLoading} className="cursor-pointer px-6 py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl hover:shadow-rose-500/30 active:scale-95 hover:-translate-y-0.5 disabled:opacity-70 flex items-center gap-2">
               🔒 Close Month
            </button>
          )}

          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full sm:w-auto px-5 py-3.5 text-sm font-black bg-slate-100 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 shadow-inner cursor-pointer transition-all" />
        </div>
      </div>

      {/* 🚀 PANELS SECTION BASED ON ACCOUNT RESPONSIBILITY */}
      {/* 1. SUPER ADMIN WORKSPACE: Only handles Category Rents & Electricity */}
      {userRole === "super_admin" && !isMonthClosed && (
        <div className="bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl print:hidden text-white relative group transition-all duration-500 hover:shadow-amber-500/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row gap-10">
            <div className="flex-1 w-full border-b lg:border-b-0 lg:border-r border-slate-700 pb-8 lg:pb-0 lg:pr-10">
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2">🛡️ Fixed Mess Bill Setup</h3>
              <p className="text-[10px] text-slate-400 font-bold mb-6 tracking-wider">Configure fixed room rents. Values auto-save locally to browser.</p>
              
              <div className="grid grid-cols-4 gap-3 text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3 pl-2">
                <div>Room Category</div><div className="text-center">Seat Rent</div><div className="text-center">Maid Bill</div><div className="text-center">WiFi Bill</div>
              </div>
              <div className="space-y-3">
                {Object.keys(categoryRates).map((cat) => (
                  <div key={cat} className="grid grid-cols-4 gap-3 items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                    <div className="font-bold text-[11px] sm:text-xs text-white pl-2">{cat}</div>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">৳</span><input type="number" value={categoryRates[cat].rent} onChange={(e) => handleRateChange(cat, 'rent', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-6 pr-2 text-center text-white outline-none text-xs font-bold focus:border-amber-500 transition-all" /></div>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">৳</span><input type="number" value={categoryRates[cat].maid} onChange={(e) => handleRateChange(cat, 'maid', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-6 pr-2 text-center text-white outline-none text-xs font-bold focus:border-amber-500 transition-all" /></div>
                    <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold">৳</span><input type="number" value={categoryRates[cat].wifi} onChange={(e) => handleRateChange(cat, 'wifi', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-6 pr-2 text-center text-white outline-none text-xs font-bold focus:border-amber-500 transition-all" /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full flex flex-col justify-center">
              <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl mb-6 shadow-inner">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-amber-400 font-black text-sm uppercase tracking-wide">Electricity Bill Per Head</h4>
                    <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest mt-1">Leave empty to skip electricity update</p>
                  </div>
                  <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">⚡</div>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-sm">৳</span>
                  <input type="number" value={globalElectricity} onChange={(e) => setGlobalElectricity(e.target.value)} placeholder="Amount per seat" className="w-full bg-slate-900 border-2 border-amber-500/50 rounded-xl py-3.5 pl-10 pr-4 text-sm font-black text-amber-300 outline-none focus:border-amber-400 focus:bg-slate-900 transition-all placeholder:text-amber-500/30" />
                </div>
              </div>
              <button onClick={handleGlobalMessGenerate} disabled={actionLoading} className="cursor-pointer w-full py-4.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-black uppercase text-xs tracking-widest rounded-xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Apply Mess Bills to All Members
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ROTATING ADMIN WORKSPACE: Only handles Gas Configuration */}
      {userRole === "admin" && !isMonthClosed && (
        <div className="bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl print:hidden text-white relative group animate-in slide-in-from-top-4 duration-300 hover:shadow-rose-500/10">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <h3 className="text-sm font-black text-rose-400 uppercase tracking-widest flex items-center gap-3">
                <span className="p-2 bg-rose-500/20 rounded-xl text-rose-400">🍳</span> Meal Manager Gas Terminal
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-2 tracking-wider leading-relaxed">Gas is tied directly to cooking and meals. Distribute the flat gas bill among all residents evenly. The system will auto-calculate deficit/surplus.</p>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto flex-1 md:flex-initial">
              <div className="relative flex-1 md:w-56">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500 font-black">৳</span>
                <input type="number" value={globalGas} onChange={(e) => setGlobalGas(e.target.value)} placeholder="Flat Gas Bill Amount" className="w-full bg-slate-900 border-2 border-rose-500/50 rounded-xl py-4 pl-10 text-sm font-black text-rose-300 outline-none focus:border-rose-400 focus:bg-slate-900 transition-all placeholder:text-rose-500/40" />
              </div>
              <button onClick={handleGlobalGasGenerate} disabled={actionLoading} className="cursor-pointer py-4 px-8 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg active:scale-95 shadow-rose-500/20 whitespace-nowrap">
                Apply Gas Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 SYSTEM SUMMARY METRICS (FINTECH DESIGN) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 print:hidden">
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex justify-between items-center group hover:-translate-y-1 transition-all duration-300 hover:shadow-indigo-500/10">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Total Meals</p><h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{totalMonthMeals.toFixed(1)}</h3></div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-2xl border dark:border-slate-700 shadow-sm group-hover:scale-110 transition-transform">🍽️</div>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex justify-between items-center group hover:-translate-y-1 transition-all duration-300 hover:shadow-emerald-500/10">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Total Bazaar</p><h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter">৳ {totalMonthExpense.toLocaleString()}</h3></div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-2xl border dark:border-slate-700 shadow-sm group-hover:scale-110 transition-transform">🛒</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-[2rem] text-white flex justify-between items-center relative overflow-hidden shadow-xl hover:-translate-y-1 transition-all duration-300 hover:shadow-orange-500/20 group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div className="z-10"><p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-1">Final Meal Rate</p><h3 className="text-4xl font-black tracking-tighter">৳ {mealRate.toFixed(2)}</h3></div>
        </div>
        <div className={`p-6 rounded-[2rem] text-white flex justify-between items-center relative overflow-hidden shadow-xl hover:-translate-y-1 transition-all duration-300 group ${gasDeficit > 0 ? 'bg-gradient-to-br from-rose-500 to-red-600 hover:shadow-rose-500/20' : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:shadow-emerald-500/20'}`}>
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div className="z-10">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-1">{gasDeficit > 0 ? 'Manager Gas Deficit' : 'Gas Surplus'}</p>
            <h3 className="text-4xl font-black tracking-tighter">{gasDeficit > 0 ? `- ৳${gasDeficit}` : `+ ৳${gasSurplus}`}</h3>
          </div>
        </div>
      </div>

      {/* PRINT ONLY HEADER */}
      <div className="hidden print:block border-b-4 border-slate-900 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase">Monthly Master Settlement Ledger</h1>
        <p className="text-sm font-bold text-slate-600 mt-1">Billing Month: {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} {isMonthClosed ? "(ARCHIVED)" : "(LIVE)"}</p>
      </div>

      {/* 🚀 MASTER DIRECTORY TABLE */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl rounded-[2.5rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-transparent transition-all duration-300 hover:shadow-indigo-500/5">
        <div className="p-6 md:p-8 border-b border-slate-200/50 dark:border-slate-800 bg-white/40 dark:bg-slate-800/20 flex items-center gap-4 print:hidden">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Resident Directory & Master Ledger</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Click any row for detailed month settlement breakdown</p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar min-h-[40vh]">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/50 dark:border-slate-700/50">
                <th className="px-6 py-5">Resident Profile</th>
                <th className="px-6 py-5">Meal Settlement</th>
                <th className="px-6 py-5">Fixed Mess Bill</th>
                <th className="px-6 py-5 text-right">Gas Ledger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50 print:text-black">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-20 text-xs font-black animate-pulse text-indigo-500 uppercase tracking-widest">Syncing Master Ledger Data...</td></tr>
              ) : membersBilling.map((member) => (
                <tr key={member.id} onClick={() => { setSelectedModalUser(member); setIsEditingIndividual(false); }} className="hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 transition-all cursor-pointer group active:scale-[0.99] relative">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center font-black text-indigo-600 dark:text-slate-300 shadow-sm border border-white/50 dark:border-slate-600 text-lg">
                        {member.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{member.full_name}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm">Room {member.room_number || "N/A"}</span>
                          <span className="text-[9px] font-black text-slate-400/90 uppercase">{member.room_category}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`font-black text-base ${member.mealDueOrRefund >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {member.mealDueOrRefund >= 0 ? '+ ' : '- '}৳ {Math.abs(member.mealDueOrRefund).toFixed(2)}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{member.mealDueOrRefund >= 0 ? 'Refundable Advance' : 'Meal Due Amount'}</div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-black text-base text-amber-600 dark:text-amber-400">৳ {member.fixedMessBill.toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Total Mess Dues</div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className={`font-black text-base ${member.gasDueOrRefund >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {member.gasDueOrRefund >= 0 ? '+ ' : '- '}৳ {Math.abs(member.gasDueOrRefund).toLocaleString()}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{member.gasDueOrRefund >= 0 ? 'Gas Advance' : 'Gas Due Amount'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🎯 DETAILED ACCOUNT POPUP MODAL (Glassmorphism Pro) */}
      {selectedModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 print:hidden" onClick={(e) => { if(e.target === e.currentTarget) setSelectedModalUser(null); }}>
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-5xl rounded-[2.5rem] shadow-2xl border-2 border-slate-200/50 dark:border-slate-700/80 overflow-hidden relative transform transition-all flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 border-b-2 border-slate-100 dark:border-slate-800 flex justify-between items-start shadow-inner">
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-2xl shadow-xl border-4 border-white dark:border-slate-800">
                  {selectedModalUser.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{selectedModalUser.full_name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 uppercase shadow-sm">Room: {selectedModalUser.room_number || "N/A"}</span>
                    <span className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 uppercase shadow-sm">{selectedModalUser.room_category}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedModalUser(null)} className="cursor-pointer w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-black flex items-center justify-center text-lg transition-all shadow active:scale-90">✕</button>
            </div>

            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 overflow-y-auto custom-scrollbar">
              
              {/* 🍽️ MEAL ACCOUNT */}
              <div className="space-y-5">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 dark:border-slate-800 pb-3.5 flex items-center gap-2">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500 shadow-inner">🍽️</span> Meal Ledger
                </h4>
                <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-inner text-sm font-semibold">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Portions Eaten</span><span className="text-slate-900 dark:text-white font-black">{selectedModalUser.totalMeals.toFixed(1)} Pcs</span></div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Deposited</span><span className="text-emerald-500 font-black">৳ {selectedModalUser.mealDeposit.toLocaleString()}</span></div>
                  <div className="flex justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"><span>Meal Cost</span><span className="text-rose-500 font-black">- ৳ {selectedModalUser.mealCost.toFixed(2)}</span></div>
                </div>
                <div className={`p-5 rounded-2xl border-2 transition-all ${selectedModalUser.mealDueOrRefund >= 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest">{selectedModalUser.mealDueOrRefund >= 0 ? 'Meal Advance' : 'Meal Due Amount'}</p>
                  <h3 className="text-3xl font-black mt-1 tracking-tighter">৳ {Math.abs(selectedModalUser.mealDueOrRefund).toFixed(2)}</h3>
                </div>
              </div>

              {/* 🏠 FIXED MESS BILL */}
              <div className="space-y-5 border-t md:border-t-0 md:border-l-2 border-slate-100 dark:border-slate-800 pl-0 md:pl-8 pt-6 md:pt-0">
                <div className="flex justify-between items-center border-b-2 border-slate-100 dark:border-slate-800 pb-3.5">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl text-amber-500 shadow-inner">🏠</span> Fixed Mess
                  </h4>
                  {userRole === "super_admin" && !isEditingIndividual && !isMonthClosed && (
                    <button onClick={openIndividualEdit} className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 px-3 py-1.5 rounded-lg transition-all border border-indigo-100 dark:border-indigo-500/20 active:scale-95 shadow-sm">Edit Dues</button>
                  )}
                </div>
                
                {isEditingIndividual && userRole === "super_admin" ? (
                  <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                    <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-500 uppercase">
                      <div><label className="block mb-1 tracking-widest text-[9px]">Seat Rent</label><input type="number" value={editForm.rent} onChange={e => setEditForm({...editForm, rent: Number(e.target.value)})} className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm" /></div>
                      <div><label className="block mb-1 tracking-widest text-[9px]">Maid</label><input type="number" value={editForm.maid} onChange={e => setEditForm({...editForm, maid: Number(e.target.value)})} className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm" /></div>
                      <div><label className="block mb-1 tracking-widest text-[9px]">WiFi</label><input type="number" value={editForm.wifi} onChange={e => setEditForm({...editForm, wifi: Number(e.target.value)})} className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm" /></div>
                      <div><label className="block mb-1 tracking-widest text-[9px]">Electricity</label><input type="number" value={editForm.electricity} onChange={e => setEditForm({...editForm, electricity: Number(e.target.value)})} className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm" /></div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setIsEditingIndividual(false)} className="cursor-pointer flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                      <button onClick={saveIndividualEdit} disabled={actionLoading} className="cursor-pointer flex-1 bg-amber-500 text-slate-900 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-amber-600 transition-colors">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-inner text-sm font-semibold">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Seat Rent</span><span className="text-slate-900 dark:text-white font-black">৳ {selectedModalUser.current_month_rent || 0}</span></div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Maid/Cook</span><span className="text-slate-900 dark:text-white font-black">৳ {selectedModalUser.current_month_maid || 0}</span></div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>WiFi Bill</span><span className="text-slate-900 dark:text-white font-black">৳ {selectedModalUser.current_month_wifi || 0}</span></div>
                    <div className="flex justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"><span>Electricity</span><span className="text-slate-900 dark:text-white font-black">৳ {selectedModalUser.current_month_electricity || 0}</span></div>
                    <div className="p-4 mt-2 rounded-xl border bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 text-amber-700 dark:text-amber-400">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1">Total Payable</p>
                      <h3 className="text-3xl font-black tracking-tighter">৳ {selectedModalUser.fixedMessBill.toLocaleString()}</h3>
                    </div>
                  </div>
                )}
              </div>

              {/* 🔥 GAS LEDGER */}
              <div className="space-y-5 border-t md:border-t-0 md:border-l-2 border-slate-100 dark:border-slate-800 pl-0 md:pl-8 pt-6 md:pt-0">
                <div className="flex justify-between items-center border-b-2 border-slate-100 dark:border-slate-800 pb-3.5">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl text-rose-500 shadow-inner">🔥</span> Gas Ledger
                  </h4>
                  {userRole === "admin" && !isEditingIndividual && !isMonthClosed && (
                    <button onClick={openIndividualEdit} className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 px-3 py-1.5 rounded-lg transition-all border border-rose-100 dark:border-rose-500/20 active:scale-95 shadow-sm">Edit Gas</button>
                  )}
                </div>
                
                {isEditingIndividual && userRole === "admin" ? (
                  <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                    <div>
                      <label className="block text-[9px] font-black uppercase text-rose-500 mb-1.5 tracking-widest">Adjust Individual Gas Bill</label>
                      <input type="number" value={editForm.gas} onChange={e => setEditForm({...editForm, gas: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-rose-200 dark:border-rose-500/50 outline-none focus:ring-2 focus:ring-rose-500 text-rose-600 dark:text-rose-400 text-sm font-black shadow-inner" placeholder="Gas Bill" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setIsEditingIndividual(false)} className="cursor-pointer flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                      <button onClick={saveIndividualEdit} disabled={actionLoading} className="cursor-pointer flex-1 bg-rose-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-rose-600 transition-colors">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 shadow-inner text-sm font-semibold">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Gas Deposit</span><span className="text-emerald-500 font-black">৳ {selectedModalUser.gasDeposit.toLocaleString()}</span></div>
                      <div className="flex justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"><span>Assigned Bill</span><span className="text-rose-500 font-black">- ৳ {selectedModalUser.gasBill.toLocaleString()}</span></div>
                    </div>
                    <div className={`p-5 rounded-2xl border-2 transition-all ${selectedModalUser.gasDueOrRefund >= 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest">{selectedModalUser.gasDueOrRefund >= 0 ? 'Gas Advance' : 'Gas Due Amount'}</p>
                      <h3 className="text-3xl font-black mt-1 tracking-tighter">৳ {Math.abs(selectedModalUser.gasDueOrRefund).toLocaleString()}</h3>
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}