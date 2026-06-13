"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

const getLocalToday = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().split("T")[0];
};

export default function ExpenseLedgerPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState("user");

  const currentMonth = getLocalToday().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [isMonthClosed, setIsMonthClosed] = useState(false); // 🎯 History Lock State

  // States
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalMeals, setTotalMeals] = useState(0);

  // Form States
  const [amount, setAmount] = useState("");
  const [expenseType, setExpenseType] = useState("meal"); 
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getLocalToday());

  useEffect(() => {
    setIsMounted(true);
    fetchFinancials();
  }, [selectedMonth]);

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        const role = profile?.role || "user";
        setUserRole(role);
        // Default category selection based on role
        if (role === "super_admin") setExpenseType("utility");
        if (role === "admin") setExpenseType("meal");
      }

      // 🎯 Check if this month is archived/closed
      const { data: archiveData } = await supabase.from("monthly_reports").select("*").eq("month", selectedMonth).maybeSingle();
      if (archiveData) {
        setIsMonthClosed(true);
      } else {
        setIsMonthClosed(false);
      }

      // Fetch expenses
      const { data: expData } = await supabase.from("expenses").select("*").like("date", `${selectedMonth}%`).order("date", { ascending: false });
      setExpenses(expData || []);

      // Fetch meals
      const { data: allMonthMeals } = await supabase.from("daily_meals").select("breakfast, lunch, dinner, guest_lunch, guest_dinner").like("date", `${selectedMonth}%`);
      const totalM = allMonthMeals?.reduce((acc, curr) => acc + Number(curr.breakfast || 0) + Number(curr.lunch || 0) + Number(curr.dinner || 0) + Number(curr.guest_lunch || 0) + Number(curr.guest_dinner || 0), 0) || 0;
      setTotalMeals(totalM);

    } catch (error) {
      toast.error("Failed to sync financial ledger.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === "user") return toast.error("Unauthorized action!");
    if (isMonthClosed) return toast.error("Cannot add expenses to a closed month.");
    if (!amount || Number(amount) <= 0) return toast.error("Please enter a valid amount.");

    setActionLoading(true);
    const toastId = toast.loading("Recording isolated transaction...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("expenses").insert({
        amount: Number(amount),
        expense_type: expenseType,
        description: description || (expenseType === 'meal' ? "Daily Bazaar" : expenseType === 'gas' ? "Gas/Cooking Fuel" : "Mess Utility/Others"),
        date: date,
        created_by: user?.id
      });

      toast.success("Transaction recorded securely!", { id: toastId });
      setAmount(""); setDescription("");
      fetchFinancials();
    } catch (error) {
      toast.error("Failed to record expense.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string, type: string) => {
    if (userRole === "user") return;
    if (isMonthClosed) return toast.error("Cannot delete records from an archived month.");
    if (userRole === "admin" && type === "utility") return toast.error("Only Super Admin can delete utility expenses.");
    if (userRole === "super_admin" && (type === "meal" || type === "gas")) return toast.error("Only Meal Manager can delete bazaar/gas expenses.");
    
    if (!window.confirm("Are you sure you want to delete this transaction permanently?")) return;
    
    try {
      await supabase.from("expenses").delete().eq("id", id);
      toast.success("Transaction deleted successfully.");
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (error) {
      toast.error("Failed to delete record.");
    }
  };

  if (!isMounted) return null;

  // 🎯 Pure Mathematics
  const totalBazaar = expenses.filter(e => e.expense_type === 'meal').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalGas = expenses.filter(e => e.expense_type === 'gas').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalUtilities = expenses.filter(e => e.expense_type === 'utility').reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const liveMealRate = totalMeals > 0 ? (totalBazaar / totalMeals).toFixed(2) : "0.00";

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Background Glowing Blobs */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 transition-transform hover:scale-110 duration-700"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-orange-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 transition-transform hover:scale-110 duration-700"></div>

      {/* 🎯 Header Banner */}
      <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 transition-all hover:shadow-emerald-500/5">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 tracking-tight">Financial Ledger</h2>
            {isMonthClosed ? (
              <span className="px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-200 dark:border-rose-500/30 flex items-center gap-1.5 shadow-inner">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> 🔒 History Archived
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1.5 animate-pulse shadow-inner">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 🟢 Live Open Month
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] font-bold mt-1.5 uppercase tracking-widest">Separated Meal & Mess Expenses</p>
        </div>
        
        <div className="w-full sm:w-auto relative group">
          <input 
            type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} 
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-black bg-white dark:bg-slate-800 border-2 border-emerald-50 dark:border-slate-700 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-slate-800 dark:text-slate-200 shadow-sm cursor-pointer transition-all hover:border-emerald-200 dark:hover:border-slate-600 appearance-none"
          />
        </div>
      </div>

      {/* 🎯 CORE SEPARATED FINANCIALS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-3xl border border-white/50 dark:border-slate-700/50 shadow-lg hover:-translate-y-1 transition-transform group">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Bazaar (Food)</p>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">৳ {totalBazaar.toLocaleString()}</h3>
        </div>
        <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-3xl border border-white/50 dark:border-slate-700/50 shadow-lg hover:-translate-y-1 transition-transform group">
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Total Gas Bill</p>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">৳ {totalGas.toLocaleString()}</h3>
        </div>
        <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-3xl border border-white/50 dark:border-slate-700/50 shadow-lg hover:-translate-y-1 transition-transform group">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Mess Anushangik / Others</p>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">৳ {totalUtilities.toLocaleString()}</h3>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 md:p-6 rounded-3xl shadow-xl shadow-emerald-500/20 text-white relative overflow-hidden group hover:-translate-y-1 transition-transform">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-1">Pure Meal Rate</p>
            <h3 className="text-3xl md:text-4xl font-black tracking-tighter">৳ {liveMealRate}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: Add Expense Form (Admin & Super Admin) */}
        {userRole !== "user" && !isMonthClosed && (
          <div className="lg:col-span-1 space-y-6 animate-fade-in">
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl relative overflow-hidden group">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 border-b-2 border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg> Record New Expense
              </h3>
              <form onSubmit={handleAddExpense} className="space-y-5">
                
                {/* 🎯 Role-Based Category Selection */}
                <div className="grid grid-cols-2 gap-3">
                  
                  {userRole === "admin" && (
                    <>
                      <label className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-1 active:scale-95 ${expenseType === 'meal' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500 shadow-md' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
                        <input type="radio" name="extype" className="hidden" checked={expenseType === 'meal'} onChange={() => setExpenseType('meal')} />
                        <span className="text-2xl">🛒</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">Bazaar</span>
                      </label>
                      <label className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-1 active:scale-95 ${expenseType === 'gas' ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-500/20 dark:border-orange-500 shadow-md' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
                        <input type="radio" name="extype" className="hidden" checked={expenseType === 'gas'} onChange={() => setExpenseType('gas')} />
                        <span className="text-2xl">🔥</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">Gas</span>
                      </label>
                    </>
                  )}

                  {userRole === "super_admin" && (
                    <div className="col-span-2">
                      <label className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:-translate-y-1 active:scale-95 ${expenseType === 'utility' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500 shadow-md' : 'bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'}`}>
                        <input type="radio" name="extype" className="hidden" checked={expenseType === 'utility'} onChange={() => setExpenseType('utility')} />
                        <span className="text-3xl">💡</span>
                        <span className="text-[11px] font-black uppercase tracking-widest">Mess Incidental / Others</span>
                      </label>
                    </div>
                  )}

                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 mt-2">Amount (৳)</label>
                  <input type="number" placeholder="0.00" required value={amount} onChange={e => setAmount(e.target.value)} className={`w-full px-5 py-4 text-3xl font-black bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-xl outline-none transition-all shadow-inner placeholder:text-slate-300 dark:placeholder:text-slate-700 ${expenseType === 'gas' ? 'focus:border-orange-500 text-orange-600 dark:text-orange-400 focus:ring-4 focus:ring-orange-500/10' : expenseType === 'utility' ? 'focus:border-indigo-500 text-indigo-600 dark:text-indigo-400 focus:ring-4 focus:ring-indigo-500/10' : 'focus:border-emerald-500 text-emerald-600 dark:text-emerald-400 focus:ring-4 focus:ring-emerald-500/10'}`} />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date of Expense</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="cursor-pointer w-full px-5 py-3 text-sm font-bold bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all text-slate-700 dark:text-slate-200" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description / Note</label>
                  <input type="text" placeholder={expenseType === 'meal' ? 'e.g. Rice, Fish, Vegetables' : expenseType === 'gas' ? 'e.g. Cylinder Refill' : 'e.g. Cleaning Items, Light bulbs'} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-5 py-3 text-sm font-bold bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
                </div>

                <button type="submit" disabled={actionLoading} className="cursor-pointer w-full py-4 mt-2 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-indigo-600 dark:to-purple-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2">
                  {actionLoading ? "Processing..." : "Record Transaction"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 🔒 IF MONTH IS CLOSED - Show Locked Box instead of Form */}
        {userRole !== "user" && isMonthClosed && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-rose-50/50 dark:bg-rose-900/10 backdrop-blur-3xl p-8 rounded-[2rem] border-2 border-rose-100 dark:border-rose-900/30 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/50 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">🔒</div>
              <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">History Archived</h3>
              <p className="text-xs font-bold text-slate-500 mt-2 leading-relaxed">This month has been closed and finalized by the manager. You cannot add or delete expenses for an archived month.</p>
            </div>
          </div>
        )}

        {/* RIGHT PANEL: Transactions Timeline */}
        <div className={(userRole === "user" || isMonthClosed) ? "lg:col-span-3" : "lg:col-span-2"}>
          <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden h-full flex flex-col">
            <div className="p-6 md:p-8 border-b-2 border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-800/20 flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Expense Ledger History</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Complete transaction timeline</p>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 divide-y divide-slate-100 dark:divide-slate-800/50 flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                  <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Ledger...</div>
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-20 flex flex-col items-center justify-center opacity-60">
                  <div className="text-5xl mb-4">📭</div>
                  <div className="text-sm text-slate-500 font-bold">No expenses recorded for this month.</div>
                </div>
              ) : expenses.map((exp) => (
                <div key={exp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-all duration-300 gap-4 sm:gap-0">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-white/50 dark:border-slate-700/50 ${
                      exp.expense_type === 'meal' ? 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 text-emerald-600 dark:text-emerald-400' : 
                      exp.expense_type === 'gas' ? 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 text-orange-600 dark:text-orange-400' : 'bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {exp.expense_type === 'meal' ? '🛒' : exp.expense_type === 'gas' ? '🔥' : '💡'}
                    </div>
                    <div>
                      <p className="text-sm md:text-base font-black text-slate-900 dark:text-white tracking-tight">{exp.description}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm inline-block">
                        {new Date(exp.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} • {exp.expense_type === 'utility' ? 'Mess Utility' : exp.expense_type}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pl-18 sm:pl-0">
                    <span className="font-black text-xl text-slate-800 dark:text-slate-200 tracking-tighter">৳ {Number(exp.amount).toLocaleString()}</span>
                    
                    {/* Delete Access Control - Disabled if Month Closed */}
                    {!isMonthClosed && ((userRole === "admin" && (exp.expense_type === "meal" || exp.expense_type === "gas")) || 
                      (userRole === "super_admin" && exp.expense_type === "utility")) && (
                      <button onClick={() => handleDeleteExpense(exp.id, exp.expense_type)} className="cursor-pointer opacity-0 group-hover:opacity-100 text-rose-500 bg-rose-50 hover:bg-rose-500 hover:text-white dark:bg-rose-500/10 dark:hover:bg-rose-500 p-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-90">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}