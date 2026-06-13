"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast"; // 🎯 Enterprise Toast Notifications

export default function ProfileModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Profile States
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // UI State for triggering icon
  const [displayAvatar, setDisplayAvatar] = useState("");
  const [displayInitials, setDisplayInitials] = useState("U");

  // Fetch Data
  useEffect(() => {
    fetchProfileData();
  }, []);

  // 🎯 Enterprise Feature: Close on Escape Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const fetchProfileData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setRoomNumber(data.room_number || "");
        setAvatarUrl(data.avatar_url || "");
        setDisplayAvatar(data.avatar_url || "");
        setDisplayInitials(data.full_name ? data.full_name.charAt(0).toUpperCase() : "U");
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Updating profile securely...");
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication error. Please log in again.");

      // Update Database Table
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
          room_number: roomNumber,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update Password if entered
      if (newPassword.trim() !== "") {
        const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
        if (passError) throw passError;
      }

      toast.success("Profile updated successfully!", { id: toastId });
      setIsOpen(false);
      fetchProfileData(); 
      
      // Auto-reload after a short delay for smooth UX
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile.", { id: toastId });
    } finally {
      setLoading(false);
      setNewPassword(""); 
    }
  };

  return (
    <>
      {/* 🎯 Header Profile Icon (Trigger) */}
      <button 
        onClick={() => setIsOpen(true)}
        className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white shadow-md border-2 border-white dark:border-slate-800 cursor-pointer hover:scale-105 hover:shadow-lg transition-transform duration-200 overflow-hidden"
        title="Account Settings"
      >
        {displayAvatar ? (
          <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          displayInitials
        )}
      </button>

      {/* 📦 Enterprise Profile Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 h-screen w-screen transition-all animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }} // 🎯 Enterprise Feature: Click Outside to Close
        >
          
          {/* Modal Container */}
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-xl rounded-[2rem] shadow-2xl border border-slate-200/50 dark:border-slate-800/80 relative max-h-[90vh] flex flex-col transform transition-all animate-in zoom-in-95 duration-200 overflow-hidden">
            
            {/* 🎨 Abstract Header Background */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-600 to-purple-700 z-0"></div>

            {/* Close Button */}
            <button 
              onClick={() => setIsOpen(false)} 
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Modal Body (Scrollable) */}
            <div className="z-10 flex-1 overflow-y-auto custom-scrollbar pt-12 pb-6 px-6 sm:px-8">
              
              <form onSubmit={handleUpdateProfile} className="space-y-8 mt-4">
                
                {/* 🧑‍💻 Live Avatar Preview & Input */}
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 p-1.5 shadow-xl border border-slate-100 dark:border-slate-700 shrink-0 mx-auto sm:mx-0">
                    <div className="w-full h-full rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center text-3xl font-black text-slate-400">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                      ) : displayAvatar ? (
                        <img src={displayAvatar} alt="Current" className="w-full h-full object-cover" />
                      ) : (
                        displayInitials
                      )}
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight text-center sm:text-left mb-4 sm:mb-1">Account Settings</h2>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Profile Picture URL</label>
                    <input 
                      type="text" 
                      value={avatarUrl} 
                      onChange={(e) => setAvatarUrl(e.target.value)} 
                      placeholder="Paste image link here..."
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 📝 Personal Information Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Personal Information
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Full Name</label>
                    <input 
                      type="text" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                      placeholder="Md Towfiqur Rahman"
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Phone Number</label>
                      <input 
                        type="tel" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="01XXXXXXXXX"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Room Designation</label>
                      <input 
                        type="text" 
                        value={roomNumber} 
                        onChange={(e) => setRoomNumber(e.target.value)} 
                        placeholder="Ex: 302"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* 🔒 Security Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-2 mt-2">
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Security & Authentication
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Change Password (Optional)</label>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="Leave blank to keep current password"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 dark:text-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 🛠️ Action Buttons */}
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsOpen(false)} 
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer active:scale-[0.98]"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-70 disabled:hover:shadow-none cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Saving Changes...
                      </>
                    ) : (
                      "Save Profile Details"
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}