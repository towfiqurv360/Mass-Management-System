"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase"; // Adjust path as needed

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();

    // 🎯 THE FIX: Unique channel name to prevent Strict Mode double-render crashes
    const uniqueChannelName = `notif_bell_${userId}_${Math.random().toString(36).substring(2, 11)}`;
    
    // 🎯 THE FIX: .on() must come BEFORE .subscribe()
    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, 
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userId]);

  const fetchNotifications = async () => {
    const { data } = await supabase.from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const displayedNotifications = activeTab === "all" 
    ? notifications 
    : notifications.filter(n => !n.is_read);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Premium Trigger Bell */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-11 h-11 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-indigo-500/50 dark:hover:border-indigo-400/50 transition-all duration-300 flex items-center justify-center relative group"
      >
        <span className="text-xl transition-transform duration-300 group-hover:rotate-12">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-4 w-96 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 rounded-[2rem] shadow-2xl overflow-hidden z-50 transform origin-top-right transition-all duration-300">
          
          <div className="p-5 border-b border-slate-100 dark:border-slate-900/60 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Notification Center</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">Live Realtime Updates</p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead} 
                className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-wider transition-colors bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl"
              >
                Mark All Read
              </button>
            )}
          </div>

          <div className="flex px-4 py-2 gap-2 bg-slate-50/30 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-900/40">
            <button 
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${activeTab === "all" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
            >
              All ({notifications.length})
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("unread")}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${activeTab === "unread" ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-rose-500"}`}
            >
              Unread ({unreadCount})
            </button>
          </div>
          
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-900/40">
            {displayedNotifications.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center space-y-2">
                <span className="text-3xl">✨</span>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">All caught up!</p>
              </div>
            ) : (
              displayedNotifications.map((n) => (
                <div 
                  key={n.id} 
                  onClick={() => !n.is_read && markAsRead(n.id)} 
                  className={`p-4 transition-all duration-200 cursor-pointer relative group/item flex gap-3 ${
                    n.is_read 
                      ? 'opacity-60 hover:bg-slate-50/50 dark:hover:bg-slate-900/30' 
                      : 'bg-indigo-50/30 dark:bg-indigo-500/[0.04] hover:bg-indigo-50/60 dark:hover:bg-indigo-500/[0.08]'
                  }`}
                >
                  <div className="mt-1.5 shrink-0">
                    {n.is_read ? (
                      <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate pr-4">
                      {n.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed break-words">
                      {n.message}
                    </p>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 mt-2.5 uppercase tracking-widest">
                      {new Date(n.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <button 
                    type="button"
                    onClick={(e) => deleteNotification(e, n.id)}
                    className="opacity-0 group-hover/item:opacity-100 absolute top-3 right-3 text-slate-400 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 p-1 rounded-lg transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-900"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}