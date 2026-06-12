"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

export default function NoticeBoardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userRole, setUserRole] = useState("user");

  // List States
  const [notices, setNotices] = useState<any[]>([]);

  // Form States
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noticeType, setNoticeType] = useState("general"); // general or urgent
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        setUserRole(profile?.role || "user");
      }

      const { data, error } = await supabase.from("system_notices").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      toast.error("Failed to load global notices.");
    } finally {
      setLoading(false);
    }
  };

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === "user") return toast.error("Unauthorized operation rank.");

    setActionLoading(true);
    const toastId = toast.loading("Publishing broadcast dispatch...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("system_notices").insert({
        title,
        content,
        notice_type: noticeType,
        created_by: user?.id
      });

      if (error) throw error;

      if (sendEmail) {
        toast.success("Broadcast queued for Email dispatch dispatch!", { icon: "✉️" });
        // Email trigger logic mechanism process goes here
      }

      toast.success("Broadcast notice published successfully!", { id: toastId });
      setTitle(""); setContent(""); setNoticeType("general"); setSendEmail(false);
      fetchNotices();
    } catch (error) {
      toast.error("Failed to broadcast announcement.", { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isMounted) return null;

  // Find the latest urgent notice to force display it on the layout
  const activeUrgentNotice = notices.find(n => n.notice_type === "urgent");

  return (
    <div className="relative min-h-[80vh] w-full max-w-7xl mx-auto space-y-6 animate-fade-in z-0 pb-10 px-4 md:px-0">
      
      {/* Background Glowing Blobs */}
      <div className="fixed top-20 left-10 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-rose-500/10 rounded-full filter blur-3xl pointer-events-none -z-10"></div>

      {/* FORCE BROADCAST NOTIFICATION BANNER (Urgent Notice Box) */}
      {activeUrgentNotice && (
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 rounded-3xl p-5 text-white shadow-xl flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-bold shrink-0">⚠️</div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest">Urgent Announcement: {activeUrgentNotice.title}</h4>
            <p className="text-xs font-semibold opacity-90 mt-1">{activeUrgentNotice.content}</p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-rose-500">Global Notice Board</h2>
        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-widest">Official Mess Broadcast Terminal</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creator Panel Form (Visible only to Admins/Super Admins) */}
        {userRole !== "user" && (
          <div className="lg:col-span-1">
            <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-2xl">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-2">Draft Dispatch</h3>
              <form onSubmit={handlePostNotice} className="space-y-4">
                <input type="text" placeholder="Notice Heading" required value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-3 text-sm font-bold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500" />
                <textarea placeholder="Write full details here..." required rows={4} value={content} onChange={e => setContent(e.target.value)} className="w-full px-4 py-3 text-sm font-semibold bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 resize-none" />
                
                <div className="flex gap-4">
                  <label className="flex-1 p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900">
                    <input type="radio" name="ntype" checked={noticeType === 'general'} onChange={() => setNoticeType('general')} />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">General</span>
                  </label>
                  <label className="flex-1 p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900">
                    <input type="radio" name="ntype" checked={noticeType === 'urgent'} onChange={() => setNoticeType('urgent')} />
                    <span className="text-xs font-black uppercase tracking-wider text-rose-500">Urgent ⚠️</span>
                  </label>
                </div>

                <label className="flex items-center gap-2.5 p-1 cursor-pointer">
                  <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="w-4 h-4 rounded text-indigo-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trigger Broadcast Email</span>
                </label>

                <button type="submit" disabled={actionLoading} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-md active:scale-98">
                  Transmit Notice
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Notices Timeline Logs */}
        <div className={userRole === "user" ? "lg:col-span-3" : "lg:col-span-2"}>
          <div className="space-y-4">
            {loading ? (
              <div className="p-10 text-center font-black text-slate-400 tracking-widest uppercase animate-pulse">Syncing timeline array...</div>
            ) : notices.length === 0 ? (
              <div className="bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-8 rounded-[2rem] text-center font-bold text-slate-400 border border-white/50">No notices broadcasted yet.</div>
            ) : notices.map((notice) => (
              <div key={notice.id} className={`bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-2xl p-6 rounded-[2rem] border transition-all hover:shadow-lg ${notice.notice_type === 'urgent' ? 'border-rose-200 dark:border-rose-900/40 bg-rose-50/10' : 'border-white/50 dark:border-slate-700/50'}`}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${notice.notice_type === 'urgent' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-transparent'}`}>
                      {notice.notice_type}
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white mt-2 tracking-wide">{notice.title}</h4>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {new Date(notice.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-3 leading-relaxed whitespace-pre-line">{notice.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}