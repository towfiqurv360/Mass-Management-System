import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-gray-900 dark:text-white transition-colors duration-300 flex flex-col">
      
      {/* Navbar */}
      <header className="h-20 px-6 md:px-12 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-xl leading-none">M</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            Mess Pro
          </h1>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/login" className="hidden md:block font-bold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm md:text-base">
            Get Started
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-32 flex flex-col items-center text-center">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold text-sm mb-8 animate-fade-in">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Mess Management System 2.0 is Here
          </div>

          <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight animate-fade-in" style={{ animationDelay: "100ms" }}>
            Simplify Your <br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Mess Life</span> Today.
          </h2>
          
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mb-10 leading-relaxed animate-fade-in" style={{ animationDelay: "200ms" }}>
            The ultimate management system for modern messes and hostels. Track daily meals, monitor expenses, manage deposits, and calculate live meal rates seamlessly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-fade-in" style={{ animationDelay: "300ms" }}>
            <Link href="/register" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 text-lg flex items-center justify-center gap-2">
              Create Free Account
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link href="/login" className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 text-gray-900 dark:text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-sm hover:shadow-md text-lg text-center">
              Login to Dashboard
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-20 border-t border-gray-100 dark:border-gray-800/50">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Everything You Need</h3>
            <p className="text-gray-500 dark:text-gray-400">Manage your entire mess from one unified dashboard.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-[#0F172A] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 dark:border-blue-500/20 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Meal Tracking</h4>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Daily meal on/off system with exact counts and guest meal management features.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-[#0F172A] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 dark:border-emerald-500/20 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Live Meal Rate</h4>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Automated calculations of expenses vs total meals giving you real-time accurate meal rates.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-[#0F172A] p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-purple-50 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-100 dark:border-purple-500/20 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Deposit System</h4>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Users can submit money receipts online and admins can approve them with one click.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0B1120] py-8">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 dark:text-gray-400 font-medium">© {new Date().getFullYear()} Mess Pro. All rights reserved.</p>
          <div className="flex gap-6 text-sm font-bold text-gray-400">
            <a href="#" className="hover:text-indigo-500 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-500 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}