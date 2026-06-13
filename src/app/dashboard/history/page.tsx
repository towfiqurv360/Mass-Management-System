"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

export default function HistoryPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [userRole, setUserRole] = useState("user");
  const [currentUserId, setCurrentUserId] = useState("");
  
  // History States
  const [archivedMonths, setArchivedMonths] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<any>(null);
  
  // Modal Detailed States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [monthDetails, setMonthDetails] = useState<any[]>([]);
  const [myPersonalStats, setMyPersonalStats] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchHistoryList();
  }, []);

  const fetchHistoryList = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      setUserRole(profile?.role || "user");

      // Fetch all closed months from monthly_reports table (descending order)
      const { data: historyData } = await supabase
        .from("monthly_reports")
        .select("*")
        .order("month", { ascending: false });
        
      setArchivedMonths(historyData || []);
    } catch (error) {
      toast.error("Failed to fetch archive records.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FETCH DETAILS WHEN A MONTH IS CLICKED
  const openMonthDetails = async (monthRecord: any) => {
    setSelectedMonth(monthRecord);
    setIsModalOpen(true);
    setModalLoading(true);

    try {
      // Fetch daily meals for the clicked month to calculate history
      const { data: monthMeals } = await supabase
        .from("daily_meals")
        .select("*")
        .like("date", `${monthRecord.month}%`);

      const { data: profiles } = await supabase.from("profiles").select("id, full_name, room_number");

      if (userRole === "user") {
        // 🔒 USER VIEW: Calculate only their personal data for that month
        const myMeals = (monthMeals || []).filter(m => m.user_id === currentUserId);
        const myTotalMeals = myMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
        
        setMyPersonalStats({
          totalMeals: myTotalMeals,
          totalCost: myTotalMeals * Number(monthRecord.meal_rate)
        });
      } else {
        // 🌐 ADMIN / SUPER ADMIN VIEW: Calculate everyone's data for that month
        const detailedArray = (profiles || []).map(p => {
          const uMeals = (monthMeals || []).filter(m => m.user_id === p.id);
          const uTotalMeals = uMeals.reduce((acc, m) => acc + Number(m.lunch || 0) + Number(m.dinner || 0) + Number(m.breakfast || 0) + Number(m.guest_lunch || 0) + Number(m.guest_dinner || 0), 0);
          return {
            id: p.id,
            full_name: p.full_name,
            room_number: p.room_number,
            totalMeals: uTotalMeals,
            totalCost: uTotalMeals * Number(monthRecord.meal_rate)
          };
        }).filter(item => item.totalMeals > 0); // Only show users who ate that month

        // Sort by highest meals
        detailedArray.sort((a, b) => b.totalMeals - a.totalMeals);
        setMonthDetails(detailedArray);
      }
    } catch (error) {
      toast.error("Failed to load month details.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedMonth(null);
      setMonthDetails([]);
      setMyPersonalStats(null);
    }, 200); // Wait for transition
  };

  if (!isMounted) return null;

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in z-0 pb-10 px-4 md:px-0 text-slate-900 dark:text-white">
      
      {/* Background Blobs */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 transition-transform duration-700 hover:scale-110"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 transition-transform duration-700 hover:scale-110"></div>

      {/* 🎯 HEADER BANNER */}
      <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 transition-all duration-300 hover:shadow-purple-500/5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-500 tracking-tight">Ledger Archives</h2>
            {userRole !== "user" && <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 text-[9px] font-black uppercase rounded shadow-sm border border-purple-200 dark:border-purple-500/30">Admin View</span>}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] font-bold mt-2 uppercase tracking-widest">Historical Financial Records & Monthly Statements</p>
        </div>
        <div className="w-12 h-12 bg-white/50 dark:bg-slate-800/50 border border-white/80 dark:border-slate-700 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
          📚
        </div>
      </div>

      {/* 📋 ARCHIVE LIST VIEW (ENTERPRISE TABLE) */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden transition-all duration-300">
        <div className="p-6 md:p-8 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/20 flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400 shadow-inner">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Closed Months Database</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Click any row to view full details</p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/50 dark:border-slate-700/50">
                <th className="px-6 py-5">Billing Month</th>
                <th className="px-6 py-5 text-center">Total Bazaar Expense</th>
                <th className="px-6 py-5 text-center">Final Meal Rate</th>
                <th className="px-6 py-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-20 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Retrieving Archives...</td></tr>
              ) : archivedMonths.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-20 opacity-50">
                    <span className="text-4xl mb-3 block">🗄️</span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">No archived records found.</span>
                  </td>
                </tr>
              ) : archivedMonths.map((record) => (
                <tr 
                  key={record.id} 
                  onClick={() => openMonthDetails(record)}
                  className="hover:bg-purple-50/50 dark:hover:bg-purple-500/10 transition-all cursor-pointer group active:scale-[0.99] relative"
                >
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 shadow-inner group-hover:from-purple-100 group-hover:to-indigo-100 dark:group-hover:from-purple-900/50 dark:group-hover:to-indigo-900/50 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-all">
                        {new Date(record.month + '-01').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-black text-sm md:text-base text-slate-900 dark:text-white tracking-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {new Date(record.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total Portions: {Number(record.total_meals).toFixed(1)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4.5 text-center">
                    <span className="font-black text-slate-800 dark:text-slate-200 text-sm">৳ {Number(record.total_bazaar).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4.5 text-center">
                    <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 shadow-sm">
                      ৳ {Number(record.meal_rate).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4.5 text-right">
                     <span className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 group-hover:shadow-md transition-all">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      Archived
                     </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🎯 ENTERPRISE MODAL: MONTH DETAILED BREAKDOWN             */}
      {/* ========================================================= */}
      {isModalOpen && selectedMonth && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { if(e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-700/80 overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 md:p-8 flex justify-between items-center shrink-0 relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl border border-white/30 shadow-inner">
                  📅
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-black tracking-tight drop-shadow-sm">
                    {new Date(selectedMonth.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-indigo-100 mt-1.5">Official Monthly Statement</p>
                </div>
              </div>
              <button onClick={closeModal} className="cursor-pointer relative z-10 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-xl font-bold transition-all shadow-sm active:scale-90">
                 ✕
              </button>
            </div>

            {/* Modal Body: Global Stats */}
            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900/30">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Expense</p>
                  <h4 className="text-2xl font-black text-slate-800 dark:text-white">৳ {Number(selectedMonth.total_bazaar).toLocaleString()}</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Portions</p>
                  <h4 className="text-2xl font-black text-slate-800 dark:text-white">{Number(selectedMonth.total_meals).toFixed(1)}</h4>
                </div>
                <div className="bg-purple-50 dark:bg-purple-500/10 p-5 rounded-2xl border border-purple-200 dark:border-purple-500/30 shadow-sm flex flex-col justify-center items-center text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-1">Final Meal Rate</p>
                  <h4 className="text-2xl font-black text-purple-700 dark:text-purple-400">৳ {Number(selectedMonth.meal_rate).toFixed(2)}</h4>
                </div>
              </div>

              {/* Conditional Breakdown based on Role */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                    {userRole === "user" ? "My Personal Statement" : "Detailed Resident Breakdown"}
                  </h3>
                </div>
                
                <div className="p-6">
                  {modalLoading ? (
                    <div className="text-center py-10 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Calculating historical data...</div>
                  ) : userRole === "user" ? (
                    // 🔒 USER SPECIFIC VIEW
                    <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="text-center sm:text-left mb-4 sm:mb-0">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">My Total Portions Eaten</p>
                        <p className="text-3xl font-black text-slate-800 dark:text-white">{myPersonalStats?.totalMeals?.toFixed(1) || 0}</p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">My Total Meal Cost</p>
                        <p className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tighter">৳ {myPersonalStats?.totalCost?.toFixed(2) || 0}</p>
                      </div>
                    </div>
                  ) : (
                    // 🌐 ADMIN / SUPER ADMIN VIEW (Full Table)
                    <div className="overflow-x-auto custom-scrollbar max-h-[300px]">
                      {monthDetails.length === 0 ? (
                        <div className="text-center py-8 text-xs font-bold text-slate-500 uppercase">No active meals recorded for this month.</div>
                      ) : (
                        <table className="w-full text-left border-collapse min-w-[500px]">
                          <thead>
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700">
                              <th className="pb-3">Resident Name</th>
                              <th className="pb-3 text-center">Room</th>
                              <th className="pb-3 text-center">Meals Eaten</th>
                              <th className="pb-3 text-right">Total Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {monthDetails.map((user) => (
                              <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                <td className="py-3 font-bold text-sm text-slate-800 dark:text-slate-200">{user.full_name}</td>
                                <td className="py-3 text-center text-xs font-bold text-slate-500">{user.room_number || "-"}</td>
                                <td className="py-3 text-center text-sm font-black text-indigo-600 dark:text-indigo-400">{user.totalMeals.toFixed(1)}</td>
                                <td className="py-3 text-right text-sm font-black text-rose-600 dark:text-rose-400">৳ {user.totalCost.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
            
            {/* Modal Footer */}
            <div className="bg-slate-100 dark:bg-slate-900 p-5 flex justify-end shrink-0 border-t border-slate-200 dark:border-slate-800">
              <button onClick={closeModal} className="px-8 py-3.5 bg-slate-800 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer">
                Close Record
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}