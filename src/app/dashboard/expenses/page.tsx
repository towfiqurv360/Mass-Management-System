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
        setUserRole(profile?.role || "user");
      }

      // Fetch expenses for selected month
      const { data: expData } = await supabase.from("expenses").select("*").like("date", `${selectedMonth}%`).order("date", { ascending: false });
      setExpenses(expData || []);

      // Fetch total meals for Meal Rate calculation
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
    if (userRole === "user") return toast.error("Only managers can add expenses.");
    if (!amount || Number(amount) <= 0) return toast.error("Please enter a valid amount.");

    setActionLoading(true);
    const toastId = toast.loading("Recording transaction...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("expenses").insert({
        amount: Number(amount),
        expense_type: expenseType,
        description: description || (expenseType === 'meal' ? "Daily Bazaar" : "Utility Bill"),
        date: date,
        created_by: user?.id
      });

      toast.success("Transaction recorded successfully!", { id: toastId });
      setAmount(""); setDescription("");
      fetchFinancials();
    } catch (error) {
      toast.error("Failed to record expense.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (userRole === "user") return;
    if (!window.confirm("Delete this transaction? This affects the meal rate.")) return;
    
    try {
      await supabase.from("expenses").delete().eq("id", id);
      toast.success("Transaction deleted.");
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (error) {
      toast.error("Failed to delete.");
    }
  };

  if (!isMounted) return null;

  // Financial Mathematics
  const totalBazaar = expenses.filter(e => e.expense_type === 'meal').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalUtilities = expenses.filter(e => e.expense_type !== 'meal').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const grandTotal = totalBazaar + totalUtilities;
  const liveMealRate = totalMeals > 0 ? (totalBazaar / totalMeals).toFixed(2) : "0.00";

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Background Glowing Blobs */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-rose-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-orange-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      {/* Header Banner */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-orange-500">Financial Ledger</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Mess Expense & Bazaar Tracking</p>
        </div>
        <input 
          type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} 
          className="w-full sm:w-auto px-5 py-3 text-sm font-black bg-white dark:bg-slate-900 border-2 border-rose-100 dark:border-slate-700 rounded-2xl outline-none focus:border-rose-500 shadow-sm cursor-pointer"
        />
      </div>

      {/* CORE FINANCIALS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Monthly Cost</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">৳ {grandTotal.toLocaleString()}</h3>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Bazaar (Meals)</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">৳ {totalBazaar.toLocaleString()}</h3>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-md">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Fixed Utilities</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">৳ {totalUtilities.toLocaleString()}</h3>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-orange-500 p-5 rounded-2xl shadow-xl text-white">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Live Meal Rate</p>
          <h3 className="text-3xl font-black mt-1">৳ {liveMealRate}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: Add Expense Form (Admin Only) */}
        {userRole !== "user" && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-3">Record New Expense</h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${expenseType === 'meal' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                    <input type="radio" name="extype" className="hidden" checked={expenseType === 'meal'} onChange={() => setExpenseType('meal')} />
                    <span className="text-xl">🛒</span>
                    <span className="text-[10px] font-black uppercase">Bazaar</span>
                  </label>
                  <label className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${expenseType === 'utility' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                    <input type="radio" name="extype" className="hidden" checked={expenseType === 'utility'} onChange={() => setExpenseType('utility')} />
                    <span className="text-xl">⚡</span>
                    <span className="text-[10px] font-black uppercase">Utility</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Amount (৳)</label>
                  <input type="number" placeholder="Enter amount" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-3 text-xl font-black bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-rose-500 text-rose-500" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-rose-500" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Description (Optional)</label>
                  <input type="text" placeholder="e.g. Rice, Fish, Electricity Bill" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-rose-500" />
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
                <span>🧾</span> Transaction History
              </h3>
            </div>

            <div className="p-2 divide-y divide-slate-100/60 dark:divide-slate-800/40 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-10 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Loading Ledger...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 font-semibold">No expenses recorded for this month.</div>
              ) : expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner ${exp.expense_type === 'meal' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {exp.expense_type === 'meal' ? '🛒' : '⚡'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{exp.description}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">
                        {new Date(exp.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} • {exp.expense_type}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-slate-800 dark:text-slate-200">৳ {Number(exp.amount).toLocaleString()}</span>
                    {userRole !== "user" && (
                      <button onClick={() => handleDeleteExpense(exp.id)} className="opacity-0 group-hover:opacity-100 text-rose-500 text-xs font-bold transition-opacity hover:scale-110">
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