"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

export default function MemberManagementPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("user");
  const [members, setMembers] = useState<any[]>([]);
  
  // Professional States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'admin' | 'active'
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Edit Modal States
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", room_number: "", room_category: "" });

  useEffect(() => {
    setIsMounted(true);
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        setCurrentUserRole(profile?.role || "user");
      }

      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      
      const mapped = (data || []).map(m => ({
        ...m,
        isActiveDiner: Number(m.balance || 0) > 0 
      }));
      setMembers(mapped);
    } catch (error) {
      toast.error("Failed to load resident directory.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 ENTERPRISE: Role Assignment & Manager Handover
  const handleUpdateRole = async (userId: string, newRole: string, currentRole: string) => {
    if (currentUserRole !== "super_admin") return toast.error("Security: Only Super Owners can reassign roles.");
    if (currentRole === "super_admin" && newRole !== "super_admin") {
      if (!window.confirm("⚠️ WARNING: You are downgrading a Super Owner. Are you sure?")) return;
    }
    
    const toastId = toast.loading("Updating operational rank...");
    setActionLoading(true);
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
      if (error) throw error;
      
      toast.success("Rank reassigned successfully!", { id: toastId });
      setMembers(members.map(m => m.id === userId ? { ...m, role: newRole } : m));
    } catch (error) {
      toast.error("Failed to update rank.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  // 🚀 ENTERPRISE: Remove / Evict Member
  const handleRemoveMember = async (userId: string, name: string) => {
    if (currentUserRole !== "super_admin") return toast.error("Security: Only Super Owners can evict members.");
    
    const isConfirmed = window.confirm(`🛑 CRITICAL ACTION: Are you absolutely sure you want to remove [${name}] from the mess?\n\nThis will permanently delete their profile from the active directory.`);
    if (!isConfirmed) return;

    const toastId = toast.loading(`Removing ${name} from system...`);
    setActionLoading(true);
    try {
      // Deletes the profile record. (Note: Auth user remains in Supabase Auth but lost access to app)
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;

      toast.success(`${name} has been removed from the mess.`, { id: toastId });
      setMembers(members.filter(m => m.id !== userId));
      setExpandedMember(null);
    } catch (error) {
      toast.error("Failed to remove member. They might have existing financial records.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  // 🚀 ENTERPRISE: Full Profile Edit
  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      room_number: user.room_number || "",
      room_category: user.room_category || ""
    });
  };

  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUserRole !== "super_admin") return toast.error("Unauthorized!");
    
    const toastId = toast.loading("Saving resident details...");
    setActionLoading(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: editForm.full_name,
        phone: editForm.phone,
        room_number: editForm.room_number,
        room_category: editForm.room_category
      }).eq("id", editingUser.id);

      if (error) throw error;

      toast.success("Profile updated successfully!", { id: toastId });
      setMembers(members.map(m => m.id === editingUser.id ? { ...m, ...editForm } : m));
      setEditingUser(null);
    } catch (error) {
      toast.error("Failed to update profile.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleExpandCard = (id: string) => {
    setExpandedMember(expandedMember === id ? null : id);
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = 
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.room_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!matchesSearch) return false;
    if (activeTab === "admin") return m.role === "admin" || m.role === "super_admin";
    if (activeTab === "active") return m.balance > 0;
    return true;
  });

  const totalMembers = members.length;
  const totalManagers = members.filter(m => m.role === 'admin' || m.role === 'super_admin').length;
  const totalActiveDiners = members.filter(m => m.balance > 0).length;

  if (!isMounted) return null;

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Decorative Background Glowing Blobs */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 transition-transform duration-700 hover:scale-110"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full filter blur-[100px] pointer-events-none -z-10 transition-transform duration-700 hover:scale-110"></div>

      {/* Top Header Control Panel */}
      <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-5 transition-all hover:shadow-indigo-500/5">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mess Roster & Ranks</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-[11px] font-bold mt-1.5 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> Global Border Control Center
          </p>
        </div>
        
        <div className="relative flex items-center max-w-md w-full">
          <input 
            type="text" 
            placeholder="Search by name, room, email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-5 py-3.5 text-sm font-semibold bg-white/80 dark:bg-slate-900/80 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-200 transition-all shadow-inner placeholder:text-slate-400"
          />
          <span className="absolute right-5 text-xl text-slate-400 pointer-events-none">🔍</span>
        </div>
      </div>

      {/* Analytics Counter Widgets */}
      <div className="grid grid-cols-3 gap-4 md:gap-6">
        <button onClick={() => setActiveTab("all")} className={`bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-[2rem] border text-center transition-all duration-300 shadow-lg hover:-translate-y-1 active:scale-95 ${activeTab === 'all' ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-white/40 dark:border-slate-800/80 hover:border-indigo-300'}`}>
          <p className="text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">All Members</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1.5">{totalMembers}</h3>
        </button>
        <button onClick={() => setActiveTab("admin")} className={`bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-[2rem] border text-center transition-all duration-300 shadow-lg hover:-translate-y-1 active:scale-95 ${activeTab === 'admin' ? 'border-purple-500 ring-4 ring-purple-500/10 bg-purple-50/50 dark:bg-purple-500/10' : 'border-white/40 dark:border-slate-800/80 hover:border-purple-300'}`}>
          <p className="text-[9px] md:text-[10px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-widest">Management</p>
          <h3 className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1.5">{totalManagers}</h3>
        </button>
        <button onClick={() => setActiveTab("active")} className={`bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl p-5 md:p-6 rounded-[2rem] border text-center transition-all duration-300 shadow-lg hover:-translate-y-1 active:scale-95 ${activeTab === 'active' ? 'border-emerald-500 ring-4 ring-emerald-500/10 bg-emerald-50/50 dark:bg-emerald-500/10' : 'border-white/40 dark:border-slate-800/80 hover:border-emerald-300'}`}>
          <p className="text-[9px] md:text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">Funded Diners</p>
          <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{totalActiveDiners}</h3>
        </button>
      </div>

      {/* Main Directory Registry View */}
      <div className="bg-white/60 dark:bg-[#0F172A]/70 backdrop-blur-3xl rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden hover:shadow-indigo-500/5 transition-shadow duration-300">
        <div className="p-6 md:p-8 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/20 flex items-center gap-3">
           <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
           </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Border Management Roster</h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Click any row for advanced admin controls</p>
          </div>
        </div>
        
        <div className="overflow-x-auto custom-scrollbar min-h-[400px]">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/50 dark:border-slate-700/50">
                <th className="px-6 py-5">Resident Profile</th>
                <th className="px-6 py-5">Room Assignment</th>
                <th className="px-6 py-5">Dining Wallet</th>
                <th className="px-6 py-5 text-right">Operational Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-20 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Directory Database...</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-20 text-sm text-slate-400 font-bold">No borders match the current filters.</td></tr>
              ) : filteredMembers.map((member) => {
                const isExpanded = expandedMember === member.id;
                const cleanDate = member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A";

                return (
                  <React.Fragment key={member.id}>
                    <tr 
                      onClick={() => toggleExpandCard(member.id)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all cursor-pointer group active:scale-[0.99] ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/20' : ''}`}
                    >
                      {/* Identity Card Profile */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md group-hover:scale-105 transition-transform shrink-0 border border-white/20 ${
                            member.role === 'super_admin' ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 
                            member.role === 'admin' ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : 
                            'bg-gradient-to-br from-emerald-400 to-teal-500'
                          }`}>
                            {member.full_name?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="font-black text-sm text-slate-900 dark:text-white tracking-tight flex items-center gap-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {member.full_name || "Anonymous Member"}
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                              {member.email || "No email linked"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Room Display */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                           {member.room_number || "Unassigned"}
                        </div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">{member.room_category || "No Category"}</div>
                      </td>

                      {/* Wallet Balance Display */}
                      <td className="px-6 py-4">
                        <div className="font-black text-sm text-slate-800 dark:text-slate-200">৳ {(member.balance || 0).toLocaleString()}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1">Active Fund</div>
                      </td>

                      {/* Rank / Status */}
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-inner border ${
                          member.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30' :
                          member.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                        }`}>
                          {member.role === 'super_admin' ? 'Super Owner' : member.role === 'admin' ? 'Meal Manager' : 'Border Member'}
                        </span>
                        <div className="mt-2 flex justify-end">
                           <span className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">Manage <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></span>
                        </div>
                      </td>
                    </tr>

                    {/* 🚀 EXPANDED ENTERPRISE ADMIN CONTROLS PANEL */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 dark:bg-slate-900/50 transition-all duration-300 border-b-2 border-indigo-500/20">
                        <td colSpan={4} className="px-6 md:px-10 py-6 md:py-8 border-l-4 border-indigo-500 shadow-inner">
                          
                          <div className="flex items-center gap-3 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3">
                             <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                             </div>
                             <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Advanced Administration Panel</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                            {/* Read-Only Info */}
                            <div className="space-y-4">
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Registration Log</p>
                                <p className="text-sm text-slate-800 dark:text-slate-200 font-bold">Enrolled: {cleanDate}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dining Profile Status</p>
                                <p className="text-xs font-bold flex items-center gap-2">
                                  {member.balance > 0 ? (
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded">🟢 Authorized (Active)</span>
                                  ) : (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 rounded">🟡 Insufficient Balance</span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Identification Token ID</p>
                                <p className="font-mono text-slate-500 dark:text-slate-400 text-[10px] bg-slate-200/50 dark:bg-slate-800 p-1.5 rounded inline-block">{member.id}</p>
                              </div>
                            </div>

                            {/* 🚀 Active Admin Controls */}
                            {currentUserRole === "super_admin" ? (
                              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                
                                {/* Reassign Role */}
                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1">Operational Rank</p>
                                    <p className="text-[9px] font-bold text-slate-400 mb-4">Promote to Manager or Owner</p>
                                  </div>
                                  <select 
                                    value={member.role || 'user'}
                                    onChange={(e) => handleUpdateRole(member.id, e.target.value, member.role)}
                                    disabled={actionLoading}
                                    className="w-full px-4 py-3 text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 cursor-pointer shadow-inner text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="user">Border Member (Standard)</option>
                                    <option value="admin">Meal Manager (Admin)</option>
                                    <option value="super_admin">Super Owner (Full Control)</option>
                                  </select>
                                </div>

                                {/* Danger Zone: Remove User */}
                                <div className="bg-rose-50/50 dark:bg-rose-500/5 p-5 rounded-2xl border border-rose-100 dark:border-rose-500/20 shadow-sm flex flex-col justify-between">
                                  <div>
                                    <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Danger Zone</p>
                                    <p className="text-[9px] font-bold text-rose-500/70 dark:text-rose-400/70 mb-4">Evict resident who left the mess.</p>
                                  </div>
                                  <button 
                                    onClick={() => handleRemoveMember(member.id, member.full_name)}
                                    disabled={actionLoading}
                                    className="cursor-pointer w-full py-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Remove Resident
                                  </button>
                                </div>

                                {/* Edit Profile Button */}
                                <div className="sm:col-span-2">
                                  <button 
                                    onClick={() => openEditModal(member)}
                                    className="cursor-pointer w-full py-3.5 bg-slate-900 dark:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Edit Full Profile Details
                                  </button>
                                </div>

                              </div>
                            ) : (
                              <div className="lg:col-span-2 flex items-center justify-center h-full p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl opacity-60">
                                <p className="text-xs font-bold text-slate-500 flex items-center gap-2">🔒 Advanced controls are locked for Super Owners only.</p>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* 🚀 ENTERPRISE MODAL: Edit Profile Details  */}
      {/* ========================================== */}
      {editingUser && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => { if(e.target === e.currentTarget) setEditingUser(null); }}
        >
          <div className="bg-white dark:bg-[#0F172A] w-full max-w-lg rounded-[2rem] shadow-2xl border border-slate-200/50 dark:border-slate-700/80 overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200">
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Edit Resident Profile</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-widest">Update personal & room details</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center text-lg font-bold transition-all cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfileEdit} className="p-6 md:p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Full Name</label>
                <input 
                  type="text" required value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Phone Number</label>
                <input 
                  type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Room Number</label>
                  <input 
                    type="text" value={editForm.room_number} onChange={e => setEditForm({...editForm, room_number: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Room Category</label>
                  <select 
                    value={editForm.room_category} onChange={e => setEditForm({...editForm, room_category: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer text-slate-800 dark:text-white"
                  >
                    <option value="">Unassigned</option>
                    <option value="Single">Single Room</option>
                    <option value="Double">Double Room</option>
                    <option value="Triple">Triple Room</option>
                    <option value="Quad">Quad Room</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-70 cursor-pointer">
                  {actionLoading ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}