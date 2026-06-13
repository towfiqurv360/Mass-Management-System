"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // 👁️ Password Visibility Toggle
  const [showPassword, setShowPassword] = useState(false);

  // 🌟 Live Profile Fetching States
  const [fetchedProfile, setFetchedProfile] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 🎯 Auto-fetch profile when email changes (Debounced)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // Check if it's a valid looking email before searching
      if (email.includes("@") && email.includes(".")) {
        setIsSearching(true);
        try {
          const { data } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, role")
            .eq("email", email.toLowerCase())
            .maybeSingle();
            
          if (data) setFetchedProfile(data);
          else setFetchedProfile(null);
        } catch (err) {
          setFetchedProfile(null);
        } finally {
          setIsSearching(false);
        }
      } else {
        setFetchedProfile(null);
      }
    }, 600); // Waits 600ms after user stops typing

    return () => clearTimeout(delayDebounceFn);
  }, [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      router.push("/dashboard");
    } catch (error: any) {
      setErrorMsg("Invalid Email or Password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] p-4 transition-colors relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full filter blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-5xl bg-white dark:bg-[#0F172A] rounded-[2.5rem] border border-gray-200/50 dark:border-gray-800/80 shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* ====================================================
            LEFT SIDE: Dynamic Branding & Profile Display
        ======================================================== */}
        <div className="hidden md:flex md:w-1/2 bg-[#0F172A] relative overflow-hidden flex-col items-center justify-center p-12 text-center transition-all duration-700">
          
          <div className={`absolute inset-0 bg-gradient-to-tr transition-colors duration-1000 z-0 ${fetchedProfile ? 'from-emerald-900/40 to-teal-900/40' : 'from-indigo-900/40 to-purple-900/40'}`}></div>
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          
          <div className="relative z-10 w-full flex flex-col items-center">
            
            {/* Dynamic Avatar Container */}
            <div className={`relative w-28 h-28 mx-auto rounded-[2rem] flex items-center justify-center shadow-2xl mb-8 border-4 transition-all duration-700 transform ${fetchedProfile ? 'bg-white dark:bg-slate-800 border-emerald-500/30 scale-110 shadow-emerald-500/20 rotate-0' : 'bg-gradient-to-tr from-indigo-500 to-purple-600 border-white/10 shadow-indigo-500/30 rotate-3'}`}>
              
              {isSearching ? (
                // Loading Spinner while searching
                <span className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : fetchedProfile ? (
                // Found Profile Picture or Initials
                fetchedProfile.avatar_url ? (
                  <img src={fetchedProfile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-[1.7rem]" />
                ) : (
                  <span className="font-black text-5xl bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-teal-600">
                    {fetchedProfile.full_name.charAt(0).toUpperCase()}
                  </span>
                )
              ) : (
                // Default Logo
                <span className="font-black text-5xl text-white">M</span>
              )}

              {/* Status Badge */}
              {fetchedProfile && (
                <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg border-2 border-[#0F172A] animate-in zoom-in duration-300">
                  {fetchedProfile.role === 'user' ? 'Resident' : 'Manager'}
                </div>
              )}
            </div>

            {/* Dynamic Welcome Text */}
            <div className="h-32 flex flex-col justify-start transition-all duration-500">
              <h2 className="text-3xl font-black text-white tracking-tight mb-3">
                {fetchedProfile ? `Welcome back, ${fetchedProfile.full_name.split(' ')[0]}!` : "Welcome Back to Mess Pro"}
              </h2>
              <p className={`text-sm leading-relaxed max-w-sm mx-auto font-medium transition-colors duration-500 ${fetchedProfile ? 'text-emerald-200/80' : 'text-gray-400'}`}>
                {fetchedProfile 
                  ? "We found your secure profile. Please enter your password to access your dashboard." 
                  : "Your comprehensive digital solution for enterprise-grade mess management and smart billing."}
              </p>
            </div>

          </div>
        </div>

        {/* ====================================================
            RIGHT SIDE: Form & Controls
        ======================================================== */}
        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-white dark:bg-[#0F172A]">
          <div className="md:hidden flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <span className="text-white font-black text-2xl">M</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Mess Pro</h2>
          </div>

          <div className="mb-8">
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Sign In</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Access your personalized operations dashboard.</p>
          </div>
          
          {errorMsg && (
            <div className="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 p-4 rounded-2xl text-sm font-bold mb-6 border border-rose-200 dark:border-rose-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Email Input */}
            <div className="relative group">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 transition-colors group-focus-within:text-indigo-500">Registered Email</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className={`w-full px-5 py-4 bg-gray-50 dark:bg-[#1E293B] border-2 rounded-xl text-gray-900 dark:text-white font-bold outline-none transition-all shadow-inner ${fetchedProfile ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10' : 'border-transparent focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'}`} 
                placeholder="name@example.com"
              />
              {fetchedProfile && (
                <span className="absolute right-4 top-[2.4rem] text-emerald-500 animate-in zoom-in">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                </span>
              )}
            </div>

            {/* Password Input with Toggle */}
            <div className="relative group">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest transition-colors group-focus-within:text-indigo-500">Secure Password</label>
                <Link href="#" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400">Forgot Password?</Link>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-5 py-4 pr-12 bg-gray-50 dark:bg-[#1E293B] border-2 border-transparent rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner tracking-wider" 
                  placeholder="••••••••"
                />
                
                {/* Show/Hide Toggle Button */}
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer p-1"
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className={`w-full py-4.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 shadow-lg flex justify-center items-center gap-2 mt-2 disabled:opacity-70 disabled:hover:scale-100 active:scale-[0.98] ${fetchedProfile ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25' : 'bg-gray-900 hover:bg-gray-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-indigo-500/25'}`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>Secure Login <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              New to the mess? 
            </p>
            <Link href="/register" className="px-5 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded-lg text-xs font-black uppercase tracking-widest transition-colors shadow-sm border border-gray-200 dark:border-gray-700">
              Apply for Registry
            </Link>
          </div>
          
        </div>
      </div>
    </div>
  );
}