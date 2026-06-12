"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

const getLocalToday = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().split("T")[0];
};

export default function DepositsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [userRole, setUserRole] = useState("user");
  const [currentUserId, setCurrentUserId] = useState("");
  
  // Balances
  const [myMealBalance, setMyMealBalance] = useState(0);
  const [myMessBalance, setMyMessBalance] = useState(0);
  const [myTotalMessDue, setMyTotalMessDue] = useState(0);
  
  // Data States
  const [deposits, setDeposits] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // Form States
  const [selectedMember, setSelectedMember] = useState("");
  const [depositCategory, setDepositCategory] = useState("meal"); // 'meal' or 'mess'
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(getLocalToday());

  // Searchable Dropdown States
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchDepositsData();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🎯 Auto-fill Mess Amount based on WHO is selected
  useEffect(() => {
    if (depositCategory === "mess") {
      if (userRole === "user") {
        setAmount(myTotalMessDue > 0 ? myTotalMessDue.toString() : "");
      } else if (selectedMember) {
        const targetMember = members.find(m => m.id === selectedMember);
        if (targetMember) {
          const targetDue = Number(targetMember.current_month_rent || 0) + 
                            Number(targetMember.current_month_maid || 0) + 
                            Number(targetMember.current_month_wifi || 0) + 
                            Number(targetMember.current_month_electricity || 0);
          setAmount(targetDue > 0 ? targetDue.toString() : "");
        } else {
          setAmount("");
        }
      } else {
        setAmount("");
      }
    } else if (depositCategory === "meal") {
      setAmount("");
    }
  }, [depositCategory, myTotalMessDue, userRole, selectedMember, members]);

  const fetchDepositsData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const role = profile?.role || "user";
      setUserRole(role);
      
      setMyMealBalance(Number(profile?.balance || 0));
      setMyMessBalance(Number(profile?.mess_balance || 0));

      const rent = Number(profile?.current_month_rent || 0);
      const maid = Number(profile?.current_month_maid || 0);
      const wifi = Number(profile?.current_month_wifi || 0);
      const electricity = Number(profile?.current_month_electricity || 0);
      setMyTotalMessDue(rent + maid + wifi + electricity); 

      if (role !== "user") {
        const { data: allMembers } = await supabase.from("profiles").select("id, full_name, room_number, current_month_rent, current_month_maid, current_month_wifi, current_month_electricity, email").order("full_name");
        setMembers(allMembers || []);

        const { data: allDeposits } = await supabase.from("deposits")
          .select(`*, profiles(full_name, room_number)`)
          .order("created_at", { ascending: false });
        setDeposits(allDeposits || []);
      } else {
        const { data: myDeposits } = await supabase.from("deposits")
          .select(`*, profiles(full_name, room_number)`)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setDeposits(myDeposits || []);
      }
    } catch (error) {
      toast.error("Failed to sync deposit vault.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount.");
    
    const targetUserId = userRole === "user" ? currentUserId : selectedMember;
    if (!targetUserId) return toast.error("Please search and select a resident first.");

    setActionLoading(true);
    const isRequest = userRole === "user";
    const toastId = toast.loading(isRequest ? "Submitting deposit request..." : "Processing direct deposit...");

    try {
      const initialStatus = isRequest ? "pending" : "approved";

      const { error: depositErr } = await supabase.from("deposits").insert({
        user_id: targetUserId, amount: Number(amount), method: method, date: date, status: initialStatus, deposit_category: depositCategory
      });
      if (depositErr) throw depositErr;

      // Admin Direct Add Logic
      if (!isRequest) {
        const { data: userProfile } = await supabase.from("profiles").select("balance, mess_balance, email").eq("id", targetUserId).single();
        if (depositCategory === "meal") {
          await supabase.from("profiles").update({ balance: Number(userProfile?.balance || 0) + Number(amount) }).eq("id", targetUserId);
        } else {
          await supabase.from("profiles").update({ mess_balance: Number(userProfile?.mess_balance || 0) + Number(amount) }).eq("id", targetUserId);
        }

        // Notification for Direct Add
        await supabase.from("notifications").insert({
          user_id: targetUserId,
          title: "Deposit Added! ✅",
          message: `৳${amount} for ${depositCategory === 'mess' ? 'Mess Rent' : 'Meal Fund'} has been directly added to your balance.`,
        });

        // Email for Direct Add
        if (userProfile?.email) {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: userProfile.email,
              subject: 'Deposit Added - Mess Management',
              html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 10px;">
                <h2 style="color: #10b981;">Deposit Successful!</h2>
                <p>Hello,</p>
                <p>An amount of <strong>৳${amount}</strong> for <strong>${depositCategory.toUpperCase()}</strong> has been added to your account by the manager.</p>
                <p>Your updated balance is now live on your dashboard.</p>
                <br/><p>Regards,<br/>Mess Management Team</p>
              </div>`
            })
          }).catch(console.error); // Catch email errors silently so it doesn't break the app
        }
      }

      toast.success(isRequest ? "Deposit request sent!" : `Added ৳${amount} to account!`, { id: toastId });
      
      setAmount(""); 
      if (userRole !== "user") {
        setSearchTerm(""); 
        setSelectedMember("");
      }
      setDepositCategory("meal");
      
      fetchDepositsData();
    } catch (error) {
      toast.error("Transaction failed.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRequest = async (depositId: string, targetUserId: string, reqAmount: number, reqCategory: string) => {
    if (userRole === "user") return;
    setActionLoading(true);
    const toastId = toast.loading("Approving request...");
    try {
      // 🎯 FIX: Select email along with balances inside the try block
      const { data: userProfile } = await supabase.from("profiles").select("balance, mess_balance, email").eq("id", targetUserId).single();
      
      if (reqCategory === "meal") {
        await supabase.from("profiles").update({ balance: Number(userProfile?.balance || 0) + reqAmount }).eq("id", targetUserId);
      } else {
        await supabase.from("profiles").update({ mess_balance: Number(userProfile?.mess_balance || 0) + reqAmount }).eq("id", targetUserId);
      }
      
      await supabase.from("deposits").update({ status: "approved" }).eq("id", depositId);
      
      // 🎯 FIX: Notification and Email logic placed correctly inside try block
      await supabase.from("notifications").insert({
        user_id: targetUserId,
        title: "Deposit Approved! ✅",
        message: `Your deposit of ৳${reqAmount} for ${reqCategory === 'mess' ? 'Mess Rent' : 'Meal Fund'} has been approved and added to your balance.`,
      });

      const userEmail = userProfile?.email; 
      if (userEmail) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userEmail,
            subject: 'Deposit Approved - Mess Management',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 10px;">
                <h2 style="color: #10b981;">Deposit Successful!</h2>
                <p>Hello,</p>
                <p>Your deposit request of <strong>৳${reqAmount}</strong> for <strong>${reqCategory.toUpperCase()}</strong> has been verified by the manager.</p>
                <p>Your updated balance is now live on your dashboard.</p>
                <br/>
                <p>Regards,<br/>Mess Management Team</p>
              </div>
            `
          })
        }).catch(console.error); // Silent catch for email fetch to prevent crashing
      }

      toast.success("Request approved!", { id: toastId });
      fetchDepositsData();
    } catch (error) {
      toast.error("Failed to approve.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDeposit = async (depositId: string, targetUserId: string, depAmount: number, depCategory: string, depStatus: string) => {
    if (userRole === "user") return;
    if (!window.confirm("Reverse this transaction? Balance will be deducted if approved.")) return;

    setActionLoading(true);
    try {
      if (depStatus === "approved") {
        const { data: userProfile } = await supabase.from("profiles").select("balance, mess_balance").eq("id", targetUserId).single();
        if (depCategory === "meal") {
          await supabase.from("profiles").update({ balance: Number(userProfile?.balance || 0) - depAmount }).eq("id", targetUserId);
        } else {
          await supabase.from("profiles").update({ mess_balance: Number(userProfile?.mess_balance || 0) - depAmount }).eq("id", targetUserId);
        }
      }
      await supabase.from("deposits").delete().eq("id", depositId);
      toast.success("Transaction reversed.");
      fetchDepositsData();
    } catch (error) {
      toast.error("Failed to reverse.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isMounted) return null;

  // Global Admin Variables
  const adminTotalMeal = deposits.filter(d => d.status === "approved" && d.deposit_category === "meal").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const adminTotalMess = deposits.filter(d => d.status === "approved" && d.deposit_category === "mess").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingRequests = deposits.filter(d => d.status === "pending");

  // Search Filter for Auto-complete
  const filteredMembers = members.filter(m => 
    m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.room_number && m.room_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Premium Background Glows */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-teal-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      {/* Header Banner */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-600">Fund Deposit Terminal</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Meal & Mess Rent Vault</p>
        </div>
      </div>

      {/* 🎯 TOP FINANCIAL WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:bg-gradient-to-br dark:from-white dark:to-slate-200 px-6 py-5 rounded-3xl shadow-xl border border-slate-700 dark:border-white/20 flex items-center justify-between relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 dark:text-emerald-600">
              {userRole === 'user' ? 'My Available Meal Fund' : 'System Total Meal Vault'}
            </p>
            <h3 className="text-3xl font-black text-white dark:text-slate-900 mt-1">
              ৳ {userRole === 'user' ? myMealBalance.toLocaleString() : adminTotalMeal.toLocaleString()}
            </h3>
          </div>
          <div className="w-14 h-14 bg-emerald-500/20 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner z-10">🍽️</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:bg-gradient-to-br dark:from-white dark:to-slate-200 px-6 py-5 rounded-3xl shadow-xl border border-slate-700 dark:border-white/20 flex items-center justify-between relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 dark:text-amber-600">
              {userRole === 'user' ? 'My Mess Rent Paid' : 'System Total Mess Collected'}
            </p>
            <h3 className="text-3xl font-black text-white dark:text-slate-900 mt-1">
              ৳ {userRole === 'user' ? myMessBalance.toLocaleString() : adminTotalMess.toLocaleString()}
            </h3>
          </div>
          <div className="w-14 h-14 bg-amber-500/20 text-amber-500 dark:bg-amber-500/10 dark:text-amber-600 rounded-2xl flex items-center justify-center text-3xl shadow-inner z-10">🏠</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: Deposit Request / Add Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl relative overflow-visible">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-3 flex items-center gap-2">
              <span>💳</span> {userRole === "user" ? "Submit Deposit Request" : "Direct Add Deposit"}
            </h3>
            
            <form onSubmit={handleSubmitDeposit} className="space-y-5">
              
              {/* 🎯 PRO SEARCHABLE DROPDOWN (Admin Only) */}
              {userRole !== "user" && (
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Search Resident</label>
                  <input 
                    type="text" 
                    placeholder="Type Name or Room No..." 
                    value={searchTerm} 
                    onChange={(e) => { 
                      setSearchTerm(e.target.value); 
                      setShowDropdown(true); 
                      setSelectedMember(""); 
                      if (depositCategory === 'mess') setAmount(""); 
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500"
                  />
                  {showDropdown && (
                    <div className="absolute w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50">
                      {filteredMembers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 font-bold text-center">No residents found.</div>
                      ) : (
                        filteredMembers.map(m => (
                          <div 
                            key={m.id} 
                            onClick={() => { 
                              setSelectedMember(m.id); 
                              setSearchTerm(`${m.full_name} (Room: ${m.room_number || 'N/A'})`); 
                              setShowDropdown(false); 
                            }}
                            className="px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer flex justify-between items-center transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.full_name}</span>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">R: {m.room_number || 'N/A'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Category Selector */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl">
                <button type="button" onClick={() => setDepositCategory("meal")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${depositCategory === 'meal' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                  🍽️ Meal Fund
                </button>
                <button type="button" onClick={() => setDepositCategory("mess")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${depositCategory === 'mess' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                  🏠 Mess Rent
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Amount (৳) {depositCategory === 'mess' && '- Auto Fetched'}</label>
                <input type="number" placeholder="Enter amount" required value={amount} onChange={e => setAmount(e.target.value)} className={`w-full px-4 py-3 text-2xl font-black bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 ${depositCategory === 'mess' ? 'text-amber-500' : 'text-emerald-500'}`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Method</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} className="w-full px-3 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 cursor-pointer">
                    <option value="Cash">💵 Cash</option>
                    <option value="bKash">🦅 bKash</option>
                    <option value="Nagad">🔥 Nagad</option>
                    <option value="Bank">🏦 Bank</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={actionLoading} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-lg active:scale-98 transition-all mt-2">
                {userRole === "user" ? "Send Request to Manager" : "Approve & Update Balance"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT PANEL: Pending Requests & History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Admin Pending Requests Box */}
          {userRole !== "user" && pendingRequests.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-500/5 backdrop-blur-2xl rounded-[2rem] border-2 border-amber-200 dark:border-amber-500/30 shadow-xl overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-amber-200/50 dark:border-amber-500/20 bg-amber-100/50 dark:bg-amber-500/10">
                <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <span>🔔</span> Action Required: Pending Requests ({pendingRequests.length})
                </h3>
              </div>
              <div className="p-2 divide-y divide-amber-200/30 dark:divide-amber-500/10">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/40 dark:hover:bg-slate-900/40 transition-colors">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {req.profiles?.full_name} 
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${req.deposit_category === 'mess' ? 'bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-200 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                          {req.deposit_category}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1">Requested: ৳{req.amount} via {req.method} on {new Date(req.date).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDeleteDeposit(req.id, req.user_id, req.amount, req.deposit_category, req.status)} className="px-3 py-2 bg-white dark:bg-slate-800 text-rose-500 rounded-lg text-[10px] font-black uppercase border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-500/10">Reject</button>
                      <button onClick={() => handleApproveRequest(req.id, req.user_id, req.amount, req.deposit_category)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-md transition-all">Approve Fund</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deposit History Ledger */}
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                {userRole === 'user' ? 'My Deposit Transactions' : 'Global Approved Ledger'}
              </h3>
            </div>
            
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50">
                    <th className="px-6 py-4">Fund Type</th>
                    {userRole !== "user" && <th className="px-6 py-4">Resident</th>}
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4 text-right">Status / Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                  {loading ? (
                    <tr><td colSpan={userRole === 'user' ? 3 : 4} className="text-center py-16 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Vault...</td></tr>
                  ) : deposits.length === 0 ? (
                    <tr><td colSpan={userRole === 'user' ? 3 : 4} className="text-center py-16 text-sm text-slate-400 font-bold">No transactions found.</td></tr>
                  ) : deposits.map((trx) => (
                    <tr key={trx.id} className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                      
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${trx.deposit_category === 'mess' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                          {trx.deposit_category === 'mess' ? '🏠 Mess Rent' : '🍽️ Meal Fund'}
                        </span>
                      </td>

                      {userRole !== "user" && (
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{trx.profiles?.full_name || 'Unknown'}</div>
                          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Room: {trx.profiles?.room_number || 'N/A'}</div>
                        </td>
                      )}

                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {new Date(trx.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] font-black text-slate-500 uppercase mt-0.5">Via {trx.method}</div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className={`font-black text-lg ${trx.status === 'pending' ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {trx.status === 'pending' ? '⏳' : '+'} ৳{Number(trx.amount).toLocaleString()}
                        </div>
                        <div className="flex justify-end gap-2 mt-1">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${trx.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {trx.status}
                          </span>
                          {userRole !== "user" && (
                            <button onClick={() => handleDeleteDeposit(trx.id, trx.user_id, trx.amount, trx.deposit_category, trx.status)} className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 text-[10px] font-black transition-opacity" title="Reverse Transaction">✕</button>
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

      </div>
    </div>
  );
}