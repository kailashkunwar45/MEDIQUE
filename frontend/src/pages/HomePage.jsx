import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export default function Home() {
    return (<main className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden font-sans">
      {/* Background Wallpaper - The user requested it to look like a mobile phone wallpaper */}
      <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105" style={{ backgroundImage: 'url("/wallpaper.png")' }}/>
      
      {/* Premium Overlay - Deep Navy Gradient */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0F172A]/90 via-[#0F172A]/40 to-[#1E3A8A]/60 backdrop-blur-[1px]"/>

      {/* Floating UI Container */}
      <div className="relative z-10 max-w-2xl w-full bg-[#0F172A]/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-12 lg:p-16 shadow-[0_50px_100px_rgba(0,0,0,0.5)] space-y-10 text-center animate-in fade-in zoom-in duration-1000">
        
        {/* Branding Section */}
        <div className="flex flex-col items-center space-y-8">
          <div className="w-40 h-40 rounded-[32px] bg-white/5 p-6 border border-white/10 shadow-2xl vip-border group transition-all hover:scale-110">
            <img src="/logo.png" alt="MediQueue Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"/>
          </div>
          <div className="space-y-2">
            <h1 className="text-7xl font-black tracking-tighter text-white uppercase italic leading-none">
              Medi<span className="text-[#D4AF37]">Queue</span>
            </h1>
            <div className="flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-[#D4AF37]/50"/>
              <p className="text-[10px] font-black tracking-[0.4em] text-[#D4AF37] uppercase">Elite Medical Command</p>
              <div className="h-[1px] w-12 bg-[#D4AF37]/50"/>
            </div>
          </div>
        </div>
        
        {/* Value Prop */}
        <div className="space-y-6">
          <p className="text-xl text-slate-200 font-medium leading-relaxed max-w-md mx-auto">
            Experience the future of healthcare orchestration. Seamless queue management for the world's most prestigious medical facilities.
          </p>
        </div>

        {/* Action Center */}
        <div className="flex flex-col gap-4 pt-6">
          <Link to="/login" className="w-full">
            <Button size="lg" className="w-full h-20 rounded-[20px] text-xs font-black tracking-[0.2em] bg-white text-black hover:bg-slate-100 shadow-2xl transition-all scale-95 hover:scale-100 gold-glow uppercase">
              Enter Operational Dashboard
            </Button>
          </Link>
          <Link to="/register" className="w-full">
            <Button size="lg" variant="outline" className="w-full h-20 rounded-[20px] text-xs font-black tracking-[0.2em] border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all uppercase">
              Establish Facility Link
            </Button>
          </Link>
        </div>

        {/* Footnote */}
        <div className="pt-8 flex flex-col items-center gap-4">
          <p className="text-[9px] text-white/30 font-black tracking-[0.5em] uppercase">
            SECURED BY MEDIQUEUE INTELLIGENCE v2.4
          </p>
          <div className="flex gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse"/>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-700"/>
             <div className="w-1.5 h-1.5 rounded-full bg-slate-700"/>
          </div>
        </div>
      </div>
    </main>);
}
