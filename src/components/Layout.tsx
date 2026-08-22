import { useState, useEffect } from 'react';
import {
  Camera, User, ChevronRight, Zap, Shield, Wifi, ScanLine
} from 'lucide-react';

const navItems = [
  { id: 'surveillance', label: 'Live Surveillance', icon: Camera },
  { id: 'plates', label: 'License Plates', icon: ScanLine },
];

interface LayoutProps {
  page: string;
  setPage: (p: string) => void;
  children: React.ReactNode;
}

export default function Layout({ page, setPage, children }: LayoutProps) {
  const [time, setTime] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: '#07090c' }}>

      {/* SIDEBAR */}
      <aside
        className="flex flex-col flex-shrink-0 h-full glass-shell"
        style={{
          width: collapsed ? 56 : 220,
          background: 'rgba(9,12,17,0.98)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            className="flex-shrink-0 flex items-center justify-center rounded"
            style={{ width: 32, height: 32, background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)' }}
          >
            <Shield size={16} color="#00d4ff" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-rajdhani font-700 text-sm tracking-widest" style={{ color: '#00d4ff', lineHeight: 1 }}>IBVAP-X</div>
              <div className="font-mono text-xs" style={{ color: '#334155', fontSize: 9, letterSpacing: '0.1em' }}>BORDER INTEL</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
            style={{ color: '#334155', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            <ChevronRight size={14} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className="nav-item w-full text-left"
                style={isActive ? {
                  color: '#00d4ff',
                  background: 'rgba(0,212,255,0.08)',
                  border: '1px solid rgba(0,212,255,0.2)',
                } : {}}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                {!collapsed && <span className="flex-1">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom status */}
        {!collapsed && (
          <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="status-dot-online blink" style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block' }} />
              <span className="font-mono text-xs" style={{ color: '#22c55e', fontSize: 10, letterSpacing: '0.08em' }}>SYSTEM ONLINE</span>
            </div>
            <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 5, padding: '7px 10px' }}>
              <div className="font-rajdhani font-700 text-xs tracking-widest" style={{ color: '#64748b', fontSize: 9 }}>AI ENGINE</div>
              <div className="font-rajdhani font-700 text-xs" style={{ color: '#00d4ff', letterSpacing: '0.08em' }}>OPERATIONAL</div>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN AREA */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* TOP BAR */}
        <header className="flex-shrink-0 flex items-center gap-4 px-5 glass-shell" style={{
          height: 52,
          background: 'rgba(9,12,17,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Title */}
          <div className="hidden md:flex flex-col mr-2">
            <span className="font-rajdhani font-700 text-sm tracking-widest" style={{ color: '#00d4ff', lineHeight: 1 }}>IBVAP-X</span>
            <span className="font-mono" style={{ color: '#334155', fontSize: 8, letterSpacing: '0.12em' }}>BORDER INTELLIGENCE SYSTEM</span>
          </div>

          <div className="flex-1 font-mono" style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.08em' }}>SINGLE SOURCE · PHONE CAMERA</div>

          {/* Status pills */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-1.5" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 4, padding: '3px 8px' }}>
              <span className="status-dot-online" style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }} />
              <span className="font-mono" style={{ color: '#22c55e', fontSize: 10, letterSpacing: '0.1em' }}>OPERATIONAL</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 4, padding: '3px 8px' }}>
              <Wifi size={10} color="#00d4ff" />
              <span className="font-mono" style={{ color: '#00d4ff', fontSize: 10, letterSpacing: '0.08em' }}>CONNECTED</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 4, padding: '3px 8px' }}>
              <Zap size={10} color="#00d4ff" />
              <span className="font-mono" style={{ color: '#00d4ff', fontSize: 10, letterSpacing: '0.08em' }}>AI ACTIVE</span>
            </div>
          </div>

          {/* DateTime */}
          <div className="text-right hidden md:block">
            <div className="font-mono" style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>
              {time.toLocaleTimeString('en-IN', { hour12: false })}
            </div>
            <div className="font-mono" style={{ color: '#475569', fontSize: 9, letterSpacing: '0.08em' }}>
              {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
            </div>
          </div>

          {/* User */}
          <div className="flex items-center gap-2 cursor-pointer">
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} color="#00d4ff" />
            </div>
            <div className="hidden lg:block">
              <div className="font-rajdhani font-700 text-xs" style={{ color: '#94a3b8', letterSpacing: '0.05em' }}>OP. SHARMA</div>
              <div className="font-mono" style={{ color: '#334155', fontSize: 9, letterSpacing: '0.08em' }}>LEVEL 3 CLEARANCE</div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-auto" style={{ background: '#07090c' }}>
          {children}
        </main>
      </div>

    </div>
  );
}
