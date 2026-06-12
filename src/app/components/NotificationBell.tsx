"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();

    // Real-time listener for new notifications
    const channel = supabase.channel('realtime:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userId]);

  const fetchNotifications = async () => {
    const { data } = await supabase.from("notifications")
      .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    if (data) setNotifications(data);
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all flex items-center justify-center relative"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-[#0F172A]/95 backdrop-blur-3xl border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden z-50">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-600 uppercase">Mark all read</button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold text-slate-400">No new alerts.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 cursor-pointer transition-colors ${n.is_read ? 'opacity-60 hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-indigo-50/50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'}`}>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500"></span>}
                    {n.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                  <p className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}