"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";

export default function ProfileModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Profile States
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomCategory, setRoomCategory] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // UI State for triggering icon
  const [displayAvatar, setDisplayAvatar] = useState("");
  const [displayInitials, setDisplayInitials] = useState("U");

  // 🚀 Drag & Drop States
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

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
        setRoomCategory(data.room_category || "");
        setAvatarUrl(data.avatar_url || "");
        setDisplayAvatar(data.avatar_url || "");
        setDisplayInitials(data.full_name ? data.full_name.charAt(0).toUpperCase() : "U");
      }
    }
  };

  // ==========================================
  // 🚀 ENTERPRISE DRAG & DROP UPLOAD LOGIC
  // ==========================================
  const handleFileUpload = async (file: File) => {
    if (!file || !file.type.startsWith("image/")) {
      return toast.error("Please upload a valid image file (JPG, PNG, etc).");
    }

    setIsUploading(true);
    const toastId = toast.loading("Uploading your image securely...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication error.");

      // ১. ফাইলের জন্য একটি ইউনিক নাম তৈরি করা
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // ২. Supabase Storage-এ ছবি আপলোড করা
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // ৩. আপলোড হওয়া ছবির পাবলিক লিংক (URL) বের করা
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // ৪. স্টেটে লিংক সেট করা (যাতে প্রিভিউ দেখা যায়)
      setAvatarUrl(publicUrl);
      setDisplayAvatar(publicUrl);
      toast.success("Image uploaded successfully!", { id: toastId });

    } catch (error: any) {
      toast.error(error.message || "Storage error! Did you create the 'avatars' public bucket?", { id: toastId });
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  // ==========================================
  // 💾 SAVE PROFILE LOGIC
  // ==========================================
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Updating profile securely...");
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication error.");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone,
          room_number: roomNumber,
          room_category: roomCategory,
          avatar_url: avatarUrl, // Database gets the uploaded URL
        })
        .eq("id", user.id);

      if (error) throw error;

      if (newPassword.trim() !== "") {
        const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
        if (passError) throw passError;
      }

      toast.success("Profile updated successfully!", { id: toastId });
      setIsOpen(false);
      fetchProfileData(); 
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
        className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white shadow-md border-2 border-white dark:border-slate-800 cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 overflow-hidden"
        title="Account Settings"
      >
        {displayAvatar ? (
          <img 
            src={displayAvatar} 
            alt="Profile" 
            className="w-full h-full object-cover" 
            onError={(e) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${fullName || 'User'}&background=10b981&color=fff`;
            }}
          />
        ) : (
          displayInitials
        )}
      </button>

      {/* 📦 Enterprise Profile Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 h-screen w-screen transition-all animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-xl rounded-[2rem] shadow-2xl border border-slate-200/50 dark:border-slate-800/80 relative max-h-[90vh] flex flex-col transform transition-all animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-600 to-purple-700 z-0"></div>

            <button 
              onClick={() => setIsOpen(false)} 
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="z-10 flex-1 overflow-y-auto custom-scrollbar pt-12 pb-6 px-6 sm:px-8">
              
              <form onSubmit={handleUpdateProfile} className="space-y-6 mt-4">
                
                {/* 🚀 DRAG AND DROP ZONE */}
                <div 
                  className={`w-full relative mt-2 mb-6 rounded-3xl p-6 border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 scale-[1.02]' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  {/* Hidden File Input */}
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }} 
                  />

                  {/* Visual Avatar Preview */}
                  <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 p-1.5 shadow-xl border border-slate-100 dark:border-slate-700 mb-4 relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-full h-full rounded-xl bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center text-3xl font-black text-slate-400 relative">
                      {isUploading ? (
                        <span className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                      ) : avatarUrl ? (
                        <>
                          <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                        </>
                      ) : (
                        <span className="text-4xl text-slate-300 dark:text-slate-600">📷</span>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">
                    {isDragging ? "Drop image here!" : "Drag & Drop Picture"}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 mb-3">Or click to browse files</p>
                  
                  <div className="w-full max-w-xs flex items-center gap-2">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OR PASTE URL</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                  </div>

                  <input 
                    type="text" 
                    value={avatarUrl} 
                    onChange={(e) => setAvatarUrl(e.target.value)} 
                    placeholder="https://..."
                    className="mt-3 w-full max-w-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-center transition-all"
                  />
                </div>

                {/* 📝 Personal Information Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Personal Information
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Phone Number</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Room</label>
                      <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all" />
                    </div>
                  </div>
                </div>

                {/* 🔒 Security Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2 flex items-center gap-2 mt-4">
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Security
                  </h3>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Change Password (Optional)</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 dark:text-white transition-all placeholder:text-slate-400" />
                  </div>
                </div>

                {/* 🛠️ Action Buttons */}
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer active:scale-[0.98]">
                    Discard
                  </button>
                  <button type="submit" disabled={loading || isUploading} className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-70 disabled:hover:shadow-none cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2">
                    {loading ? "Saving..." : "Save Profile Details"}
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