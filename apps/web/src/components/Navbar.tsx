"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, User, LogOut, LayoutDashboard } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";

type Session = {
  _id: string;
  name: string;
  role: string;
  accessToken: string;
};

interface NavbarProps {
  session: Session | null;
}

export function Navbar({ session }: NavbarProps) {
  const { totalUnread } = useUnreadCount(session?.accessToken);

  const logout = () => {
    localStorage.removeItem("mediqueue_session");
    window.location.href = "/login";
  };

  const getDashboardLink = () => {
    if (!session) return "/login";
    switch (session.role) {
      case "patient": return "/patient";
      case "doctor": return "/doctor";
      case "hospital_admin": return "/admin";
      case "super_admin": return "/superadmin";
      default: return "/";
    }
  };

  const roleLabel = session?.role?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || "User";

  return (
    <nav className="w-full bg-white/70 backdrop-blur-xl border-b border-slate-200 px-8 py-6 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-6">
        <div className="flex items-center gap-5">
          <Link href={getDashboardLink()}>
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xl border border-slate-100 p-2 cursor-pointer hover:scale-105 transition-transform">
              <img src="/logo.png" alt="MediQueue" className="w-full h-full object-contain" />
            </div>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-[#0F172A] uppercase">MediQueue</h1>
            {session && (
              <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase opacity-70 mt-0.5">
                {roleLabel}: <span className="text-[#1E3A8A] font-black">{session.name}</span>
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href={getDashboardLink()}>
            <Button variant="outline" className="rounded-[14px] px-6 py-6 font-bold border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A] transition-all shadow-sm">
              <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
            </Button>
          </Link>

          <Link href="/chat">
            <Button variant="outline" className="rounded-[14px] px-6 py-6 font-bold border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A] transition-all shadow-sm relative group">
              <MessageSquare className="w-4 h-4 mr-2" /> Secure Chat
              {totalUnread > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full border-4 border-[#F8FAFC] font-black group-hover:scale-110 transition-transform animate-bounce">
                  {totalUnread}
                </span>
              )}
            </Button>
          </Link>

          <Link href="/profile">
            <Button className="rounded-[14px] px-8 py-6 font-black bg-[#1E3A8A] text-white hover:bg-[#2563EB] shadow-xl transition-all scale-95 hover:scale-100 gold-glow-hover">
              <User className="w-4 h-4 mr-2" /> Profile
            </Button>
          </Link>

          <Button variant="ghost" className="rounded-[14px] px-6 py-6 font-bold text-rose-500 hover:bg-rose-50 transition-all ml-2" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
