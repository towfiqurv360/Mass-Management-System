"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

export default function BillingAndInvoice() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState("user");
  const [profile, setProfile] = useState<any>(null);

  // Super Admin Rent Approval States
  const [pendingRentPayments, setPendingRentPayments] = useState<any[]>([]);

  // System Settings
  const [settings, setSettings] = useState({ single_rent: 1400, double_rent: 1300, triple_rent: 1200, maid_bill: 280, wifi_bill: 0 });
  
  // Super Admin Inputs
  const [formSettings, setFormSettings] = useState({ single: "1400", double: "1300", triple: "1200", maid: "280", wifi: "0" });
  const [totalElectricity, setTotalElectricity] = useState("");
  
  // User Payment
  const [payMethod, setPayMethod] = useState("Hand_Cash");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      setUser(currentUser);

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
      if (profileData) {
        setProfile(profileData);
        setUserRole(profileData.role || "user");

        // Fetch rent verification queue strictly if Super Admin
        if (profileData.role === "super_admin") {
          const { data: rentRecords } = await supabase.from("deposits")
            .select(`*, profiles(full_name, room_number)`)
            .eq("deposit_type", "mess_rent")
            .order("created_at", { ascending: false });
          setPendingRentPayments(rentRecords || []);
        }
      }

      const { data: sysSettings } = await supabase.from("system_settings").select("*").eq("id", 1).maybeSingle();
      if (sysSettings) {
        setSettings(sysSettings);
        setFormSettings({
          single: sysSettings.single_rent?.toString() || "1400",
          double: sysSettings.double_rent?.toString() || "1300",
          triple: sysSettings.triple_rent?.toString() || "1200",
          maid: sysSettings.maid_bill?.toString() || "280",
          wifi: sysSettings.wifi_bill?.toString() || "0"
        });
      }
    } catch (error) {
      toast.error("Failed to fetch billing data.");
    } Velvet: {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return;
    
    const toastId = toast.loading("Saving global configurations...");
    setActionLoading(true);
    try {
      const { error } = await supabase.from("system_settings").upsert({
        id: 1, 
        single_rent: Number(formSettings.single),
        double_rent: Number(formSettings.double),
        triple_rent: Number(formSettings.triple),
        maid_bill: Number(formSettings.maid),
        wifi_bill: Number(formSettings.wifi)
      }, { onConflict: 'id' });

      if (error) throw error;
      toast.success("Configurations saved successfully!", { id: toastId });
      fetchData();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeployInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return;
    
    const electricity = parseFloat(totalElectricity);
    if (isNaN(electricity) || electricity < 0) return toast.error("Please enter a valid total electricity bill.");

    if (!window.confirm("Deploy invoices for all borders?")) return;

    const toastId = toast.loading("Deploying monthly invoices...");
    setActionLoading(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, room_type");
      if (!profiles || profiles.length === 0) throw new Error("No active borders found.");

      const perHeadElectricity = electricity / profiles.length;

      for (const p of profiles) {
        const rType = String(p.room_type || 'single').toLowerCase();
        let rent = settings.single_rent;
        if (rType.includes('double')) rent = settings.double_rent;
        else if (rType.includes('triple')) rent = settings.triple_rent;

        await supabase.from("profiles").update({
          current_month_rent: rent,
          current_month_maid: settings.maid_bill,
          current_month_wifi: settings.wifi_bill,
          current_month_electricity: perHeadElectricity,
          billing_status: 'pending_payment'
        }).eq("id", p.id);
      }

      toast.success("Invoices successfully deployed!", { id: toastId });
      setTotalElectricity("");
      fetchData();
    } catch (error: any) {
      toast.error("Deployment Failed: " + error.message, { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  // SUPER ADMIN: Approve Rent Record
  const handleApproveRent = async (dep: any) => {
    const toastId = toast.loading("Approving rent payment...");
    setActionLoading(true);
    try {
      await supabase.from("deposits").update({ status: "approved" }).eq("id", dep.id);
      
      // Wipe invoice fields and clear billing status
      await supabase.from("profiles").update({ 
        billing_status: 'clear',
        current_month_rent: 0,
        current_month_utility: 0,
        current_month_maid: 0,
        current_month_wifi: 0,
        current_month_electricity: 0
      }).eq("id", dep.user_id);

      toast.success("Rent payment approved and account cleared!", { id: toastId });
      fetchData();
    } catch (error: any) {
      toast.error("Process failed: " + error.message, { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectRent = async (id: string) => {
    if (!window.confirm("Reject this rent record?")) return;
    const toastId = toast.loading("Rejecting...");
    try {
      await supabase.from("deposits").update({ status: "rejected" }).eq("id", id);
      toast.success("Rent transaction rejected.", { id: toastId });
      fetchData();
    } catch (error) {
      toast.error("Action failed.", { id: toastId });
    }
  };

  // USER: Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalDue = (profile?.current_month_rent || 0) + (profile?.current_month_maid || 0) + (profile?.current_month_wifi || 0) + (profile?.current_month_electricity || 0);
    
    if (totalDue <= 0) return toast.error("You have no outstanding dues.");
    if (!paymentReference.trim()) return toast.error("Please provide a Reference or TrxID.");

    const toastId = toast.loading("Submitting payment record...");
    setActionLoading(true);
    try {
      const { error: depositError } = await supabase.from("deposits").insert({
        user_id: user.id, 
        amount: totalDue, 
        method: payMethod, 
        transaction_id: paymentReference, 
        status: 'pending', 
        deposit_type: 'mess_rent' // Flagged for Super Admin overview
      });
      if (depositError) throw depositError;

      await supabase.from("profiles").update({ billing_status: 'under_review' }).eq("id", user.id);
      toast.success("Payment record submitted to Super Admin!", { id: toastId });
      setPaymentReference("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm font-medium text-slate-500">Loading Billing Configuration...</div>;

  const rent = Number(profile?.current_month_rent || 0);
  const maid = Number(profile?.current_month_maid || 0);
  const wifi = Number(profile?.current_month_wifi || 0);
  const electricity = Number(profile?.current_month_electricity || 0);
  const totalDue = rent + maid + wifi + electricity;
  const billingStatus = profile?.billing_status || 'clear';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header Section */}
      <div className="bg-white dark:bg-[#0F172A] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Monthly Invoice Center</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage rent and monthly utility distributions.</p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
          billingStatus === 'pending_payment' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20' : 
          billingStatus === 'under_review' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' : 
          'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
        }`}>
          {billingStatus === 'pending_payment' ? 'UNPAID DUES' : billingStatus === 'under_review' ? 'VERIFICATION PENDING' : 'ACCOUNT CLEARED'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT: User Invoice Statement */}
        <div className="bg-white dark:bg-[#0F172A] p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-fit">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-5 border-b border-slate-100 dark:border-slate-800/60 pb-3">Your Current Billing Breakdown</h3>
          
          <div className="space-y-1 mb-6 flex-1">
            <div className="flex justify-between text-sm py-2.5">
              <span className="text-slate-600 dark:text-slate-400">Room Rent ({profile?.room_type || 'single'})</span>
              <span className="font-semibold text-slate-900 dark:text-white">৳ {rent.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm py-2.5">
              <span className="text-slate-600 dark:text-slate-400">Maid Bill (Fixed)</span>
              <span className="font-semibold text-slate-900 dark:text-white">৳ {maid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm py-2.5">
              <span className="text-slate-600 dark:text-slate-400">WiFi Bill (Fixed)</span>
              <span className="font-semibold text-slate-900 dark:text-white">৳ {wifi.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm py-2.5 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <span className="text-slate-600 dark:text-slate-400">Electricity Bill (Shared)</span>
              <span className="font-semibold text-slate-900 dark:text-white">৳ {electricity.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-base py-4 mt-2 font-bold bg-slate-50 dark:bg-slate-800/50 px-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <span className="text-slate-900 dark:text-white">Total Amount Due</span>
              <span className="text-blue-600 dark:text-blue-400">৳ {totalDue.toFixed(2)}</span>
            </div>
          </div>

          {billingStatus === 'pending_payment' && totalDue > 0 && (
            <form onSubmit={handleSubmitPayment} className="space-y-4 mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Settle Your Invoice</label>
              <div className="flex flex-col gap-3">
                <select value={payMethod} onChange={(e) => { setPayMethod(e.target.value); setPaymentReference(""); }} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-800 dark:text-slate-200">
                  <option value="Hand_Cash">Hand Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
                <input type="text" required placeholder={payMethod === "Hand_Cash" ? "Enter Payer Name or Note" : "Transaction ID"} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" />
              </div>
              <button type="submit" className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl">Submit Payment Record</button>
            </form>
          )}
        </div>

        {/* RIGHT: Super Admin Panels */}
        {userRole === "super_admin" && (
          <div className="space-y-6 flex flex-col">
            <div className="bg-white dark:bg-[#0F172A] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">Deploy Monthly Invoice</h3>
              <form onSubmit={handleDeployInvoice} className="space-y-4">
                <div className="flex gap-3">
                  <input type="number" required min="0" placeholder="Total Electricity Bill (৳)" value={totalElectricity} onChange={(e) => setTotalElectricity(e.target.value)} className="w-2/3 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" />
                  <button type="submit" className="w-1/3 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl">Deploy</button>
                </div>
              </form>
            </div>

            <div className="bg-white dark:bg-[#0F172A] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-100 dark:border-slate-800/60 pb-3">Global Default Configuration</h3>
              <form onSubmit={handleUpdateSettings} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <input type="number" required value={formSettings.single} onChange={e => setFormSettings({...formSettings, single: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl" />
                  <input type="number" required value={formSettings.double} onChange={e => setFormSettings({...formSettings, double: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl" />
                  <input type="number" required value={formSettings.triple} onChange={e => setFormSettings({...formSettings, triple: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" required value={formSettings.maid} onChange={e => setFormSettings({...formSettings, maid: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl" />
                  <input type="number" required value={formSettings.wifi} onChange={e => setFormSettings({...formSettings, wifi: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl" />
                </div>
                <button type="submit" className="w-full py-2.5 border border-slate-200 dark:border-slate-700 text-sm font-medium rounded-xl">Save Defaults</button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* SUPER ADMIN EXCLUSIVE: Rent Verification Ledger */}
      {userRole === "super_admin" && (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 text-sm font-bold text-slate-800 dark:text-slate-200">
            Rent & Utilities Approval Queue (Super Admin)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-5 py-4">Date & Note</th>
                  <th className="px-5 py-4">Border</th>
                  <th className="px-5 py-4">Amount Paid</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {pendingRentPayments.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-sm text-slate-400">No rent invoice histories found.</td></tr>
                ) : (
                  pendingRentPayments.map((dep) => (
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
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => handleApproveRent(dep)} disabled={actionLoading} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase">Approve</button>
                            <button onClick={() => handleRejectRent(dep.id)} disabled={actionLoading} className="px-2.5 py-1 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-lg text-[10px] font-bold uppercase">Reject</button>
                          </div>
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
      )}
    </div>
  );
}