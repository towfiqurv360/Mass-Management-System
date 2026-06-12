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

      const { data: expData } = await supabase.from("expenses").select("*").like("date", `${selectedMonth}%`).order("date", { ascending: false });
      setExpenses(expData || []);

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
    if (userRole === "user") return toast.error("Unauthorized!");
    if (!amount || Number(amount) <= 0) return toast.error("Please enter a valid amount.");

    setActionLoading(true);
    const toastId = toast.loading("Recording transaction...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("expenses").insert({
        amount: Number(amount),
        expense_type: expenseType,
        description: description || (expenseType === 'meal' ? "Daily Bazaar" : expenseType === 'gas' ? "Gas/Cooking Fuel" : "Mess Utility/Others"),
        date: date,
        created_by: user?.id
      });

      toast.success("Transaction recorded!", { id: toastId });
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
    if (userRole === "admin" && type === "utility") return toast.error("Only Super Admin can delete utility expenses.");
    if (userRole === "super_admin" && (type === "meal" || type === "gas")) return toast.error("Only Meal Manager can delete bazaar/gas expenses.");
    
    if (!window.confirm("Delete this transaction?")) return;
    
    try {
      await supabase.from("expenses").delete().eq("id", id);
      toast.success("Transaction deleted.");
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (error) {
      toast.error("Failed to delete.");
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
      <div className="fixed top-20 left-10 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-orange-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      {/* Header Banner */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-orange-500">Financial Ledger</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Separated Meal & Mess Expenses</p>
        </div>
        <input 
          type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} 
          className="w-full sm:w-auto px-5 py-3 text-sm font-black bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-slate-700 rounded-2xl outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
        />
      </div>

      {/* 🎯 CORE SEPARATED FINANCIALS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Bazaar (Food)</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">৳ {totalBazaar.toLocaleString()}</h3>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md">
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Total Gas Bill</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">৳ {totalGas.toLocaleString()}</h3>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mess Anushangik / Others</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">৳ {totalUtilities.toLocaleString()}</h3>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-xl text-white">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Pure Meal Rate</p>
          <h3 className="text-3xl font-black mt-1">৳ {liveMealRate}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: Add Expense Form (Admin & Super Admin) */}
        {userRole !== "user" && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-3">
                Record New Expense
              </h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                
                {/* 🎯 Role-Based Category Selection */}
                <div className="grid grid-cols-2 gap-2">
                  
                  {userRole === "admin" && (
                    <>
                      <label className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${expenseType === 'meal' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                        <input type="radio" name="extype" className="hidden" checked={expenseType === 'meal'} onChange={() => setExpenseType('meal')} />
                        <span className="text-2xl">🛒</span>
                        <span className="text-[10px] font-black uppercase">Bazaar</span>
                      </label>
                      <label className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${expenseType === 'gas' ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                        <input type="radio" name="extype" className="hidden" checked={expenseType === 'gas'} onChange={() => setExpenseType('gas')} />
                        <span className="text-2xl">🔥</span>
                        <span className="text-[10px] font-black uppercase">Gas</span>
                      </label>
                    </>
                  )}

                  {userRole === "super_admin" && (
                    <div className="col-span-2">
                      <label className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${expenseType === 'utility' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                        <input type="radio" name="extype" className="hidden" checked={expenseType === 'utility'} onChange={() => setExpenseType('utility')} />
                        <span className="text-2xl">💡</span>
                        <span className="text-[10px] font-black uppercase">Mess Incidental / Others</span>
                      </label>
                    </div>
                  )}

                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5 mt-2">Amount (৳)</label>
                  <input type="number" placeholder="Enter amount" required value={amount} onChange={e => setAmount(e.target.value)} className={`w-full px-4 py-3 text-2xl font-black bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none ${expenseType === 'gas' ? 'focus:border-orange-500 text-orange-500' : expenseType === 'utility' ? 'focus:border-indigo-500 text-indigo-500' : 'focus:border-emerald-500 text-emerald-500'}`} />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                  <input type="text" placeholder={expenseType === 'meal' ? 'e.g. Rice, Fish' : expenseType === 'gas' ? 'e.g. Cylinder Refill' : 'e.g. Cleaning Items, Light bulbs'} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500" />
                </div>

                <button type="submit" disabled={actionLoading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-xs rounded-2xl shadow-md transition-all active:scale-98">
                  Record Transaction
                </button>
              </form>
            </div>
          </div>
        )}

        {/* RIGHT PANEL: Transactions Timeline */}
        <div className={userRole === "user" ? "lg:col-span-3" : "lg:col-span-2"}>
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                <span>🧾</span> Expense Ledger History
              </h3>
            </div>

            <div className="p-2 divide-y divide-slate-100/60 dark:divide-slate-800/40 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-10 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Loading Ledger...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 font-semibold">No expenses recorded for this month.</div>
              ) : expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 group transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner ${
                      exp.expense_type === 'meal' ? 'bg-emerald-100 text-emerald-600' : 
                      exp.expense_type === 'gas' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {exp.expense_type === 'meal' ? '🛒' : exp.expense_type === 'gas' ? '🔥' : '💡'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{exp.description}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">
                        {new Date(exp.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} • {exp.expense_type === 'utility' ? 'Mess Utility' : exp.expense_type}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-slate-800 dark:text-slate-200">৳ {Number(exp.amount).toLocaleString()}</span>
                    
                    {/* Delete Access Control */}
                    {((userRole === "admin" && (exp.expense_type === "meal" || exp.expense_type === "gas")) || 
                      (userRole === "super_admin" && exp.expense_type === "utility")) && (
                      <button onClick={() => handleDeleteExpense(exp.id, exp.expense_type)} className="opacity-0 group-hover:opacity-100 text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 p-2 rounded-lg text-xs font-bold transition-all">
                        ✕
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