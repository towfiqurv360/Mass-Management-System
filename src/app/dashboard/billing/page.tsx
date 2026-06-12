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
  
  // Financial Core States
  const [mealRate, setMealRate] = useState(0);
  const [totalMonthExpense, setTotalMonthExpense] = useState(0);
  const [totalMonthMeals, setTotalMonthMeals] = useState(0);
  const [membersBilling, setMembersBilling] = useState<any[]>([]);

  // 🎯 Bulk Configuration States (For Super Admin)
  const [bulkCategory, setBulkCategory] = useState("All");
  const [bulkRent, setBulkRent] = useState("");
  const [bulkMaid, setBulkMaid] = useState("");
  const [bulkWifi, setBulkWifi] = useState("");
  const [bulkElectricity, setBulkElectricity] = useState("");

  // 🎯 Modal & Individual Edit States
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

      // 1. Calculate Total Bazaar Expense (Meal only)
      const { data: expenses } = await supabase.from("expenses").select("amount").eq("expense_type", "meal").like("date", `${selectedMonth}%`);
      const tExpense = expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;
      setTotalMonthExpense(tExpense);

      // 2. Calculate Total Meals
      const { data: allMeals } = await supabase.from("daily_meals").select("*").like("date", `${selectedMonth}%`);
      const tMeals = allMeals?.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0) || 0;
      setTotalMonthMeals(tMeals);

      // 3. Derive Meal Rate
      const mRate = tMeals > 0 ? (tExpense / tMeals) : 0;
      setMealRate(mRate);

      // 4. Fetch Profiles & Calculate Individual Data
      const { data: profilesData } = await supabase.from("profiles").select("*").order("room_number", { ascending: true });
      
      const billingArray = (profilesData || []).map(p => {
        const myMeals = (allMeals || []).filter(m => m.user_id === p.id);
        const myTotalMeals = myMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
        
        // Meal Calculation
        const myMealCost = myTotalMeals * mRate;
        const myMealDeposit = Number(p.balance || 0); 
        const mealDueOrRefund = myMealDeposit - myMealCost;

        // Mess Bill Calculation
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

      // Update modal data if it's currently open
      if (selectedModalUser) {
        const updatedUser = billingArray.find(b => b.id === selectedModalUser.id);
        if (updatedUser) setSelectedModalUser(updatedUser);
      }

    } catch (error) {
      toast.error("Failed to generate billing data.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 BULK UPDATE LOGIC
  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return toast.error("Unauthorized action.");

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

      // Apply category filter if not "All"
      if (bulkCategory !== "All") {
        query = query.eq("room_category", bulkCategory);
      } else {
        // Just to satisfy the builder, apply to all by checking id is not null
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

  // 🚀 INDIVIDUAL EDIT LOGIC (INSIDE MODAL)
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
    const toastId = toast.loading("Updating resident's bills...");
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
      
      {/* Background Glows */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-amber-500/10 rounded-full filter blur-3xl pointer-events-none -z-10 print:hidden"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-rose-500/10 rounded-full filter blur-3xl pointer-events-none -z-10 print:hidden"></div>

      {/* Control Banner */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-rose-600">Automated Billing Engine</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Monthly Financial Settlement</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={() => window.print()} className="px-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
            <span>🖨️</span> Print Master Ledger
          </button>
          <input 
            type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} 
            className="px-5 py-3 text-sm font-black bg-white dark:bg-slate-900 border-2 border-amber-100 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 shadow-sm cursor-pointer"
          />
        </div>
      </div>

      {/* 🎯 BULK CONFIGURATION PANEL (Super Admin Only) */}
      {userRole === "super_admin" && (
        <div className="bg-gradient-to-br from-slate-900 to-[#0F172A] p-6 rounded-[2rem] border border-slate-700 shadow-2xl print:hidden text-white">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span>⚙️</span> Global Fixed Bill Configurator
          </h3>
          <form onSubmit={handleBulkUpdate} className="flex flex-wrap items-end gap-4">
            
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Apply To (Filter)</label>
              <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="w-full px-4 py-2.5 text-xs font-bold bg-slate-800 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500 cursor-pointer">
                <option value="All">All Members (Global)</option>
                <option value="Single">Single Rooms Only</option>
                <option value="Double">Double Rooms Only</option>
                <option value="Triple">Triple Rooms Only</option>
                <option value="Quad">Quad Rooms Only</option>
              </select>
            </div>

            <div className="flex-1 min-w-[100px]">
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Seat Rent</label>
              <input type="number" placeholder="৳ Auto" value={bulkRent} onChange={e => setBulkRent(e.target.value)} className="w-full px-4 py-2.5 text-xs font-bold bg-slate-800 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Maid Bill</label>
              <input type="number" placeholder="৳ Auto" value={bulkMaid} onChange={e => setBulkMaid(e.target.value)} className="w-full px-4 py-2.5 text-xs font-bold bg-slate-800 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">WiFi Bill</label>
              <input type="number" placeholder="৳ Auto" value={bulkWifi} onChange={e => setBulkWifi(e.target.value)} className="w-full px-4 py-2.5 text-xs font-bold bg-slate-800 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[9px] font-black uppercase text-slate-400 mb-1.5">Electricity</label>
              <input type="number" placeholder="৳ Auto" value={bulkElectricity} onChange={e => setBulkElectricity(e.target.value)} className="w-full px-4 py-2.5 text-xs font-bold bg-slate-800 border-2 border-slate-700 rounded-xl outline-none focus:border-amber-500" />
            </div>
            
            <button type="submit" disabled={actionLoading} className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-lg active:scale-95 h-fit">
              Apply Update
            </button>
          </form>
          <p className="text-[10px] text-slate-500 mt-3 font-semibold">* Leave a field empty if you do not want to update that specific bill across the selected category.</p>
        </div>
      )}

      {/* CORE SYSTEM METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:hidden">
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Month Meals</p>
            <h3 className="text-2xl font-black">{totalMonthMeals.toFixed(1)}</h3>
          </div>
          <span className="text-3xl opacity-50">🍽️</span>
        </div>
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Bazaar Cost</p>
            <h3 className="text-2xl font-black">৳ {totalMonthExpense.toLocaleString()}</h3>
          </div>
          <span className="text-3xl opacity-50">🛒</span>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-rose-600 p-6 rounded-[2rem] shadow-xl text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="z-10">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Final Meal Rate</p>
            <h3 className="text-3xl font-black">৳ {mealRate.toFixed(2)}</h3>
          </div>
          <span className="text-3xl z-10 opacity-80">📈</span>
        </div>
      </div>

      {/* PRINT ONLY HEADER */}
      <div className="hidden print:block border-b-4 border-slate-900 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase">Monthly Master Settlement Ledger</h1>
        <p className="text-sm font-bold text-slate-600 mt-1">Billing Month: {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        <div className="flex gap-8 mt-4">
          <p className="text-xs font-black uppercase">Meals: <span className="text-slate-600">{totalMonthMeals.toFixed(1)}</span></p>
          <p className="text-xs font-black uppercase">Bazaar: <span className="text-slate-600">৳ {totalMonthExpense.toLocaleString()}</span></p>
          <p className="text-xs font-black uppercase bg-slate-200 px-3 py-1 rounded">Rate: ৳ {mealRate.toFixed(2)}</p>
        </div>
      </div>

      {/* 🧾 COMPACT LIST VIEW 🧾 */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40 print:hidden flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Resident Directory & Invoice List</h3>
          <span className="text-[10px] font-black text-indigo-500 uppercase">Click on a row to view/edit details</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50 print:bg-slate-200 print:text-black">
                <th className="px-6 py-4">Resident</th>
                <th className="px-6 py-4">Meal Cost (Eat)</th>
                <th className="px-6 py-4">Fixed Mess Rent</th>
                <th className="px-6 py-4 text-right">Net Settlement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50 print:divide-slate-300">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-16 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Processing Master Ledger...</td></tr>
              ) : membersBilling.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-16 text-sm text-slate-400 font-bold">No billing profiles found.</td></tr>
              ) : membersBilling.map((member) => (
                <tr 
                  key={member.id} 
                  onClick={() => { setSelectedModalUser(member); setIsEditingIndividual(false); }}
                  className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4.5">
                    <div className="font-bold text-sm text-slate-900 dark:text-white print:text-black group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{member.full_name}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">Room {member.room_number || "N/A"} • {member.room_category || "Unassigned"}</div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-200 print:text-black">৳ {member.mealCost.toFixed(2)}</div>
                    <div className="text-[9px] font-black text-slate-400 mt-0.5">{member.totalMeals.toFixed(1)} Portions</div>
                  </td>
                  <td className="px-6 py-4.5">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-200 print:text-black">৳ {member.fixedMessBill.toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-slate-400 mt-0.5">Fixed Dues</div>
                  </td>
                  <td className="px-6 py-4.5 text-right">
                     <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${member.mealDueOrRefund >= 0 && member.fixedMessBill === 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10'}`}>
                        View Details ➔
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🎯 DETAILED MODAL (Pop-up on Click) 🎯 */}
      {/* ========================================== */}
      {selectedModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative transform transition-all scale-100">
            
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wide">{selectedModalUser.full_name}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">Room: {selectedModalUser.room_number || "N/A"} ({selectedModalUser.room_category}) • Phone: {selectedModalUser.phone || "N/A"}</p>
              </div>
              <button onClick={() => setSelectedModalUser(null)} className="w-10 h-10 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-500/20 dark:text-slate-300 dark:hover:text-rose-400 rounded-full flex items-center justify-center text-lg font-black transition-colors">
                ✕
              </button>
            </div>

            {/* Modal Body: Split Ledger Card */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
              
              {/* LEFT: Meal Ledger (খাওয়ার হিসাব) */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700 pb-2">Meal Ledger (Eating Account)</h4>
                
                <div className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                  <span>Total Portions Eaten</span>
                  <span>{selectedModalUser.totalMeals.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                  <span>Total Deposited Balance</span>
                  <span className="text-emerald-500">৳ {selectedModalUser.mealDeposit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span>Calculated Meal Cost</span>
                  <span className="text-rose-500">- ৳ {selectedModalUser.mealCost.toFixed(2)}</span>
                </div>
                
                <div className={`mt-2 p-4 rounded-2xl border-2 flex justify-between items-center ${selectedModalUser.mealDueOrRefund >= 0 ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest">{selectedModalUser.mealDueOrRefund >= 0 ? 'Meal Advance/Refund' : 'Meal Due Amount'}</p>
                    <h3 className="text-2xl font-black mt-1">৳ {Math.abs(selectedModalUser.mealDueOrRefund).toFixed(2)}</h3>
                  </div>
                </div>
              </div>

              {/* RIGHT: Fixed Mess Bills (মেসের ভাড়ার হিসাব) */}
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-4 md:pt-0 md:pl-8">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fixed Mess Bills (Payable)</h4>
                  {userRole === "super_admin" && !isEditingIndividual && (
                    <button onClick={openIndividualEdit} className="text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors">
                      Edit/Discount
                    </button>
                  )}
                </div>
                
                {isEditingIndividual ? (
                  // INDIVIDUAL EDIT MODE (Super Admin Only)
                  <div className="space-y-3 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-500/30">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">Adjust Individual Bills</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500">Seat Rent</label>
                        <input type="number" value={editForm.rent} onChange={e => setEditForm({...editForm, rent: Number(e.target.value)})} className="w-full p-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-amber-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500">Maid Bill</label>
                        <input type="number" value={editForm.maid} onChange={e => setEditForm({...editForm, maid: Number(e.target.value)})} className="w-full p-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-amber-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500">WiFi Bill</label>
                        <input type="number" value={editForm.wifi} onChange={e => setEditForm({...editForm, wifi: Number(e.target.value)})} className="w-full p-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-amber-500" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500">Electricity</label>
                        <input type="number" value={editForm.electricity} onChange={e => setEditForm({...editForm, electricity: Number(e.target.value)})} className="w-full p-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-amber-500" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setIsEditingIndividual(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase">Cancel</button>
                      <button onClick={saveIndividualEdit} disabled={actionLoading} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase shadow-md transition-all">Save Adjustments</button>
                    </div>
                  </div>
                ) : (
                  // VIEW MODE
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400"><span>Seat Rent:</span> <span>৳ {selectedModalUser.current_month_rent || 0}</span></div>
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400"><span>Maid/Cook:</span> <span>৳ {selectedModalUser.current_month_maid || 0}</span></div>
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400"><span>WiFi Bill:</span> <span>৳ {selectedModalUser.current_month_wifi || 0}</span></div>
                    <div className="flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3"><span>Electricity:</span> <span>৳ {selectedModalUser.current_month_electricity || 0}</span></div>
                    
                    <div className="mt-2 p-4 rounded-2xl border-2 bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 flex justify-between items-center">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest">Total Mess Rent (Payable)</p>
                        <h3 className="text-2xl font-black mt-1">৳ {selectedModalUser.fixedMessBill.toLocaleString()}</h3>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}