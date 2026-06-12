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

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (currentUserRole !== "super_admin") return toast.error("Only Super Admins can change roles.");
    
    const toastId = toast.loading("Updating account role...");
    setActionLoading(true);
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
      if (error) throw error;
      
      toast.success("Role updated successfully!", { id: toastId });
      setMembers(members.map(m => m.id === userId ? { ...m, role: newRole } : m));
    } catch (error) {
      toast.error("Failed to update role.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRoom = async (userId: string, newRoom: string) => {
    if (currentUserRole === "user") return;
    try {
      const { error } = await supabase.from("profiles").update({ room_number: newRoom }).eq("id", userId);
      if (error) throw error;
      
      toast.success("Room updated successfully!");
      setMembers(members.map(m => m.id === userId ? { ...m, room_number: newRoom } : m));
    } catch (error) {
      toast.error("Failed to assign room.");
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
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      {/* Top Header Control Panel */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Mess Roster & Ranks</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Global Border Control Center</p>
        </div>
        
        <div className="relative flex items-center max-w-md w-full">
          <input 
            type="text" 
            placeholder="Search by name, room, email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-5 py-3.5 text-sm font-semibold bg-white/80 dark:bg-slate-900/80 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-800 dark:text-slate-200 transition-all shadow-inner"
          />
          <span className="absolute right-4 text-slate-400 pointer-events-none">🔍</span>
        </div>
      </div>

      {/* Analytics Counter Widgets */}
      <div className="grid grid-cols-3 gap-4 md:gap-6">
        <button onClick={() => setActiveTab("all")} className={`bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border text-center transition-all shadow-lg active:scale-95 ${activeTab === 'all' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/40 dark:border-slate-800'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Members</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalMembers}</h3>
        </button>
        <button onClick={() => setActiveTab("admin")} className={`bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border text-center transition-all shadow-lg active:scale-95 ${activeTab === 'admin' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-white/40 dark:border-slate-800'}`}>
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Management</p>
          <h3 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{totalManagers}</h3>
        </button>
        <button onClick={() => setActiveTab("active")} className={`bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-5 rounded-2xl border text-center transition-all shadow-lg active:scale-95 ${activeTab === 'active' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-white/40 dark:border-slate-800'}`}>
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Funded Diners</p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{totalActiveDiners}</h3>
        </button>
      </div>

      {/* Main Directory Registry View */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-slate-800/40">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Border Management Roster</h3>
        </div>
        
        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50">
                <th className="px-6 py-5">Resident</th>
                <th className="px-6 py-5">Room Assignment</th>
                <th className="px-6 py-5">Dining Wallet</th>
                <th className="px-6 py-5 text-right">Operational Status / Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-16 text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Directory Database...</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-16 text-sm text-slate-400 font-bold">No borders match the current filters.</td></tr>
              ) : filteredMembers.map((member) => {
                const isExpanded = expandedMember === member.id;
                const cleanDate = member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A";

                return (
                  // FIXED: Added React.Fragment with the unique key for the map loop
                  <React.Fragment key={member.id}>
                    <tr 
                      onClick={() => toggleExpandCard(member.id)}
                      className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Identity Card Profile */}
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-md group-hover:scale-105 transition-transform shrink-0 ${
                            member.role === 'super_admin' ? 'bg-gradient-to-br from-purple-500 to-pink-600' : 
                            member.role === 'admin' ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : 
                            'bg-gradient-to-br from-emerald-400 to-teal-500'
                          }`}>
                            {member.full_name?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
                              {member.full_name || "Anonymous Member"}
                              <span className="text-[10px] opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity">ℹ️</span>
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400/80 mt-0.5">{member.email || "No email"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Interactive Room Control */}
                      <td className="px-6 py-4.5" onClick={(e) => e.stopPropagation()}>
                        {currentUserRole === "super_admin" || currentUserRole === "admin" ? (
                          <input 
                            type="text" 
                            defaultValue={member.room_number || ""}
                            onBlur={(e) => {
                              if (e.target.value !== member.room_number) {
                                handleUpdateRoom(member.id, e.target.value);
                              }
                            }}
                            placeholder="Set Room"
                            className="w-24 px-3 py-2 text-xs font-bold bg-slate-100/80 dark:bg-slate-900/80 border border-transparent focus:border-indigo-500 rounded-xl outline-none text-slate-800 dark:text-slate-200 transition-all text-center"
                          />
                        ) : (
                          <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                            {member.room_number || "Unassigned"}
                          </span>
                        )}
                      </td>

                      {/* Wallet Balance Display */}
                      <td className="px-6 py-4.5">
                        <div className="font-black text-sm text-slate-800 dark:text-slate-200">৳ {(member.balance || 0).toLocaleString()}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Active Fund</div>
                      </td>

                      {/* Rank Selection Options */}
                      <td className="px-6 py-4.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {currentUserRole === "super_admin" && member.role !== "super_admin" ? (
                          <select 
                            value={member.role || 'user'}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            disabled={actionLoading}
                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl outline-none cursor-pointer border shadow-sm ${
                              member.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10' :
                              member.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10'
                            }`}
                          >
                            <option value="user">Border</option>
                            <option value="admin">Mill Manager</option>
                          </select>
                        ) : (
                          <span className={`inline-flex px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm border ${
                            member.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400' :
                            member.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400'
                          }`}>
                            {member.role === 'super_admin' ? 'Super Owner' : member.role === 'admin' ? 'Meal Manager' : 'Border Member'}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* EXPANDED PROFILE INFO ROW ACCORDION PANEL */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50 dark:bg-slate-900/30 transition-all duration-300">
                        <td colSpan={4} className="px-8 py-5 border-l-4 border-indigo-500">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registration Log</p>
                              <p className="text-slate-800 dark:text-slate-200 font-bold">Enrolled: {cleanDate}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dining Profile Status</p>
                              <p className="text-slate-800 dark:text-slate-200 font-bold">
                                {member.balance > 0 ? "🟢 Authorized to order active meals" : "🟡 Suspended / Insufficient Balance"}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Identification Token</p>
                              <p className="font-mono text-slate-400 text-[10px]">{member.id}</p>
                            </div>
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

    </div>
  );
}