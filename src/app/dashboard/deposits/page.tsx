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
  
  // 💰 Balances & Dues
  const [myMealBalance, setMyMealBalance] = useState(0);
  const [myMessBalance, setMyMessBalance] = useState(0);
  const [myGasBalance, setMyGasBalance] = useState(0);
  
  const [myTotalMessDue, setMyTotalMessDue] = useState(0);
  const [myGasDue, setMyGasDue] = useState(0);
  
  // 🗃️ Data States
  const [deposits, setDeposits] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // 📝 Form States
  const [selectedMember, setSelectedMember] = useState("");
  const [depositCategory, setDepositCategory] = useState("meal"); // 'meal' | 'mess' | 'gas'
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(getLocalToday());

  // 🔍 UI & Filter States
  const [activeTab, setActiveTab] = useState("ledger"); // 'ledger' | 'dues'
  const [ledgerFilter, setLedgerFilter] = useState("all"); // 'all' | 'meal' | 'mess' | 'gas'
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

  // 🎯 Auto-fill Amount Logic Based on Category & Selection
  useEffect(() => {
    if (depositCategory === "meal") {
      setAmount("");
      return;
    }

    if (userRole === "user") {
      if (depositCategory === "mess") setAmount(myTotalMessDue > 0 ? myTotalMessDue.toString() : "");
      if (depositCategory === "gas") setAmount(myGasDue > 0 ? myGasDue.toString() : "");
    } else if (selectedMember) {
      const targetMember = members.find(m => m.id === selectedMember);
      if (targetMember) {
        if (depositCategory === "mess") {
          const targetDue = Number(targetMember.current_month_rent || 0) + 
                            Number(targetMember.current_month_maid || 0) + 
                            Number(targetMember.current_month_wifi || 0) + 
                            Number(targetMember.current_month_electricity || 0);
          setAmount(targetDue > 0 ? targetDue.toString() : "");
        } else if (depositCategory === "gas") {
          const targetGasDue = Number(targetMember.current_month_gas || 0);
          setAmount(targetGasDue > 0 ? targetGasDue.toString() : "");
        }
      } else {
        setAmount("");
      }
    } else {
      setAmount("");
    }
  }, [depositCategory, myTotalMessDue, myGasDue, userRole, selectedMember, members]);

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
      setMyGasBalance(Number(profile?.gas_balance || 0));

      const rent = Number(profile?.current_month_rent || 0);
      const maid = Number(profile?.current_month_maid || 0);
      const wifi = Number(profile?.current_month_wifi || 0);
      const electricity = Number(profile?.current_month_electricity || 0);
      
      setMyTotalMessDue(rent + maid + wifi + electricity); 
      setMyGasDue(Number(profile?.current_month_gas || 0));

      // 🚀 FIXED: Using select("*") to strictly prevent column-not-found failures
      if (role !== "user") {
        const { data: allMembers } = await supabase.from("profiles")
          .select("*")
          .order("full_name");
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
    if (!amount || Number(amount) <= 0) {
      if (depositCategory === 'meal') return toast.error("Enter a valid amount greater than 0.");
      else return toast.error(`No pending due available for ${depositCategory}.`);
    }
    
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

      if (!isRequest) {
        const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", targetUserId).single();
        
        let updateData = {};
        if (depositCategory === "meal") updateData = { balance: Number(userProfile?.balance || 0) + Number(amount) };
        else if (depositCategory === "mess") updateData = { mess_balance: Number(userProfile?.mess_balance || 0) + Number(amount) };
        else if (depositCategory === "gas") updateData = { gas_balance: Number(userProfile?.gas_balance || 0) + Number(amount) };

        await supabase.from("profiles").update(updateData).eq("id", targetUserId);

        const categoryName = depositCategory === 'mess' ? 'Mess Rent' : depositCategory === 'gas' ? 'Gas Bill' : 'Meal Fund';

        await supabase.from("notifications").insert({
          user_id: targetUserId,
          title: "Deposit Added! ✅",
          message: `৳${amount} for ${categoryName} has been directly added to your balance.`,
        });

        if (userProfile?.email) {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: userProfile.email,
              subject: 'Deposit Added - Mess Management',
              html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; border-radius: 10px;">
                <h2>Deposit Successful!</h2>
                <p>Hello,</p>
                <p>An amount of <strong>৳${amount}</strong> for <strong>${categoryName}</strong> has been added to your account by the manager.</p>
                <br/><p>Regards,<br/>Mess Management Team</p>
              </div>`
            })
          }).catch(() => {}); 
        }
      }

      toast.success(isRequest ? "Deposit request sent!" : `Added ৳${amount} securely!`, { id: toastId });
      setAmount(""); 
      if (userRole !== "user") {
        setSearchTerm(""); 
        setSelectedMember("");
      }
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
      const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", targetUserId).single();
      
      let updateData = {};
      if (reqCategory === "meal") updateData = { balance: Number(userProfile?.balance || 0) + reqAmount };
      else if (reqCategory === "mess") updateData = { mess_balance: Number(userProfile?.mess_balance || 0) + reqAmount };
      else if (reqCategory === "gas") updateData = { gas_balance: Number(userProfile?.gas_balance || 0) + reqAmount };
      
      await supabase.from("profiles").update(updateData).eq("id", targetUserId);
      await supabase.from("deposits").update({ status: "approved" }).eq("id", depositId);
      
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
    if (!window.confirm("Reverse this transaction?")) return;

    setActionLoading(true);
    try {
      if (depStatus === "approved") {
        const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", targetUserId).single();
        let updateData = {};
        if (depCategory === "meal") updateData = { balance: Number(userProfile?.balance || 0) - depAmount };
        else if (depCategory === "mess") updateData = { mess_balance: Number(userProfile?.mess_balance || 0) - depAmount };
        else if (depCategory === "gas") updateData = { gas_balance: Number(userProfile?.gas_balance || 0) - depAmount };
        
        await supabase.from("profiles").update(updateData).eq("id", targetUserId);
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

  const sendDueReminder = async (email: string, name: string, amount: number, categoryName: string) => {
    if (!email) return toast.error("User does not have an email address.");
    const toastId = toast.loading(`Sending warning email to ${name}...`);
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `⚠️ URGENT: Due Payment Reminder - ${categoryName}`,
          html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #fff1f2; border-radius: 10px;">
              <h2>Payment Reminder</h2>
              <p>Hello <strong>${name}</strong>,</p>
              <p>Your payment for <strong>${categoryName}</strong> is pending.</p>
              <p>Due Amount: <strong>৳${amount}</strong></p>
              <br/><p>Thank you,<br/>Mess Manager</p>
            </div>`
        })
      });
      toast.success(`Reminder sent to ${name}`, { id: toastId });
    } catch (error) {
      toast.error("Failed to send email.", { id: toastId });
    }
  };

  if (!isMounted) return null;

  const adminTotalMeal = deposits.filter(d => d.status === "approved" && d.deposit_category === "meal").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const adminTotalMess = deposits.filter(d => d.status === "approved" && d.deposit_category === "mess").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const adminTotalGas = deposits.filter(d => d.status === "approved" && d.deposit_category === "gas").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pendingRequests = deposits.filter(d => d.status === "pending");

  // 🚀 FIXED: Robust live search filtering matching letters perfectly
  const filteredMembers = members.filter(m => 
    (m.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.room_number || "").toString().toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredLedger = ledgerFilter === "all" ? deposits : deposits.filter(d => d.deposit_category === ledgerFilter);

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      <div className="fixed top-20 left-10 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-teal-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-600">Fund Deposit Terminal</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Meal, Mess & Gas Vault</p>
        </div>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:bg-gradient-to-br dark:from-white dark:to-slate-200 px-6 py-5 rounded-3xl shadow-xl border border-slate-700 dark:border-white/20 flex items-center justify-between relative overflow-hidden group hover:-translate-y-1 transition-all">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 dark:text-emerald-600">{userRole === 'user' ? 'My Meal Balance' : 'System Meal Vault'}</p>
            <h3 className="text-2xl font-black text-white dark:text-slate-900 mt-1">৳ {userRole === 'user' ? myMealBalance.toLocaleString() : adminTotalMeal.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-500 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner z-10">🍽️</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:bg-gradient-to-br dark:from-white dark:to-slate-200 px-6 py-5 rounded-3xl shadow-xl border border-slate-700 dark:border-white/20 flex items-center justify-between relative overflow-hidden group hover:-translate-y-1 transition-all">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 dark:text-amber-600">{userRole === 'user' ? 'Mess Rent Paid' : 'Total Mess Rent'}</p>
            <h3 className="text-2xl font-black text-white dark:text-slate-900 mt-1">৳ {userRole === 'user' ? myMessBalance.toLocaleString() : adminTotalMess.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 bg-amber-500/20 text-amber-500 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner z-10">🏠</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 reposition to-slate-800 dark:bg-gradient-to-br dark:from-white dark:to-slate-200 px-6 py-5 rounded-3xl shadow-xl border border-slate-700 dark:border-white/20 flex items-center justify-between relative overflow-hidden group hover:-translate-y-1 transition-all">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 dark:text-rose-600">{userRole === 'user' ? 'Gas Bill Paid' : 'Total Gas Bill'}</p>
            <h3 className="text-2xl font-black text-white dark:text-slate-900 mt-1">৳ {userRole === 'user' ? myGasBalance.toLocaleString() : adminTotalGas.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 bg-rose-500/20 text-rose-500 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner z-10">🔥</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl relative overflow-visible">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-3 flex items-center gap-2">
              <span>💳</span> {userRole === "user" ? "Submit Deposit Request" : "Direct Add Deposit"}
            </h3>
            
            <form onSubmit={handleSubmitDeposit} className="space-y-5">
              {/* 🚀 FIXED SEARCH DROPDOWN ZONE */}
              {userRole !== "user" && (
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Search Resident</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      placeholder="Type Name or Room No..." 
                      value={searchTerm} 
                      onChange={(e) => { 
                        setSearchTerm(e.target.value); 
                        setShowDropdown(true); 
                        setSelectedMember(""); 
                        if (depositCategory !== 'meal') setAmount(""); 
                      }}
                      onFocus={(e) => { 
                        setShowDropdown(true); 
                        e.target.select(); 
                      }}
                      className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 pr-10"
                    />
                    {searchTerm && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setSearchTerm(""); setSelectedMember("");
                          if (depositCategory !== 'meal') setAmount("");
                          setShowDropdown(true);
                        }} 
                        className="absolute right-3 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>

                  {showDropdown && (
                    <div className="absolute left-0 top-full w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-[999] py-1 animate-fade-in">
                      {filteredMembers.length > 0 ? filteredMembers.map(m => (
                        <div key={m.id} onClick={() => { setSelectedMember(m.id); setSearchTerm(m.full_name || ""); setShowDropdown(false); }} className="px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer flex justify-between items-center transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.full_name}</span>
                          <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">R: {m.room_number || 'N/A'}</span>
                        </div>
                      )) : (
                        <div className="p-4 text-xs font-bold text-slate-400 text-center">No residents found.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CATEGORY SELECTOR */}
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl">
                <button type="button" onClick={() => setDepositCategory("meal")} className={`cursor-pointer flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${depositCategory === 'meal' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>🍽️ Meal</button>
                <button type="button" onClick={() => setDepositCategory("mess")} className={`cursor-pointer flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${depositCategory === 'mess' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>🏠 Mess</button>
                <button type="button" onClick={() => setDepositCategory("gas")} className={`cursor-pointer flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${depositCategory === 'gas' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>🔥 Gas</button>
              </div>

              {/* AMOUNT FIELDS */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Amount (৳) {depositCategory !== 'meal' && '- Locked (Exact Due Only)'}</label>
                <input 
                  type="number" 
                  placeholder={depositCategory === 'meal' ? "Enter amount" : "Auto-calculated due"} 
                  required 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  readOnly={depositCategory !== 'meal'}
                  className={`w-full px-4 py-3 text-2xl font-black border-2 rounded-xl outline-none transition-all ${
                    depositCategory === 'meal' 
                      ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-emerald-500 focus:border-emerald-500' 
                      : `bg-slate-50 dark:bg-slate-800 border-transparent cursor-not-allowed opacity-90 ${depositCategory === 'mess' ? 'text-amber-500' : 'text-rose-500'}`
                  }`} 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 cursor-pointer" />
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

              <button type="submit" disabled={actionLoading} className="cursor-pointer w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-lg active:scale-98 transition-all mt-2">
                {userRole === "user" ? "Send Request to Manager" : "Approve & Update Balance"}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-2 space-y-6">
          {userRole !== "user" && (
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md p-1.5 rounded-2xl w-full sm:w-auto self-start border border-slate-300/50 dark:border-slate-700/50">
              <button onClick={() => setActiveTab('ledger')} className={`cursor-pointer flex-1 sm:px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'ledger' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>Transaction Ledger</button>
              <button onClick={() => setActiveTab('dues')} className={`cursor-pointer flex-1 sm:px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'dues' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>Resident Dues Tracker</button>
            </div>
          )}

          {/* Pending requests */}
          {userRole !== "user" && pendingRequests.length > 0 && activeTab === 'ledger' && (
            <div className="bg-amber-50 dark:bg-amber-500/5 backdrop-blur-2xl rounded-[2rem] border-2 border-amber-200 dark:border-amber-500/30 shadow-xl overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-amber-200/50 dark:border-amber-500/20 bg-amber-100/50 dark:bg-amber-500/10">
                <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2"><span>🔔</span> Pending Requests ({pendingRequests.length})</h3>
              </div>
              <div className="p-2 divide-y divide-amber-200/30 dark:divide-amber-500/10">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/40 transition-colors">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        {req.profiles?.full_name} 
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${req.deposit_category === 'mess' ? 'bg-amber-200 text-amber-800' : req.deposit_category === 'gas' ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'}`}>{req.deposit_category}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1">Requested: ৳{req.amount} via {req.method}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDeleteDeposit(req.id, req.user_id, req.amount, req.deposit_category, req.status)} className="px-3 py-2 bg-white dark:bg-slate-800 text-rose-500 rounded-lg text-[10px] font-black uppercase border border-rose-200 hover:bg-rose-50">Reject</button>
                      <button onClick={() => handleApproveRequest(req.id, req.user_id, req.amount, req.deposit_category)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-md">Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Views */}
          {activeTab === 'ledger' || userRole === 'user' ? (
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in">
              <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40 flex justify-between items-center flex-wrap gap-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Transaction Ledger</h3>
                <div className="flex bg-slate-200/50 dark:bg-slate-900 p-1 rounded-lg">
                  {['all', 'meal', 'mess', 'gas'].map(filter => (
                    <button key={filter} onClick={() => setLedgerFilter(filter)} className={`cursor-pointer px-4 py-1.5 text-[9px] font-black uppercase rounded-md transition-all ${ledgerFilter === filter ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{filter}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50">
                      <th className="px-6 py-4">Fund Type</th>
                      {userRole !== "user" && <th className="px-6 py-4">Resident</th>}
                      <th className="px-6 py-4">Details</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                    {loading ? (
                      <tr><td colSpan={4} className="text-center py-16 text-xs font-black animate-pulse">Syncing Vault...</td></tr>
                    ) : filteredLedger.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-16 text-sm font-bold opacity-50">No transactions found.</td></tr>
                    ) : filteredLedger.map((trx) => (
                      <tr key={trx.id} className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${trx.deposit_category === 'mess' ? 'bg-amber-100 text-amber-700' : trx.deposit_category === 'gas' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {trx.deposit_category === 'mess' ? '🏠 Mess' : trx.deposit_category === 'gas' ? '🔥 Gas' : '🍽️ Meal'}
                          </span>
                        </td>
                        {userRole !== "user" && (
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm">{trx.profiles?.full_name}</div>
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm">{new Date(trx.date).toLocaleDateString()}</div>
                          <div className="text-[10px] font-black text-slate-500 uppercase mt-0.5">Via {trx.method}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`font-black text-lg ${trx.status === 'pending' ? 'text-amber-500' : 'text-slate-800 dark:text-white'}`}>
                            ৳{Number(trx.amount).toLocaleString()}
                          </div>
                          {userRole !== "user" && trx.status !== 'pending' && (
                            <button onClick={() => handleDeleteDeposit(trx.id, trx.user_id, trx.amount, trx.deposit_category, trx.status)} className="cursor-pointer opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 text-[9px] font-black uppercase mt-1">Reverse</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 2: ADMIN DUES TRACKER */
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden animate-fade-in">
               <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-rose-50/50 dark:bg-rose-500/5">
                <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2"><span>⚠️</span> Defaulter & Dues Tracker</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Monitor unpaid dues and send automatic email warnings.</p>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50">
                      <th className="px-6 py-4">Resident</th>
                      <th className="px-6 py-4 text-center">Mess Rent (Due vs Paid)</th>
                      <th className="px-6 py-4 text-center">Gas Bill (Due vs Paid)</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                    {members.map(m => {
                      const totalMessDue = Number(m.current_month_rent||0) + Number(m.current_month_maid||0) + Number(m.current_month_wifi||0) + Number(m.current_month_electricity||0);
                      const messPaid = Number(m.mess_balance||0);
                      const gasDue = Number(m.current_month_gas||0);
                      const gasPaid = Number(m.gas_balance||0);
                      
                      const isMessDefaulter = messPaid < totalMessDue && totalMessDue > 0;
                      const isGasDefaulter = gasPaid < gasDue && gasDue > 0;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm text-slate-900 dark:text-white">{m.full_name}</div>
                            <div className="text-[10px] font-semibold text-slate-500">Room: {m.room_number || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-xs font-black">
                              <span className="text-slate-400">৳{totalMessDue}</span> <span className="mx-1">/</span> 
                              <span className={isMessDefaulter ? "text-rose-500" : "text-emerald-500"}>৳{messPaid}</span>
                            </div>
                            {isMessDefaulter && <span className="text-[8px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-black uppercase">Unpaid</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-xs font-black">
                              <span className="text-slate-400">৳{gasDue}</span> <span className="mx-1">/</span> 
                              <span className={isGasDefaulter ? "text-rose-500" : "text-emerald-500"}>৳{gasPaid}</span>
                            </div>
                            {isGasDefaulter && <span className="text-[8px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-black uppercase">Unpaid</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col gap-2 items-end">
                              {isMessDefaulter && (
                                <button onClick={() => sendDueReminder(m.email, m.full_name, totalMessDue - messPaid, "Mess Rent")} className="cursor-pointer px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded text-[9px] font-black uppercase transition-all shadow-sm border border-rose-200">Alert Mess</button>
                              )}
                              {isGasDefaulter && (
                                <button onClick={() => sendDueReminder(m.email, m.full_name, gasDue - gasPaid, "Gas Bill")} className="cursor-pointer px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white rounded text-[9px] font-black uppercase transition-all shadow-sm border border-orange-200">Alert Gas</button>
                              )}
                              {(!isMessDefaulter && !isGasDefaulter) && (
                                <span className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg> Clear</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}