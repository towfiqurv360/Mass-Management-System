"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

export default function DepositsAndReceipts() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [userRole, setUserRole] = useState("user");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<any[]>([]);

  // User Form States
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bKash");
  const [trxId, setTrxId] = useState("");

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const role = profile?.role || "user";
      setUserRole(role);

      // STRICT FILTER: Force this page to ONLY show meal deposits
      let query = supabase.from("deposits")
        .select(`*, profiles(full_name, room_number)`)
        .eq("deposit_type", "meal")
        .order("created_at", { ascending: false });
      
      // If the user is NOT the Mill Manager (admin), show only their own meal deposits
      if (role !== "admin") {
        query = query.eq("user_id", user.id); 
      }

      const { data, error } = await query;
      if (error) throw error;
      setDeposits(data || []);

    } catch (error: any) {
      toast.error("Failed to synchronize ledger data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    
    if (parseFloat(amount) < 50) return toast.error("Minimum deposit amount is ৳50");
    if (!trxId.trim()) return toast.error("Transaction ID or Reference is required!");

    const toastId = toast.loading("Submitting meal fund request...");
    setActionLoading(true);

    try {
      const { error } = await supabase.from("deposits").insert({
        user_id: currentUserId,
        amount: parseFloat(amount),
        method,
        transaction_id: trxId,
        deposit_type: "meal", 
        status: "pending"
      });

      if (error) throw error;
      
      toast.success("Meal fund request submitted successfully!", { id: toastId });
      setAmount("");
      setTrxId("");
      fetchDeposits();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (dep: any) => {
    const toastId = toast.loading("Approving meal deposit...");
    setActionLoading(true);

    try {
      const { error: depError } = await supabase.from("deposits").update({ status: "approved" }).eq("id", dep.id);
      if (depError) throw depError;

      // Update User's Meal Balance directly
      const { data: profile } = await supabase.from("profiles").select("balance").eq("id", dep.user_id).single();
      const newBalance = Number(profile?.balance || 0) + Number(dep.amount);
      await supabase.from("profiles").update({ balance: newBalance }).eq("id", dep.user_id);

      toast.success("Meal fund approved and added to balance!", { id: toastId });
      fetchDeposits();
    } catch (error: any) {
      toast.error("Approval failed: " + error.message, { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Reject this meal deposit request?")) return;
    
    const toastId = toast.loading("Rejecting transaction...");
    try {
      const { error } = await supabase.from("deposits").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
      
      toast.success("Transaction rejected successfully.", { id: toastId });
      fetchDeposits();
    } catch (error: any) {
      toast.error("Rejection failed.", { id: toastId });
    }
  };

  const pendingCount = deposits.filter(d => d.status === 'pending').length;
  const totalApproved = deposits.filter(d => d.status === 'approved').reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      
      {/* Title Header */}
      <div className="bg-white dark:bg-[#0F172A] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Meal Deposits Ledger</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {userRole === 'admin' ? "Manager Mode: Reviewing border meal fund additions." : "Add money to your personal meal balance."}
        </p>
      </div>

      {/* Analytics Summary Cards (Visible ONLY to Meal Manager/Admin) */}
      {userRole === "admin" && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Pending Meal Requests</p>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">{pendingCount} requests</h4>
            </div>
          </div>
          <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Approved Meal Fund</p>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">৳ {totalApproved.toLocaleString()}</h4>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Deposit Form Section */}
        <div className="xl:col-span-1">
          <div className="bg-white dark:bg-[#0F172A] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">Deposit Meal Fund</h3>
            <form onSubmit={handleSubmitDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Amount (BDT)</label>
                <input type="number" required min="50" placeholder="e.g. 500" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200">
                  <option value="Hand_Cash">Hand Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">TrxID / Payer Name Reference</label>
                <input type="text" required placeholder={method === "Hand_Cash" ? "e.g. Handed to Manager" : "Transaction ID"} value={trxId} onChange={(e) => setTrxId(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white" />
              </div>
              <button type="submit" disabled={actionLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm">
                Submit Deposit
              </button>
            </form>
          </div>
        </div>

        {/* History Table Section */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 text-sm font-bold text-slate-800 dark:text-slate-200">
              Meal History Logs
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-5 py-4">Date & Ref</th>
                    <th className="px-5 py-4">Border</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-10 text-sm font-medium text-slate-400 animate-pulse">Loading logs...</td></tr>
                  ) : deposits.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-sm text-slate-400">No meal deposits recorded.</td></tr>
                  ) : (
                    deposits.map((dep) => (
                      <tr key={dep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 text-sm">
                          <div className="font-semibold text-slate-900 dark:text-slate-200">{new Date(dep.created_at).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{dep.transaction_id}</div>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <div className="font-semibold text-slate-900 dark:text-slate-200">{dep.profiles?.full_name}</div>
                          <div className="text-xs text-slate-400">Room: {dep.profiles?.room_number || "N/A"}</div>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <div className="font-bold text-slate-900 dark:text-white">৳ {dep.amount}</div>
                          <div className="text-[10px] text-slate-400 uppercase mt-0.5">{dep.method.replace('_', ' ')}</div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {dep.status === "pending" ? (
                            userRole === "user" || userRole === "super_admin" ? (
                              <span className="text-amber-500 font-bold text-xs uppercase">Pending</span>
                            ) : (
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleApprove(dep)} disabled={actionLoading} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase">Approve</button>
                                <button onClick={() => handleReject(dep.id)} disabled={actionLoading} className="px-2.5 py-1 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase">Reject</button>
                              </div>
                            )
                          ) : (
                            <span className={`text-xs font-bold uppercase ${dep.status === 'approved' ? 'text-emerald-500' : 'text-slate-400'}`}>{dep.status}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}