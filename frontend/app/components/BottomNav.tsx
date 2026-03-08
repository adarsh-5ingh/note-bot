'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ActiveTab = 'notes' | 'explore' | 'tasks' | 'expenses';

export default function BottomNav({ active }: { active: ActiveTab }) {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [pendingTasks, setPendingTasks] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`${API}/api/tasks`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : [])
      .then((tasks: { completed: boolean }[]) => setPendingTasks(tasks.filter(t => !t.completed).length))
      .catch(() => {});
  }, [API]);

  return (
    <nav className="bottom-nav">
      <button onClick={() => router.push('/dashboard')} className={active === 'notes' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Notes
      </button>

      <button onClick={() => router.push('/dashboard?tab=explore')} className={active === 'explore' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
        </svg>
        Explore
      </button>

      <button onClick={() => router.push('/tasks')} className={active === 'tasks' ? 'active' : ''}>
        <div style={{ position: 'relative', width: 20, height: 20 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          {pendingTasks > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -6,
              background: '#ef4444', color: '#fff',
              fontSize: 9, fontWeight: 700, borderRadius: 99,
              padding: '1px 4px', minWidth: 14, textAlign: 'center',
              lineHeight: '14px', pointerEvents: 'none',
            }}>
              {pendingTasks > 99 ? '99+' : pendingTasks}
            </span>
          )}
        </div>
        Tasks
      </button>

      <button onClick={() => router.push('/expenses')} className={active === 'expenses' ? 'active' : ''}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        Expenses
      </button>
    </nav>
  );
}
