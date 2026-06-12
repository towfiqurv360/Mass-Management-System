"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Profile Info States
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");

  // Security States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setIsMounted(true);
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);
      setEmail(authUser.email || "");

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
      if (profile) {
        setFullName(profile.full_name || "");
        setRoomNumber(profile.room_number || "");
        setRole(profile.role || "user");
      }
    } catch (error) {
      toast.error("Failed to load profile settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Name cannot be empty!");
    
    setUpdateLoading(true);
    const toastId = toast.loading("Updating profile details...");
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName,
        room_number: roomNumber
      }).eq("id", user.id);

      if (error) throw error;
      toast.success("Profile customized successfully!", { id: toastId });
    } catch (error) {
      toast.error("Update failed.", { id: toastId });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters long.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match!");

    setUpdateLoading(true);
    const toastId = toast.loading("Securing new authentication keys...");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success("Security keys updated! Password changed.", { id: toastId });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Password update failed.", { id: toastId });
    } finally {
      setUpdateLoading(false);
    }
  };

  if (!isMounted) return null;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Loading Customizer...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[80vh] w-full max-w-4xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex items-center gap-4">
        <div className="w-16 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-2xl shadow-lg">
          {fullName?.charAt(0).toUpperCase() || "U"}
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Account Customization</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Role Rank: {role.replace('_', ' ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Form */}
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-2">Personal Settings</h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Email Address (Locked)</label>
              <input type="email" value={email} disabled className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-900/50 text-slate-400 text-sm font-bold rounded-xl border-none outline-none cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Room Number</label>
              <input type="text" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none focus:border-indigo-500" />
            </div>
            <button type="submit" disabled={updateLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98">
              Save Profile Changes
            </button>
          </form>
        </div>

        {/* Security / Password Form */}
        <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-2">Security Keys</h3>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">New Password</label>
              <input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Confirm New Password</label>
              <input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold rounded-xl border-2 border-slate-100 dark:border-slate-800 outline-none focus:border-purple-500" />
            </div>
            <button type="submit" disabled={updateLoading} className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98">
              Update Authentication Key
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}