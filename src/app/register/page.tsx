"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // 👁️ Password Visibility State
  const [showPassword, setShowPassword] = useState(false);

  // 📝 Complete Form States
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomCategory, setRoomCategory] = useState("Double");
  const [bloodGroup, setBloodGroup] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (!bloodGroup) return toast.error("Please select your blood group.");

    setLoading(true);
    const toastId = toast.loading("Setting up your mess account securely...");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            room_number: roomNumber,
            room_category: roomCategory,
            blood_group: bloodGroup,
            emergency_contact: emergencyContact
          }
        }
      });

      if (error) throw error;

      toast.success("Account created successfully! You can now log in.", { id: toastId });
      router.push("/login");

    } catch (error: any) {
      toast.error(error.message || "Failed to create account.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0B1120] relative overflow-hidden">
      
      {/* 🌟 Subtle Enterprise Background Elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none"></div>
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full filter blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-lg bg-white dark:bg-[#0F172A] p-7 sm:p-9 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header Section */}
        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">System Registration</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1.5">Enter your details to access the mess portal.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* ROW 1: Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Full Name</label>
              <input 
                type="text" required value={fullName} onChange={e => setFullName(e.target.value)} 
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                placeholder="e.g. Towfiqur Rahman" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Phone Number</label>
              <input 
                type="tel" required value={phone} onChange={e => setPhone(e.target.value)} 
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                placeholder="01XXXXXXXXX" 
              />
            </div>
          </div>

          {/* ROW 2: Room Number & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Room Number</label>
              <input 
                type="text" required value={roomNumber} onChange={e => setRoomNumber(e.target.value)} 
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                placeholder="e.g. 201" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Room Category</label>
              <select 
                value={roomCategory} onChange={e => setRoomCategory(e.target.value)} 
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              >
                <option value="Single">Single Seat</option>
                <option value="Double">Double Seat</option>
                <option value="Triple">Triple Seat</option>
                <option value="Quad">Quad (4) Seat</option>
              </select>
            </div>
          </div>

          {/* ROW 3: Blood Group & Emergency Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Blood Group</label>
              <select 
                required value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} 
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled>Select Group</option>
                <option value="A+">A+</option><option value="A-">A-</option>
                <option value="B+">B+</option><option value="B-">B-</option>
                <option value="O+">O+</option><option value="O-">O-</option>
                <option value="AB+">AB+</option><option value="AB-">AB-</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Emergency Contact</label>
              <input 
                type="text" required value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} 
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                placeholder="Name - 01XXXXXXXXX" 
              />
            </div>
          </div>

          {/* ROW 4: Security (Email & Password) */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
              <input 
                type="email" required value={email} onChange={e => setEmail(e.target.value)} 
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                placeholder="name@example.com" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Secure Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full h-10 px-3 pr-10 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                  placeholder="••••••••" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    // Eye Slash Icon (Hide)
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    // Eye Icon (Show)
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full h-11 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-lg transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 flex justify-center items-center gap-2 cursor-pointer"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : "Create Account"}
          </button>
        </form>

        <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mt-6">
          Already registered? <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-black transition-colors">Sign In here</Link>
        </p>

      </div>
    </div>
  );
}