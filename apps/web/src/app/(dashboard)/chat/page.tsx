"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Search, 
  Send, 
  User as UserIcon, 
  Calendar, 
  Clock,
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  Phone,
  Video
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
import { format } from "date-fns";
import { Navbar } from "@/components/Navbar";

type Session = {
  _id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "hospital_admin" | "super_admin";
  accessToken: string;
};

type Conversation = {
  appointmentId: string;
  partner: {
    _id: string;
    name: string;
    email: string;
    specialization?: string;
  };
  lastMessage?: {
    text: string;
    createdAt: string;
    senderId: string;
  };
  unreadCount: number;
  status: string;
  date: string;
};

type ChatMessage = {
  _id: string;
  appointmentId: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt: string;
};

function getSession(): Session | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("mediqueue_session") : null;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function GlobalChatPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<string | null>(null);

  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const s = getSession();
    setSession(s);
    if (s?.accessToken) {
      loadConversations();
      const socket = io();
      socketRef.current = socket;
      socket.emit("registerUser", { token: s.accessToken });
      
      socket.on("message", (msg: ChatMessage) => {
        setConversations(prev => prev.map(conv => {
          if (conv.appointmentId === msg.appointmentId) {
            return {
              ...conv,
              lastMessage: {
                text: msg.text,
                createdAt: msg.createdAt,
                senderId: msg.senderId
              },
              unreadCount: msg.appointmentId === activeConvRef.current ? 0 : conv.unreadCount + 1
            };
          }
          return conv;
        }));

        if (msg.appointmentId === activeConvRef.current) {
          setMessages(prev => {
            // Deduplicate: if we already have a message with same text from same sender recently, replace or skip
            const exists = prev.some(m => 
              m.text === msg.text && 
              m.senderId === msg.senderId &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 10000
            );
            if (exists) {
              // Replace the temp one with the real one from server (which has real ID)
              return prev.map(m => 
                (m.text === msg.text && m._id.startsWith('temp-')) ? msg : m
              );
            }
            return [...prev, msg];
          });
        }
      });

      return () => { socket.disconnect(); };
    }
  }, []);

  useEffect(() => {
    if (activeConversationId && session) {
      loadMessages(activeConversationId);
      markAsRead(activeConversationId);
      // Ensure we join the socket room for this specific chat
      socketRef.current?.emit("joinChat", { 
        appointmentId: activeConversationId, 
        token: session.accessToken 
      });
    } else {
      setMessages([]);
    }
  }, [activeConversationId, session]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await authFetch("/api/chat/conversations");
      setConversations(data);
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (appointmentId: string) => {
    try {
      const data = await authFetch(`/api/chat/${appointmentId}/messages`);
      // Race condition fix: only update state if this is still the active conversation
      if (appointmentId === activeConvRef.current) {
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  const deleteHistory = async () => {
    if (!activeConversationId || !confirm("Are you sure you want to PERMANENTLY delete all messages in this conversation?")) return;
    
    try {
      await authFetch("/api/chat/clear-history", {
        method: "POST",
        body: JSON.stringify({ appointmentId: activeConversationId })
      });
      setMessages([]);
      setConversations(prev => prev.map(c => 
        c.appointmentId === activeConversationId ? { ...c, lastMessage: undefined } : c
      ));
    } catch (e) {
      console.error("Failed to delete history", e);
    }
  };

  const markAsRead = async (appointmentId: string) => {
    try {
      await authFetch("/api/chat/mark-read", {
        method: "POST",
        body: JSON.stringify({ appointmentId })
      });
      setConversations(prev => prev.map(c => 
        c.appointmentId === appointmentId ? { ...c, unreadCount: 0 } : c
      ));
    } catch (e) {
      console.error("Failed to mark as read", e);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeConversationId || !session) return;
    const text = inputText;
    setInputText("");

    // Optimistic Update: Add message to UI immediately for instant feedback
    const optimisticMsg: ChatMessage = {
      _id: `temp-${Date.now()}`,
      appointmentId: activeConversationId,
      senderId: session._id,
      senderRole: session.role,
      text,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      socketRef.current?.emit("sendMessage", {
        appointmentId: activeConversationId,
        text,
        token: session.accessToken
      });
    } catch (e) {
      console.error("Failed to send message", e);
      // Optional: remove the optimistic message on error
    }
  };

  const activeConv = conversations.find(c => c.appointmentId === activeConversationId);
  const filteredConversations = conversations.filter(c => 
    c.partner.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900">
      <Navbar session={session} />

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR: CONVERSATION LIST */}
        <div className={`w-full lg:w-96 border-r border-slate-200 bg-white/50 backdrop-blur-sm flex flex-col ${activeConversationId ? "hidden lg:flex" : "flex"}`}>
          <div className="p-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#1E3A8A] transition-colors" />
              <Input 
                placeholder="Search active channels..." 
                className="pl-11 h-12 rounded-[16px] bg-white border-slate-200 focus:border-[#1E3A8A]/50 focus:ring-0 text-xs font-bold text-slate-700 placeholder:text-slate-400 shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-2 pb-6">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-20 px-6 space-y-4">
                <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto">
                   <MessageSquare className="text-slate-600 w-8 h-8" />
                </div>
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest">No Active Channels Found</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div 
                  key={conv.appointmentId}
                  onClick={() => setActiveConversationId(conv.appointmentId)}
                  className={`group relative p-4 rounded-[24px] cursor-pointer transition-all duration-300 ${
                    activeConversationId === conv.appointmentId 
                    ? "bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] shadow-2xl shadow-blue-500/20" 
                    : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center border transition-all duration-300 ${
                        activeConversationId === conv.appointmentId ? "bg-white/20 border-white/30" : "bg-slate-100 border-slate-200"
                      }`}>
                         <UserIcon className={`w-6 h-6 ${activeConversationId === conv.appointmentId ? "text-white" : "text-slate-400"}`} />
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 border-4 border-slate-900 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg animate-bounce">
                          {conv.unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className={`text-sm font-black truncate tracking-tight transition-colors ${
                          activeConversationId === conv.appointmentId ? "text-white" : "text-slate-900"
                        }`}>
                          {session?.role === 'doctor' ? conv.partner.name : `Dr. ${conv.partner.name}`}
                        </h3>
                        <span className={`text-[9px] font-black uppercase tracking-widest flex-shrink-0 ml-2 ${
                          activeConversationId === conv.appointmentId ? "text-white/80" : "text-slate-400"
                        }`}>
                          {conv.lastMessage ? format(new Date(conv.lastMessage.createdAt), "HH:mm") : format(new Date(conv.date), "MMM d")}
                        </span>
                      </div>
                      <p className={`text-[11px] font-bold truncate leading-relaxed ${
                        activeConversationId === conv.appointmentId ? "text-white/70" : "text-slate-500"
                      }`}>
                        {conv.lastMessage ? conv.lastMessage.text : "No messages yet. Initial contact secure."}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className={`flex-1 flex flex-col bg-slate-50/50 ${!activeConversationId ? "hidden lg:flex" : "flex"}`}>
          {activeConversationId && activeConv ? (
            <>
              {/* CHAT HEADER */}
              <div className="px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="lg:hidden text-slate-400" 
                    onClick={() => setActiveConversationId(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <UserIcon className="text-slate-400 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#0F172A] tracking-tight">
                       {session?.role === 'doctor' ? activeConv.partner.name : `Dr. ${activeConv.partner.name}`}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Link</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900 rounded-xl"><Phone className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900 rounded-xl"><Video className="w-4 h-4" /></Button>
                  <div className="relative group/menu">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900 rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 hidden group-hover/menu:block z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                       <button 
                         onClick={deleteHistory}
                         className="w-full px-4 py-2 text-left text-xs font-black text-rose-500 hover:bg-rose-50 transition-colors uppercase tracking-widest"
                       >
                         Delete History
                       </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* MESSAGES */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* APPOINTMENT INFO CARD */}
                <div className="max-w-md mx-auto p-6 rounded-[28px] bg-white border border-slate-200 flex flex-col items-center text-center space-y-4 mb-12 shadow-sm">
                   <div className="w-16 h-16 rounded-full bg-[#1E3A8A]/5 border border-[#1E3A8A]/10 flex items-center justify-center">
                      <Calendar className="text-[#1E3A8A] w-6 h-6" />
                   </div>
                   <div>
                      <h4 className="text-xs font-black text-[#0F172A] uppercase tracking-widest">Appointment Protocol</h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">
                        Scheduled for {format(new Date(activeConv.date), "MMMM d, yyyy")}
                      </p>
                   </div>
                   <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black uppercase tracking-tighter">Verified Connection</Badge>
                </div>

                {messages.map((msg, i) => {
                  const isMe = msg.senderId === session?._id;
                  return (
                    <div key={msg._id || i} className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[70%] group ${isMe ? "items-end" : "items-start"}`}>
                        <div className={`px-6 py-4 rounded-[24px] text-sm font-bold leading-relaxed shadow-md ${
                          isMe 
                          ? "bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] text-white rounded-br-none" 
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                        }`}>
                          {msg.text}
                        </div>
                        <div className={`flex items-center gap-2 mt-2 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                            {format(new Date(msg.createdAt), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* INPUT AREA */}
              <div className="p-8 bg-white/50 border-t border-slate-200 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto flex gap-4">
                  <div className="flex-1 relative">
                    <Input 
                      placeholder="Type your message..." 
                      className="h-14 rounded-[20px] bg-white border-slate-200 focus:border-[#1E3A8A] focus:ring-0 text-sm font-bold text-slate-900 px-6 shadow-sm"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                  </div>
                  <Button 
                    className="w-14 h-14 rounded-[20px] bg-[#1E3A8A] hover:bg-[#2563EB] text-white shadow-xl shadow-blue-500/20 transition-all active:scale-95"
                    onClick={sendMessage}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-center text-[9px] text-slate-600 font-black uppercase tracking-widest mt-4 opacity-50">
                   End-to-End Encrypted Session · MediQueue Security Core
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8">
              <div className="w-32 h-32 bg-white rounded-[40px] border border-slate-200 flex items-center justify-center shadow-2xl relative">
                 <MessageSquare className="text-slate-200 w-12 h-12" />
                 <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-500/5 rounded-full blur-2xl"></div>
              </div>
              <div className="space-y-3 max-w-xs">
                <h3 className="text-2xl font-black text-[#0F172A] tracking-tight uppercase">Medical Link</h3>
                <p className="text-slate-500 font-bold leading-relaxed text-xs">
                  Select a secure channel from the directory to begin encrypted medical consultation.
                </p>
              </div>
               <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                  <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                     <ShieldCheck className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                     <p className="text-[8px] font-black text-slate-400 uppercase">Secure Link</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                     <Clock className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                     <p className="text-[8px] font-black text-slate-400 uppercase">Real-time Sync</p>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(15, 23, 42, 0.1);
        }
      `}</style>
    </div>
  );
}

// Simple icons from Lucide but with specific styles
function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
