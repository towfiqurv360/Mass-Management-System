"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import ThemeToggle from "../components/ThemeToggle";
import NotificationBell from "../components/NotificationBell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState("user");
  const [userId, setUserId] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setUserRole(profile?.role || "user");
    };
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { name: "Overview", href: "/dashboard" },
    { name: "Meal Control", href: "/dashboard/meals" },
    { name: "Deposits & Receipts", href: "/dashboard/deposits" },
    { name: "Expenses", href: "/dashboard/expenses" },
    { name: "Notice Board", href: "/dashboard/notices" },
    { name: "Monthly Billing", href: "/dashboard/billing" },
    { name: "Bazaar Planner", href: "/dashboard/bazaar-planner" }
  ];

  if (userRole === "super_admin") {
    navItems.push({ name: "User Management", href: "/dashboard/users" });
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] flex">
      <aside className={`fixed md:sticky top-0 left-0 z-50 w-72 h-screen bg-white dark:bg-[#0F172A] border-r border-gray-200 dark:border-gray-800 transition-transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="h-20 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Mess Pro</h2>
        </div>
        <nav className="py-6 px-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.name} href={item.href} className={`block px-4 py-3 rounded-xl font-bold text-sm ${pathname === item.href ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"}`}>
              {item.name}
            </Link>
          ))}
          <button onClick={handleSignOut} className="w-full text-left px-4 py-3 mt-4 text-rose-600 font-bold text-sm">
            Sign Out
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-20 bg-white/80 dark:bg-[#0F172A]/80 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
          <h2 className="text-xl font-bold">Dashboard</h2>
          <div className="flex items-center gap-4">
            {userId && <NotificationBell userId={userId} />}
            <ThemeToggle />
          </div>
        </header>
        <main className="p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}