"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Register() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("single");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          phone: phone,
          room_number: roomNumber,
          room_type: roomType,
          role: "user",
          balance: 0
        });

        if (profileError) throw profileError;
      }

      alert("Registration Successful! Please login to continue.");
      router.push("/login");
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] p-4 transition-colors">
      <div className="w-full max-w-5xl bg-white dark:bg-[#0F172A] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side / Branding (Matches Login Page) */}
        <div className="hidden md:flex md:w-5/12 bg-[#0F172A] relative overflow-hidden flex-col items-center justify-center p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/40 to-purple-900/40 z-0"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6">
              <span className="font-black text-4xl text-white">M</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-4">Join Mess Pro</h2>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
              Register your account, select your room, and get access to the ultimate digital mess management system.
            </p>
          </div>
        </div>

        {/* Right Side Form */}
        <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center">
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <span className="text-white font-black text-xl">M</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Mess Pro</h2>
          </div>

          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Account</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Fill in your details to get started.</p>
          
          {errorMsg && (
            <div className="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 p-4 rounded-xl text-sm font-bold mb-6 border border-rose-200 dark:border-rose-500/20 flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Full Name</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Phone Number</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Room Number</label>
                <input type="text" required placeholder="e.g. 204" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Room Type</label>
                <select required value={roomType} onChange={(e) => setRoomType(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer">
                  <option value="single">Single Room</option>
                  <option value="double">Double Room</option>
                  <option value="triple">Triple Room</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-black uppercase tracking-wider py-4 rounded-xl transition-all shadow-lg mt-4 disabled:opacity-50">
              {loading ? "Creating Account..." : "Sign Up Securely"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            Already registered? <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}