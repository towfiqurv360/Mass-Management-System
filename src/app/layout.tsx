import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "./components/ThemeProvider";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

// 🚀 PWA Viewport: মোবাইলে অ্যাপ ওপেন করলে উপরের স্ট্যাটাস বারের কালার কেমন হবে সেটা কন্ট্রোল করে
export const viewport: Viewport = {
  themeColor: "#4f46e5", // Indigo color (আপনার লোগোর সাথে ম্যাচ করে)
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// 🎯 PWA Metadata: এটি ব্রাউজারকে সিগন্যাল দেবে "Install App" পপ-আপ দেখানোর জন্য
export const metadata: Metadata = {
  title: "Mess Pro - Enterprise Management",
  description: "Advanced digital mess management system",
  manifest: "/manifest.json", // 👈 এই লাইনটি সবচেয়ে জরুরি!
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mess Pro",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#F8FAFC] dark:bg-[#0B1120] text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem
          disableTransitionOnChange>
        
        {children}

        </ThemeProvider>
        
        {/* Premium Enterprise Toast Configuration */}
        <Toaster
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            duration: 4000,
            className: "dark:bg-[#1E293B] dark:text-white border dark:border-gray-700",
            style: {
              borderRadius: "16px",
              background: "#ffffff",
              color: "#1e293b",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              padding: "16px 24px",
              fontWeight: "700",
              fontSize: "14px",
              backdropFilter: "blur(10px)",
            },
            success: {
              iconTheme: {
                primary: "#10B981", // Emerald
                secondary: "#ffffff",
              },
              style: {
                borderLeft: "4px solid #10B981",
              }
            },
            error: {
              iconTheme: {
                primary: "#F43F5E", // Rose
                secondary: "#ffffff",
              },
              style: {
                borderLeft: "4px solid #F43F5E",
              }
            },
            loading: {
              style: {
                borderLeft: "4px solid #6366F1", // Indigo
              }
            }
          }}
        />
      </body>
    </html>
  );
}