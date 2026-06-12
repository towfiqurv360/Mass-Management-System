"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

const getLocalToday = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().split("T")[0];
};

export default function BazaarPlannerPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const [profileName, setProfileName] = useState("");

  const realTimeToday = getLocalToday();
  const [selectedDate, setSelectedDate] = useState(realTimeToday);

  // Core States
  const [items, setItems] = useState<any[]>([]);
  const [assignment, setAssignment] = useState({ person_1: "", person_2: "", image_url: "" });

  // Input Form States
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [estCost, setEstCost] = useState("");

  // Assignment Form States
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [imgUrl, setImgUrl] = useState("");

  useEffect(() => {
    setIsMounted(true);
    fetchBazaarData();
  }, [selectedDate]);

  const fetchBazaarData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
        setUserRole(profile?.role || "user");
        setProfileName(profile?.full_name || "Border");
      }

      // 1. Fetch Items
      const { data: itemsData } = await supabase.from("bazaar_planner").select("*").eq("date", selectedDate).order("created_at", { ascending: true });
      setItems(itemsData || []);

      // 2. Fetch Assignments Safely
      const { data: assignData } = await supabase.from("bazaar_assignments").select("*").eq("date", selectedDate).maybeSingle();
      if (assignData) {
        setAssignment(assignData);
        setP1(assignData.person_1);
        setP2(assignData.person_2);
        setImgUrl(assignData.image_url || "");
      } else {
        setAssignment({ person_1: "", person_2: "", image_url: "" });
        setP1(""); setP2(""); setImgUrl("");
      }

    } catch (error) {
      toast.error("Failed to sync data registry.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !quantity.trim()) return toast.error("Fill all required fields!");

    setActionLoading(true);
    try {
      const initialStatus = userRole !== "user" ? "approved_list" : "suggested";
      await supabase.from("bazaar_planner").insert({
        item_name: itemName, quantity, estimated_cost: estCost ? Number(estCost) : 0,
        status: initialStatus, suggested_by: profileName, date: selectedDate
      });

      toast.success("Item updated in the registry!");
      setItemName(""); setQuantity(""); setEstCost("");
      fetchBazaarData();
    } catch (error) {
      toast.error("Failed to record item.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p1.trim() || !p2.trim()) return toast.error("Both bazaar representatives are required!");

    setActionLoading(true);
    try {
      await supabase.from("bazaar_assignments").upsert({
        date: selectedDate, person_1: p1, person_2: p2, image_url: imgUrl
      }, { onConflict: 'date' });

      toast.success("Bazaar duty assigned successfully!");
      fetchBazaarData();
    } catch (error) {
      toast.error("Assignment compilation failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, currentStatus: string) => {
    if (userRole === "user") return;
    let nextStatus = currentStatus === "suggested" ? "approved_list" : currentStatus === "approved_list" ? "bought" : "suggested";
    await supabase.from("bazaar_planner").update({ status: nextStatus }).eq("id", itemId);
    setItems(items.map(item => item.id === itemId ? { ...item, status: nextStatus } : item));
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Remove item?")) return;
    await supabase.from("bazaar_planner").delete().eq("id", itemId);
    setItems(items.filter(item => item.id !== itemId));
  };

  // PROFESSIONAL BROWSER-BASED PDF/PRINT EXPORTER
  const handleDownloadList = () => {
    window.print();
  };

  if (!isMounted) return null;

  const suggestions = items.filter(i => i.status === "suggested");
  const officialList = items.filter(i => i.status === "approved_list" || i.status === "bought");
  const totalEstCost = officialList.reduce((acc, curr) => acc + Number(curr.estimated_cost || 0), 0);

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0 print:p-0 print:bg-white text-slate-900 dark:text-white">
      
      {/* Background Blobs (Hidden during print) */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none -z-10 print:hidden"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none -z-10 print:hidden"></div>

      {/* Date & Action Header Banner */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-emerald-500">Bazaar Operations Center</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Digital Grocery Ledger & Duty Roster</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button onClick={handleDownloadList} className="px-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
            <span>📥</span> Download / Print List
          </button>
          <input 
            type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} 
            className="px-5 py-3 text-sm font-black bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-slate-700 rounded-2xl outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
          />
        </div>
      </div>

      {/* PRINT-ONLY CLEAN BEAUTIFUL HEADER */}
      <div className="hidden print:block border-b-4 border-slate-900 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase">Mess Official Bazaar List</h1>
        <p className="text-sm font-bold text-slate-600 mt-1">Date: {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        {assignment.person_1 && (
          <p className="text-xs font-bold text-slate-700 mt-2">Assigned Buyers: {assignment.person_1} & {assignment.person_2}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: Controls (Hidden during print) */}
        <div className="lg:col-span-1 space-y-6 print:hidden">
          
          {/* Form 1: Add Items */}
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-3">
              {userRole !== "user" ? "Add Roster Grocery" : "Suggest Item"}
            </h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <input type="text" placeholder="Item Name (e.g. Rice, Beef)" required value={itemName} onChange={e => setItemName(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Qty (e.g. 5 Kg)" required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500" />
                <input type="number" placeholder="৳ Est Cost" value={estCost} onChange={e => setEstCost(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500" />
              </div>
              <button type="submit" disabled={actionLoading} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black uppercase text-xs rounded-2xl shadow-md transition-all active:scale-98">Add Item</button>
            </form>
          </div>

          {/* Form 2: Assign Buyers & Image Post (Only Admin/Super Admin) */}
          {userRole !== "user" && (
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-3">Assign Duty & Post Picture</h3>
              <form onSubmit={handleSaveAssignment} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="Buyer 1 Name" required value={p1} onChange={e => setP1(e.target.value)} className="w-full px-3 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500" />
                  <input type="text" placeholder="Buyer 2 Name" required value={p2} onChange={e => setP2(e.target.value)} className="w-full px-3 py-2.5 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500" />
                </div>
                <input type="text" placeholder="Handwritten List Image URL / লিংক" value={imgUrl} onChange={e => setImgUrl(e.target.value)} className="w-full px-4 py-3 text-xs font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500" />
                <button type="submit" disabled={actionLoading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs rounded-xl transition-all shadow-sm">Save Assignment</button>
              </form>
            </div>
          )}

          {/* Live Duty Card */}
          {assignment.person_1 && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden border border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Today's Assigned Buyers</p>
              <h4 className="text-lg font-black mt-3 text-emerald-400">🏃‍♂️ {assignment.person_1}</h4>
              <h4 className="text-lg font-black mt-1 text-emerald-400">🏃‍♂️ {assignment.person_2}</h4>
              <span className="absolute top-4 right-4 text-xl opacity-20">💼</span>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Official Lists & Image View */}
        <div className="lg:col-span-2 space-y-6 print:col-span-3">
          
          {/* Official Printable List */}
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-transparent">
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40 flex justify-between items-center print:hidden">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">🛒 Shopping Roster Ledger</h3>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Budget: ৳ {totalEstCost}</span>
            </div>

            <div className="p-2 divide-y divide-slate-100/60 dark:divide-slate-800/40 print:divide-slate-300">
              {loading ? (
                <div className="text-center py-10 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing data...</div>
              ) : officialList.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 font-semibold">No confirmed ledger items found.</div>
              ) : officialList.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/20 group print:py-2">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleUpdateStatus(item.id, item.status)}
                      className={`w-5 h-6 rounded-full flex items-center justify-center border-2 transition-all print:hidden ${
                        item.status === 'bought' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {item.status === 'bought' && "✓"}
                    </button>
                    <div>
                      <p className={`text-sm font-bold tracking-wide ${item.status === 'bought' ? 'line-through text-slate-400 print:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                        {item.item_name}
                      </p>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-sm text-slate-800 dark:text-slate-200">৳ {item.estimated_cost}</span>
                    {userRole !== "user" && (
                      <button onClick={() => handleDeleteItem(item.id)} className="print:hidden opacity-0 group-hover:opacity-100 text-rose-500 text-xs font-bold transition-opacity">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Print Only Total */}
            <div className="hidden print:block border-t-2 border-slate-900 p-4 text-right font-black text-lg">
              Total Target Budget: ৳ {totalEstCost}
            </div>
          </div>

          {/* Handwritten Card List Displayer */}
          {assignment.image_url && (
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl p-6 space-y-4 print:hidden">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span>📸</span> Handwritten Paper Check
              </h3>
              <div className="w-full max-h-96 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <img src={assignment.image_url} alt="Bazaar handwritten paper check" className="w-full h-full object-contain hover:scale-105 transition-transform duration-500" />
              </div>
            </div>
          )}

          {/* Border Suggestions (Hidden during print) */}
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden print:hidden">
            <div className="p-5 border-b border-slate-200/50 dark:border-slate-700/50 bg-amber-50/20 dark:bg-amber-500/5">
              <h3 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">💡 Resident Suggestion Requests</h3>
            </div>
            <div className="p-2 divide-y divide-slate-100/60 dark:divide-slate-800/40">
              {loading ? null : suggestions.length === 0 ? (
                <div className="text-center py-10 text-xs font-bold text-slate-400 uppercase tracking-widest">No active border suggestions.</div>
              ) : suggestions.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-amber-50/10 dark:hover:bg-amber-500/5 group">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.item_name}</p>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Qty: {item.quantity} • From: <span className="text-indigo-500 font-bold">{item.suggested_by}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {userRole !== "user" ? (
                      <button onClick={() => handleUpdateStatus(item.id, item.status)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase">Approve & List</button>
                    ) : (
                      <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md px-2 py-1 uppercase">Pending</span>
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