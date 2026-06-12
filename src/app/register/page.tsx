"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
    const toastId = toast.loading("Securely creating your mess account...");

    try {
      // Sending ALL requirement data via metadata to the SQL Trigger
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

      toast.success("Registration Successful! Welcome aboard.", { id: toastId });
      router.push("/login");

    } catch (error: any) {
      toast.error(error.message || "Failed to create account.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0F172A] relative overflow-hidden py-12">
      
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/20 rounded-full filter blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-500/20 rounded-full filter blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-xl bg-white/5 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 text-2xl font-black text-white">
            M
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Border Registration</h1>
          <p className="text-slate-400 text-sm font-semibold mt-2">Complete your profile to join the mess registry.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          
          {/* ROW 1: Name & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-indigo-500 transition-all" placeholder="e.g. Md Towfiqur Rahman" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
              <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-indigo-500 transition-all" placeholder="01XXXXXXXXX" />
            </div>
          </div>

          {/* ROW 2: Room Number & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Room Number</label>
              <input type="text" required value={roomNumber} onChange={e => setRoomNumber(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-indigo-500 transition-all" placeholder="e.g. 201" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Room Category</label>
              <select value={roomCategory} onChange={e => setRoomCategory(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                <option value="Single">Single Seat</option>
                <option value="Double">Double Seat</option>
                <option value="Triple">Triple Seat</option>
                <option value="Quad">Quad (4) Seat</option>
              </select>
            </div>
          </div>

          {/* ROW 3: Blood Group & Emergency Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Blood Group</label>
              <select required value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                <option value="" disabled>Select Group</option>
                <option value="A+">A+</option><option value="A-">A-</option>
                <option value="B+">B+</option><option value="B-">B-</option>
                <option value="O+">O+</option><option value="O-">O-</option>
                <option value="AB+">AB+</option><option value="AB-">AB-</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Emergency Contact (Name & No)</label>
              <input type="text" required value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-indigo-500 transition-all" placeholder="Father - 01XXXXXXXXX" />
            </div>
          </div>

          {/* ROW 4: Security (Email & Password) */}
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-purple-500 transition-all" placeholder="name@example.com" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-5 py-3.5 bg-slate-900/50 text-white text-sm font-bold rounded-xl border border-white/10 outline-none focus:border-purple-500 transition-all" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2">
            {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : "Complete Registration"}
          </button>
        </form>

        <p className="text-center text-xs font-semibold text-slate-400 mt-6">
          Already a resident? <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-black">Sign In</Link>
        </p>

      </div>
    </div>
  );
}