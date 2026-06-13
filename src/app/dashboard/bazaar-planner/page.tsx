"use client";

import React, { useState, useEffect, useRef } from "react";
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
  
  // Role State: Only 'admin' is the boss here.
  const [actualRole, setActualRole] = useState("user"); 
  const [profileName, setProfileName] = useState("");

  const realTimeToday = getLocalToday();
  const [selectedDate, setSelectedDate] = useState(realTimeToday);

  // Core States
  const [items, setItems] = useState<any[]>([]);
  const [assignment, setAssignment] = useState({ person_1: "", person_2: "", image_url: "" });

  // Admin Form States
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [estCost, setEstCost] = useState("");

  // 🚀 NEW: User Private Message State
  const [userMessage, setUserMessage] = useState("");

  // Assignment & Drag-Drop Form States
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🧮 Smart Calculator States
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcItems, setCalcItems] = useState([
    { id: 1, name: "Rice (Miniket)", price: 65, qty: 0 },
    { id: 2, name: "Potato", price: 40, qty: 0 },
    { id: 3, name: "Onion", price: 60, qty: 0 },
    { id: 4, name: "Beef", price: 750, qty: 0 },
    { id: 5, name: "Chicken", price: 320, qty: 0 },
    { id: 6, name: "Fish (Rui/Telapia)", price: 350, qty: 0 },
    { id: 7, name: "Soyabean Oil", price: 170, qty: 0 },
    { id: 8, name: "Vegetables (Mix)", price: 50, qty: 0 }
  ]);

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
        setActualRole(profile?.role === "admin" ? "admin" : "user");
        setProfileName(profile?.full_name || "Border");
      }

      // Fetch Items
      const { data: itemsData } = await supabase.from("bazaar_planner").select("*").eq("date", selectedDate).order("created_at", { ascending: true });
      setItems(itemsData || []);

      // Fetch Assignments
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

  // ==========================================
  // 📝 ADMIN: ADD OFFICIAL GROCERY
  // ==========================================
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !quantity.trim()) return toast.error("Fill all required fields!");

    setActionLoading(true);
    try {
      await supabase.from("bazaar_planner").insert({
        item_name: itemName, quantity, estimated_cost: estCost ? Number(estCost) : 0,
        status: "approved_list", suggested_by: profileName, date: selectedDate
      });

      toast.success("Item added to Official Roster!");
      setItemName(""); setQuantity(""); setEstCost("");
      fetchBazaarData();
    } catch (error) {
      toast.error("Failed to record item.");
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // 🔒 USER: SEND CONFIDENTIAL MESSAGE
  // ==========================================
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMessage.trim()) return toast.error("Please write a message!");

    setActionLoading(true);
    const toastId = toast.loading("Sending confidential note to manager...");
    try {
      await supabase.from("bazaar_planner").insert({
        item_name: userMessage, 
        quantity: "Confidential Note", // Placeholder so DB doesn't complain
        estimated_cost: 0,
        status: "private_msg", // Special status for privacy
        suggested_by: profileName, 
        date: selectedDate
      });

      toast.success("Message sent securely!", { id: toastId });
      setUserMessage("");
      fetchBazaarData();
    } catch (error) {
      toast.error("Failed to send message.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, currentStatus: string) => {
    if (actualRole !== "admin") return;
    let nextStatus = currentStatus === "approved_list" ? "bought" : "approved_list";
    await supabase.from("bazaar_planner").update({ status: nextStatus }).eq("id", itemId);
    setItems(items.map(item => item.id === itemId ? { ...item, status: nextStatus } : item));
  };

  const handleDeleteItem = async (itemId: string) => {
    if (actualRole !== "admin") return;
    if (!window.confirm("Remove this item?")) return;
    await supabase.from("bazaar_planner").delete().eq("id", itemId);
    setItems(items.filter(item => item.id !== itemId));
    toast.success("Removed successfully.");
  };

  // ==========================================
  // 📸 DRAG & DROP ASSIGNMENT SAVER
  // ==========================================
  const handleImageUpload = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      return toast.error("Please upload a valid image (JPG/PNG).");
    }
    setIsUploadingImage(true);
    const toastId = toast.loading("Uploading list securely...");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `bazaar-${selectedDate}-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('bazaar_checks').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('bazaar_checks').getPublicUrl(filePath);
      setImgUrl(publicUrl);
      toast.success("Image uploaded successfully!", { id: toastId });
    } catch (error: any) {
      toast.error("Upload failed! Ensure 'bazaar_checks' bucket exists.", { id: toastId });
    } finally {
      setIsUploadingImage(false);
      setIsDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p1.trim() || !p2.trim()) return toast.error("Both buyers are required!");

    setActionLoading(true);
    const toastId = toast.loading("Assigning duties...");
    try {
      await supabase.from("bazaar_assignments").upsert({
        date: selectedDate, person_1: p1, person_2: p2, image_url: imgUrl
      }, { onConflict: 'date' });

      toast.success("Duty assigned successfully!", { id: toastId });
      fetchBazaarData();
    } catch (error) {
      toast.error("Assignment compilation failed.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadList = () => window.print();

  if (!isMounted) return null;

  // 🚀 DATA FILTERING LOGIC
  const officialList = items.filter(i => i.status === "approved_list" || i.status === "bought");
  const totalEstCost = officialList.reduce((acc, curr) => acc + Number(curr.estimated_cost || 0), 0);
  const totalCalcCost = calcItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
  
  // Private messages for Admin
  const adminInbox = items.filter(i => i.status === "private_msg");
  // Private messages sent by the logged-in User
  const mySentMessages = items.filter(i => i.status === "private_msg" && i.suggested_by === profileName);

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0 print:p-0 print:bg-white text-slate-900 dark:text-white">
      
      {/* Background Blobs */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 print:hidden transition-transform duration-700 hover:scale-110"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-teal-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 print:hidden transition-transform duration-700 hover:scale-110"></div>

      {/* 🎯 Date & Action Header Banner */}
      <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 print:hidden transition-all duration-300 hover:shadow-indigo-500/5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-teal-500 tracking-tight">Bazaar Operations Center</h2>
            {actualRole === "admin" && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 text-[9px] font-black uppercase rounded shadow-sm border border-indigo-200 dark:border-indigo-500/30 animate-pulse">Manager Access</span>}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] font-bold mt-1.5 uppercase tracking-widest">Digital Grocery Ledger & Duty Roster</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-end sm:items-center">
          {actualRole === "admin" && (
            <button onClick={() => setIsCalcOpen(true)} className="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-orange-500/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              Smart Calculator
            </button>
          )}
          <button onClick={handleDownloadList} className="px-5 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
            📥 Download / Print
          </button>
          <input 
            type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} 
            className="w-full sm:w-auto px-5 py-3.5 text-sm font-black bg-white dark:bg-slate-800 border-2 border-indigo-50 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 shadow-sm cursor-pointer appearance-none transition-all"
          />
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block border-b-4 border-slate-900 pb-4 mb-6">
        <h1 className="text-3xl font-black uppercase">Mess Official Bazaar List</h1>
        <p className="text-sm font-bold text-slate-600 mt-1">Date: {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        {assignment.person_1 && (
          <p className="text-xs font-bold text-slate-700 mt-2">Assigned Buyers: {assignment.person_1} & {assignment.person_2}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* =========================================
            LEFT PANEL: Controls & Forms
        ============================================= */}
        <div className="lg:col-span-1 space-y-6 sm:space-y-8 print:hidden">
          
          {/* 🚀 DYNAMIC FORM: Admin sees Grocery Adder, User sees Confidential Message Box */}
          {actualRole === "admin" ? (
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl relative overflow-hidden group">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6 border-b-2 border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
                <span className="p-1.5 bg-teal-50 dark:bg-teal-500/10 rounded-lg text-teal-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg></span>
                Add Official Grocery
              </h3>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Item Name</label>
                  <input type="text" placeholder="e.g. Rice, Beef" required value={itemName} onChange={e => setItemName(e.target.value)} className="w-full px-4 py-3.5 text-sm font-bold bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-teal-500 transition-all text-slate-800 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Quantity</label>
                    <input type="text" placeholder="e.g. 5 Kg" required value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-3.5 text-sm font-bold bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-teal-500 transition-all text-slate-800 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Est Cost ৳</label>
                    <input type="number" placeholder="৳ Auto" value={estCost} onChange={e => setEstCost(e.target.value)} className="w-full px-4 py-3.5 text-sm font-bold bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-teal-500 transition-all text-slate-800 dark:text-white" />
                  </div>
                </div>
                <button type="submit" disabled={actionLoading} className="cursor-pointer w-full py-4 mt-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black uppercase text-xs tracking-widest rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all">Add to Ledger</button>
              </form>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-slate-900 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-rose-200 dark:border-rose-900/50 shadow-2xl relative overflow-hidden group">
              <h3 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span>🔒</span> Confidential Note to Manager
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-5 leading-relaxed">
                Have any dietary restrictions, food allergies, or special requests? Drop a message here. <strong className="text-rose-500">Other members cannot see this.</strong>
              </p>
              <form onSubmit={handleSendMessage} className="space-y-4">
                <textarea 
                  placeholder="e.g. 'Manager, I don't eat beef. Please manage chicken/fish for me today.'" 
                  required value={userMessage} onChange={e => setUserMessage(e.target.value)} 
                  className="w-full px-4 py-3.5 text-sm font-semibold bg-white dark:bg-slate-900 border-2 border-rose-100 dark:border-rose-900/50 rounded-xl outline-none focus:border-rose-400 transition-all text-slate-800 dark:text-white min-h-[120px] resize-none"
                />
                <button type="submit" disabled={actionLoading} className="cursor-pointer w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-xs tracking-widest rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all">
                  Send Securely
                </button>
              </form>

              {/* Show Users their own sent notes for today */}
              {mySentMessages.length > 0 && (
                <div className="mt-6 pt-4 border-t border-rose-200 dark:border-rose-900/50">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Your Messages Today</p>
                  <div className="space-y-2">
                    {mySentMessages.map(msg => (
                      <div key={msg.id} className="bg-white/50 dark:bg-slate-900/50 p-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                        {msg.item_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form 2: 🚀 MANAGER EXCLUSIVE: Assign Buyers & Drag-Drop Image Post */}
          {actualRole === "admin" && (
            <div className="bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-900 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden group hover:shadow-indigo-500/10 transition-all">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
              
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-6 border-b border-slate-800 pb-3 flex items-center gap-2 relative z-10">
                <span className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-300"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></span>
                Assign Duty & Post Picture
              </h3>
              
              <form onSubmit={handleSaveAssignment} className="space-y-5 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Buyer 1</label>
                    <input type="text" placeholder="Name" required value={p1} onChange={e => setP1(e.target.value)} className="w-full px-4 py-3 text-xs font-bold bg-slate-800 border-2 border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all text-white" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Buyer 2</label>
                    <input type="text" placeholder="Name" required value={p2} onChange={e => setP2(e.target.value)} className="w-full px-4 py-3 text-xs font-bold bg-slate-800 border-2 border-slate-700 rounded-xl outline-none focus:border-indigo-500 focus:bg-slate-900 transition-all text-white" />
                  </div>
                </div>

                {/* 🚀 DRAG AND DROP ZONE */}
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Handwritten List Image</label>
                  <div 
                    className={`w-full relative rounded-2xl p-5 border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-500/20 scale-[1.02]' 
                        : 'border-slate-700 hover:bg-slate-800/80 bg-slate-800/40'
                    }`}
                    onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleImageUpload(e.target.files[0]); }} />
                    
                    <div className="w-16 h-16 rounded-xl bg-slate-900 p-1.5 shadow-xl border border-slate-700 mb-3 relative overflow-hidden flex items-center justify-center">
                      {isUploadingImage ? (
                        <span className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                      ) : imgUrl ? (
                        <img src={imgUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-2xl text-slate-600">📸</span>
                      )}
                    </div>
                    <h3 className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">{isDragging ? "Drop here!" : "Drag & Drop Image"}</h3>
                    <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">Or click to browse</p>
                  </div>
                </div>

                <button type="submit" disabled={actionLoading || isUploadingImage} className="cursor-pointer w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50">
                  Save Assignment
                </button>
              </form>
            </div>
          )}

          {/* Live Duty Card (Visible to everyone) */}
          {assignment.person_1 && (
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-600 p-6 md:p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden border border-emerald-400/50 group">
              <div className="absolute -right-4 -top-4 text-8xl opacity-10 group-hover:scale-110 transition-transform duration-700">🏃‍♂️</div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-3">Today's Assigned Buyers</p>
              <h4 className="text-xl md:text-2xl font-black tracking-tight">{assignment.person_1}</h4>
              <h4 className="text-xl md:text-2xl font-black tracking-tight mt-1 opacity-90">& {assignment.person_2}</h4>
            </div>
          )}
        </div>

        {/* =========================================
            RIGHT PANEL: Official Lists & Admin Inbox
        ============================================= */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8 print:col-span-3">
          
          {/* 🔒 ADMIN INBOX: Confidential Dietary Notes */}
          {actualRole === "admin" && (
            <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl rounded-[2rem] border border-rose-200 dark:border-rose-900/30 shadow-xl overflow-hidden print:hidden transition-all duration-300 hover:shadow-rose-500/5">
              <div className="p-5 md:p-6 border-b-2 border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-500/5 flex items-center gap-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400">🔒</div>
                <div>
                  <h3 className="text-sm font-black text-rose-800 dark:text-rose-300 uppercase tracking-widest">Resident Confidential Notes</h3>
                  <p className="text-[10px] text-rose-500/80 font-bold mt-1 uppercase">Dietary restrictions and private alerts</p>
                </div>
              </div>

              <div className="p-4 md:p-6 divide-y divide-rose-100/50 dark:divide-slate-800/50 custom-scrollbar max-h-[300px] overflow-y-auto">
                {loading ? null : adminInbox.length === 0 ? (
                  <div className="text-center py-8 opacity-50">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No confidential notes today.</span>
                  </div>
                ) : adminInbox.map((msg) => (
                  <div key={msg.id} className="flex flex-col sm:flex-row sm:items-start justify-between p-4 hover:bg-rose-50/40 dark:hover:bg-rose-500/5 rounded-2xl group transition-colors gap-4 sm:gap-0">
                    <div>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">From: {msg.suggested_by}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight leading-relaxed">{msg.item_name}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-3 sm:mt-0">
                      <button onClick={() => handleDeleteItem(msg.id)} className="cursor-pointer px-4 py-2 bg-white border border-slate-200 hover:border-emerald-500 text-slate-500 hover:text-emerald-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm">
                        Acknowledge & Clear
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official Printable Ledger List */}
          <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-3xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-transparent transition-all duration-300 hover:shadow-indigo-500/5">
            <div className="p-6 md:p-8 border-b-2 border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-800/20 flex justify-between items-center gap-4 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">🛒 Official Shopping Roster</h3>
                  {actualRole === "admin" && <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Click circle to mark as bought</p>}
                </div>
              </div>
              <div className="text-right">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Budget</span>
                 <span className="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tighter">৳ {totalEstCost}</span>
              </div>
            </div>

            <div className="p-4 md:p-6 divide-y divide-slate-100 dark:divide-slate-800/50 print:divide-slate-300 custom-scrollbar max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-20 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Database...</div>
              ) : officialList.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                  <div className="text-5xl mb-4">📭</div>
                  <p className="text-sm text-slate-500 font-bold">No confirmed items in the ledger.</p>
                </div>
              ) : officialList.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl group print:py-2">
                  <div className="flex items-center gap-4">
                    {/* Checkbox Trigger (Admin Only) */}
                    <button 
                      onClick={() => handleUpdateStatus(item.id, item.status)}
                      disabled={actualRole !== "admin"}
                      className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all print:hidden ${actualRole === "admin" ? 'cursor-pointer active:scale-90 hover:shadow-md' : 'cursor-default'} ${
                        item.status === 'bought' ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <svg className={`w-3.5 h-3.5 transition-opacity ${item.status === 'bought' ? 'opacity-100' : 'opacity-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </button>
                    <div>
                      <p className={`text-sm md:text-base font-black tracking-tight transition-colors ${item.status === 'bought' ? 'line-through text-slate-400 dark:text-slate-600 print:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                        {item.item_name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                         <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded shadow-sm">Qty: {item.quantity}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="font-black text-lg text-slate-800 dark:text-slate-200 tracking-tighter">৳ {item.estimated_cost}</span>
                    {actualRole === "admin" && (
                      <button onClick={() => handleDeleteItem(item.id)} className="cursor-pointer print:hidden opacity-0 group-hover:opacity-100 text-rose-500 hover:text-white hover:bg-rose-500 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-xl text-sm font-bold transition-all active:scale-90">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
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

          {/* Handwritten Card Image Displayer (Stunning View) */}
          {assignment.image_url && (
            <div className="bg-slate-900/5 dark:bg-black/20 backdrop-blur-md rounded-[2rem] border border-slate-200/50 dark:border-slate-800 p-6 space-y-4 print:hidden group">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="text-lg">📸</span> Handwritten Paper Check
              </h3>
              <div className="w-full relative rounded-2xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-900 aspect-video md:aspect-auto md:h-[400px]">
                <img src={assignment.image_url} alt="Bazaar handwritten paper check" className="w-full h-full object-contain hover:scale-[1.02] transition-transform duration-700 cursor-zoom-in" onClick={() => window.open(assignment.image_url, '_blank')} />
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Click to expand
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================= */}
      {/* 🧮 ENTERPRISE FEATURE: SMART CALCULATOR MODAL (ADMIN ONLY)  */}
      {/* ========================================================= */}
      {isCalcOpen && actualRole === "admin" && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 print:hidden"
          onClick={(e) => { if(e.target === e.currentTarget) setIsCalcOpen(false); }}
        >
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-3xl rounded-[2.5rem] shadow-2xl border-2 border-slate-200/50 dark:border-slate-700/80 overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 border-b-2 border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                  <span className="p-2.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl shadow-inner"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></span>
                  Smart Market Calculator
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Adjust live market prices and calculate total estimate.</p>
              </div>
              <button onClick={() => setIsCalcOpen(false)} className="cursor-pointer w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center text-xl font-bold transition-all shadow-sm active:scale-90">
                 ✕
              </button>
            </div>

            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30 dark:bg-transparent">
              <div className="grid grid-cols-12 gap-4 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 px-2">
                <div className="col-span-5">Item Definition</div>
                <div className="col-span-3 text-center">Market Price (৳)</div>
                <div className="col-span-4 text-center">Required Qty (Kg/Ltr)</div>
              </div>
              
              <div className="space-y-3">
                {calcItems.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 items-center bg-white dark:bg-slate-800/80 p-3 md:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md hover:border-indigo-500/30 group">
                    <div className="col-span-5 font-bold text-xs md:text-sm text-slate-800 dark:text-white tracking-tight">{item.name}</div>
                    
                    {/* Editable Price */}
                    <div className="col-span-3 relative flex items-center justify-center">
                      <span className="absolute left-2 md:left-4 text-slate-400 font-bold text-[10px]">৳</span>
                      <input 
                        type="number" value={item.price} 
                        onChange={(e) => {
                          const newItems = [...calcItems];
                          newItems[index].price = Number(e.target.value);
                          setCalcItems(newItems);
                        }} 
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-6 md:pl-8 pr-2 text-xs font-black text-center text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    
                    {/* Editable Qty */}
                    <div className="col-span-4 flex items-center justify-center gap-1 md:gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button onClick={() => { const newItems = [...calcItems]; newItems[index].qty = Math.max(0, item.qty - 0.5); setCalcItems(newItems); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 font-black cursor-pointer shadow-sm active:scale-90 transition-all">-</button>
                      <span className="w-8 text-center font-black text-sm text-indigo-600 dark:text-indigo-400">{item.qty}</span>
                      <button onClick={() => { const newItems = [...calcItems]; newItems[index].qty += 0.5; setCalcItems(newItems); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 font-black cursor-pointer shadow-sm active:scale-90 transition-all">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 dark:bg-black p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0 border-t-4 border-indigo-500">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Grand Estimate</p>
                <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter">৳ {totalCalcCost.toLocaleString()}</h3>
              </div>
              <button onClick={() => setIsCalcOpen(false)} className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg hover:bg-indigo-50 active:scale-95 transition-all cursor-pointer">
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}