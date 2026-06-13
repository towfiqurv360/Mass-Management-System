import type { Config } from "tailwindcss";

const config: Config = {
  // 🎯 ডার্ক মোড ক্লাস স্ট্র্যাটেজি (যাতে html ট্যাগে 'dark' ক্লাস থাকলে ডার্ক মোড কাজ করে)
  darkMode: "class",
  
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  
  theme: {
    extend: {
      // 🎨 প্রফেশনাল ইউজার ইন্টারফেসের জন্য কাস্টম প্রিমিয়াম কালার স্কিম
      colors: {
        panel: {
          light: "#F8FAFC",
          dark: "#0B1120",
          cardLight: "#FFFFFF",
          cardDark: "#0F172A",
        },
      },
      
      // 🚀 ড্যাশবোর্ড এবং মডালে ব্যবহৃত প্রিমিয়াম অ্যানিমেশনসমূহ
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out forwards",
        "slide-in": "slideIn 0.3s duration-300 ease-in-out forwards",
        "zoom-in": "zoomIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      },
      
      // ⚙️ অ্যানিমেশনের জন্য নিখুঁত কি-ফ্রেম লজিক
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        zoomIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;