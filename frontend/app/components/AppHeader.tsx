'use client';

import { Suspense, useRef, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../theme-provider';

function tabBtn(active: boolean) {
  return {
    padding: '5px 12px', borderRadius: 7, border: 'none',
    background: active ? 'var(--border)' : 'transparent',
    fontWeight: active ? 600 : 400,
    fontSize: 13, cursor: 'pointer', color: 'var(--text)',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  } as React.CSSProperties;
}

function AppHeaderInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, pendingTasks, logout } = useAppContext();
  const { theme, toggle: toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine active desktop tab
  const isExplore  = pathname === '/dashboard' && searchParams.get('tab') === 'explore';
  const isNotes    = pathname === '/dashboard' && !isExplore;
  const isTasks    = pathname === '/tasks';
  const isExpenses = pathname === '/expenses';

  if (!user) return null;

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="topbar-inner">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#111827"/>
            <rect x="8" y="9" width="16" height="2" rx="1" fill="white"/>
            <rect x="8" y="14" width="12" height="2" rx="1" fill="white"/>
            <rect x="8" y="19" width="9" height="2" rx="1" fill="white"/>
            <circle cx="24" cy="22" r="4" fill="#2563eb"/>
            <path d="M22.5 22l1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Note Bot</span>
        </div>

        {/* Desktop nav tabs */}
        <nav className="tabs-desktop" style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => router.push('/dashboard')} style={tabBtn(isNotes)}>My Notes</button>
          <button onClick={() => router.push('/dashboard?tab=explore')} style={tabBtn(isExplore)}>Explore</button>
          <button onClick={() => router.push('/tasks')} style={tabBtn(isTasks)}>
            Tasks
            {pendingTasks > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '0 5px', lineHeight: '16px', minWidth: 16, textAlign: 'center' }}>
                {pendingTasks}
              </span>
            )}
          </button>
          <button onClick={() => router.push('/expenses')} style={tabBtn(isExpenses)}>Expenses</button>
        </nav>

        {/* Right side */}
        <div className="topbar-right">
          <button onClick={toggleTheme} title="Toggle dark mode"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, padding: '2px 4px', lineHeight: 1 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <span className="hide-sm" style={{ fontSize: 13, color: 'var(--text-2)' }}>{user.name}</span>

          {/* Avatar + dropdown */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" referrerPolicy="no-referrer"
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>
                  {user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                minWidth: 160, overflow: 'hidden', zIndex: 100,
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{user.email}</p>
                </div>
                <button onClick={() => { setMenuOpen(false); logout(); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#dc2626' }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function AppHeader() {
  return <Suspense><AppHeaderInner /></Suspense>;
}
