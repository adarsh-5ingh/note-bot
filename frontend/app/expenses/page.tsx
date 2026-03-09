'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Expense {
  _id: string;
  amount: number;
  description: string;
  notes: string;
  type: 'expense' | 'income' | 'investment';
  category: string;
  date: string;
  createdAt: string;
}
interface UserCategory {
  _id?: string;
  key: string;
  emoji: string;
  label: string;
  color: string;
}

// ── Emoji picker list ─────────────────────────────────────────────────────────
const EMOJI_GROUPS = [
  { label: 'Food',     emojis: ['🍔','🍕','🍣','🍜','🍱','🥗','☕','🍺','🥤','🍰','🧁','🍷','🥩','🍗','🥐','🧆'] },
  { label: 'Travel',   emojis: ['🚕','🚗','✈️','🚌','🚂','🛵','🚲','⛽','🚁','🛳️','🏍️','🚙'] },
  { label: 'Shopping', emojis: ['🛒','🛍️','👗','👜','🎁','💍','👠','👒','🧴','💄'] },
  { label: 'Health',   emojis: ['💊','🏥','🧘','🏋️','🦷','🩺','💉','🩻','🧬','🏃'] },
  { label: 'Home',     emojis: ['🏠','💡','🔧','🛋️','🧹','🪴','🪣','🔑','🛁','🪟'] },
  { label: 'Tech',     emojis: ['💻','📱','🎮','🎧','📷','⌨️','🖥️','🖨️','📡','🔋'] },
  { label: 'Fun',      emojis: ['🎬','🎵','📚','🎯','🎲','🏆','🎭','🎪','🎨','🎤'] },
  { label: 'Finance',  emojis: ['💰','💳','📈','🏦','💵','🪙','💸','🤑','📊','🏧'] },
  { label: 'Other',    emojis: ['🎓','💈','📦','🌱','⭐','🎉','❤️','🌍','👋','✅'] },
];

// ── Default Categories ────────────────────────────────────────────────────────
const DEFAULT_CATS: UserCategory[] = [
  { key: 'food',          emoji: '🍔', label: 'Food',          color: '#f97316' },
  { key: 'dining',        emoji: '🍽️', label: 'Dining',        color: '#fb923c' },
  { key: 'transport',     emoji: '🚕', label: 'Transport',     color: '#3b82f6' },
  { key: 'shopping',      emoji: '🛒', label: 'Shopping',      color: '#8b5cf6' },
  { key: 'health',        emoji: '💊', label: 'Health',        color: '#22c55e' },
  { key: 'entertainment', emoji: '🎬', label: 'Entertainment', color: '#ec4899' },
  { key: 'bills',         emoji: '🏠', label: 'Bills',         color: '#ef4444' },
  { key: 'travel',        emoji: '✈️', label: 'Travel',        color: '#06b6d4' },
  { key: 'education',     emoji: '🎓', label: 'Education',     color: '#6366f1' },
  { key: 'tech',          emoji: '💻', label: 'Tech',          color: '#0ea5e9' },
  { key: 'fitness',       emoji: '🏋️', label: 'Fitness',       color: '#84cc16' },
  { key: 'personal',      emoji: '💈', label: 'Personal',      color: '#f472b6' },
  { key: 'gifts',         emoji: '🎁', label: 'Gifts',         color: '#a855f7' },
  { key: 'other',         emoji: '📦', label: 'Other',         color: '#9ca3af' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatINR(n: number) { return '₹' + n.toLocaleString('en-IN'); }
function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function prevMonthOf(y: number, m: number) {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}
function groupByDate(expenses: Expense[]) {
  const map: Record<string, Expense[]> = {};
  for (const e of expenses) {
    const key = e.date.slice(0, 10);
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
}
function dateLabel(key: string) {
  const d = new Date(key + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest  = new Date(today); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString())  return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }: { data: { value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2, R = size * 0.42, r = size * 0.26;
  let angle = -90;
  function toRad(deg: number) { return (deg * Math.PI) / 180; }
  function pt(deg: number, radius: number) {
    return { x: cx + radius * Math.cos(toRad(deg)), y: cy + radius * Math.sin(toRad(deg)) };
  }
  const segs = data.map(d => {
    const sweep = Math.min((d.value / total) * 359.99, 359.99);
    const start = angle; angle += sweep;
    return { ...d, start, end: angle };
  });
  function arc(s: number, e: number) {
    const p1 = pt(s, R), p2 = pt(e, R), p3 = pt(e, r), p4 = pt(s, r);
    const lg = e - s > 180 ? 1 : 0;
    return `M${p1.x} ${p1.y} A${R} ${R} 0 ${lg} 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${r} ${r} 0 ${lg} 0 ${p4.x} ${p4.y}Z`;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segs.map((s, i) => (
        <path key={i} d={arc(s.start, s.end)} fill={s.color} stroke="var(--bg)" strokeWidth="2" />
      ))}
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [prevTotal,      setPrevTotal]      = useState<number | null>(null);
  const [filterCat,      setFilterCat]      = useState('');
  const [filterType,     setFilterType]     = useState<'all'|'expense'|'income'|'investment'>('all');
  const [search,         setSearch]         = useState('');
  const [view,           setView]           = useState<'list' | 'analytics'>('list');
  const [loading,        setLoading]        = useState(true);
  const [addOpen,        setAddOpen]        = useState(false);
  const [editExpense,    setEditExpense]    = useState<Expense | null>(null);
  const [catMgrOpen,     setCatMgrOpen]     = useState(false);
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);

  // Form state
  const [fAmount,  setFAmount]  = useState('');
  const [fDesc,    setFDesc]    = useState('');
  const [fCat,     setFCat]     = useState('food');
  const [fDate,    setFDate]    = useState('');
  const [fType,    setFType]    = useState<'expense'|'income'|'investment'>('expense');
  const [fNotes,   setFNotes]   = useState('');
  const [saving,   setSaving]   = useState(false);

  // Category manager state
  const [newCatEmoji,     setNewCatEmoji]     = useState('');
  const [newCatLabel,     setNewCatLabel]     = useState('');
  const [newCatColor,     setNewCatColor]     = useState('#6366f1');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  function authHeader() {
    const token = localStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  // Merged categories: user custom overrides/extends defaults
  const allCats: UserCategory[] = userCategories.length > 0
    ? userCategories
    : DEFAULT_CATS;

  function getCat(key: string): UserCategory {
    return allCats.find(c => c.key === key) ?? { key, emoji: '📦', label: key, color: '#9ca3af' };
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const m = `${year}-${String(month).padStart(2, '0')}`;
    const prev = prevMonthOf(year, month);
    const pm = `${prev.y}-${String(prev.m).padStart(2, '0')}`;

    const [res, prevRes] = await Promise.all([
      fetch(`${API}/api/expenses?month=${m}`,  { headers: authHeader() }),
      fetch(`${API}/api/expenses?month=${pm}`, { headers: authHeader() }),
    ]);
    if (res.ok)     setExpenses(await res.json());
    if (prevRes.ok) {
      const prevData: Expense[] = await prevRes.json();
      setPrevTotal(prevData.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0));
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, year, month]);

  const fetchSettings = useCallback(async () => {
    const res = await fetch(`${API}/api/settings`, { headers: authHeader() });
    if (res.ok) {
      const s = await res.json();
      if (s.categories?.length) setUserCategories(s.categories);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { router.replace('/'); return; }
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSettings, router]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // Listen for FAB click dispatched by AppShell (use ref to always get fresh openAdd)
  const openAddRef = useRef(openAdd);
  openAddRef.current = openAdd;
  useEffect(() => {
    const handler = () => openAddRef.current();
    document.addEventListener('app:fab', handler);
    return () => document.removeEventListener('app:fab', handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { closeSheet(); setCatMgrOpen(false); setEmojiPickerOpen(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setEmojiPickerOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ── Month nav ──────────────────────────────────────────────────────────────
  function prevMonth() {
    setFilterCat(''); setSearch('');
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    setFilterCat(''); setSearch('');
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
  }

  // ── Sheet open/close ───────────────────────────────────────────────────────
  function openAdd() {
    setFAmount(''); setFDesc(''); setFCat(allCats[0]?.key || 'food');
    setFDate(new Date().toISOString().slice(0, 10)); setFType('expense'); setFNotes('');
    setEditExpense(null); setAddOpen(true);
  }
  function openEdit(e: Expense) {
    setFAmount(String(e.amount)); setFDesc(e.description);
    setFCat(e.category); setFDate(e.date.slice(0, 10));
    setFType(e.type || 'expense'); setFNotes(e.notes || '');
    setEditExpense(e); setAddOpen(true);
  }
  function openDuplicate(e: Expense) {
    setFAmount(String(e.amount)); setFDesc(e.description);
    setFCat(e.category); setFDate(new Date().toISOString().slice(0, 10));
    setFType(e.type || 'expense'); setFNotes(e.notes || '');
    setEditExpense(null); setAddOpen(true);
  }
  function closeSheet() { setAddOpen(false); setEditExpense(null); }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function saveExpense() {
    const amt = parseFloat(fAmount);
    if (!fDesc.trim() || isNaN(amt) || amt <= 0) return;
    setSaving(true);
    const body = { amount: amt, description: fDesc.trim(), category: fCat, date: fDate, type: fType, notes: fNotes };
    if (editExpense) {
      const res = await fetch(`${API}/api/expenses/${editExpense._id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(body) });
      if (res.ok) { const u = await res.json(); setExpenses(p => p.map(e => e._id === u._id ? u : e)); }
    } else {
      const res = await fetch(`${API}/api/expenses`, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
      if (res.ok) { const c = await res.json(); setExpenses(p => [c, ...p]); }
    }
    setSaving(false); closeSheet();
  }

  async function deleteExpense(id: string) {
    await fetch(`${API}/api/expenses/${id}`, { method: 'DELETE', headers: authHeader() });
    setExpenses(p => p.filter(e => e._id !== id));
    closeSheet();
  }

  // ── Settings save ──────────────────────────────────────────────────────────
  async function saveCategories(cats: UserCategory[]) {
    setUserCategories(cats);
    await fetch(`${API}/api/settings`, { method: 'PUT', headers: authHeader(), body: JSON.stringify({ categories: cats }) });
  }

  async function addCustomCategory() {
    if (!newCatLabel.trim()) return;
    const key = newCatLabel.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const base = userCategories.length > 0 ? userCategories : DEFAULT_CATS;
    const newCat: UserCategory = { key, emoji: newCatEmoji || '📦', label: newCatLabel.trim(), color: newCatColor };
    await saveCategories([...base, newCat]);
    setNewCatEmoji(''); setNewCatLabel(''); setNewCatColor('#6366f1');
  }

  async function deleteCustomCategory(key: string) {
    const base = userCategories.length > 0 ? userCategories : DEFAULT_CATS;
    await saveCategories(base.filter(c => c.key !== key));
  }

  async function resetCategories() {
    await saveCategories(DEFAULT_CATS);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalIncome     = expenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpenses   = expenses.filter(e => e.type !== 'income' && e.type !== 'investment').reduce((s, e) => s + e.amount, 0);
  const totalInvestment = expenses.filter(e => e.type === 'investment').reduce((s, e) => s + e.amount, 0);
  const netSavings      = totalIncome - totalExpenses - totalInvestment;
  const hasIncome       = totalIncome > 0 || totalInvestment > 0;

  const momPct = prevTotal && prevTotal > 0 && totalExpenses > 0
    ? Math.round(((totalExpenses - prevTotal) / prevTotal) * 100) : null;

  const filtered = expenses
    .filter(e => filterType === 'all' || e.type === filterType)
    .filter(e => !filterCat || e.category === filterCat)
    .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase()));

  const activeCats    = Array.from(new Set(expenses.filter(e => e.type === 'expense').map(e => e.category)));
  const grouped       = groupByDate(filtered);
  const catTotals     = allCats
    .map(cat => ({ ...cat, total: expenses.filter(e => e.type === 'expense' && e.category === cat.key).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const avgPerDay = (() => {
    if (!expenses.length) return 0;
    const days = new Set(expenses.filter(e => e.type === 'expense').map(e => e.date.slice(0, 10))).size;
    return days ? Math.round(totalExpenses / days) : 0;
  })();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>

      {/* ── Background gradient blobs ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,.11) 0%, transparent 68%)' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '-12%', width: 460, height: 460, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,.09) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', top: '45%', right: '20%', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,.07) 0%, transparent 70%)' }} />
      </div>

      {/* ── Content ── */}
      <main style={{ maxWidth: 580, margin: '0 auto', padding: '16px 16px', paddingBottom: 100, position: 'relative', zIndex: 1 }}>

        {/* ── Summary card ── */}
        <div className="glass-card" style={{ padding: '14px 16px 16px', marginBottom: 12 }}>
          {/* Month navigation row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth} style={arrowBtn}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
              {monthLabel(year, month)}
            </span>
            <button onClick={nextMonth} style={arrowBtn}>›</button>
          </div>

          {/* Total + MoM chip */}
          <div style={{ textAlign: 'center', marginBottom: hasIncome ? 10 : 0 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginBottom: 4 }}>Total Expenses</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1 }}>
                {loading ? '—' : formatINR(totalExpenses)}
              </span>
              {momPct !== null && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 99,
                  background: momPct > 0 ? '#fef2f2' : '#f0fdf4',
                  color: momPct > 0 ? '#ef4444' : '#16a34a' }}>
                  {momPct > 0 ? '↑' : '↓'}{Math.abs(momPct)}%
                </span>
              )}
            </div>
          </div>

          {/* Income / investment / savings row */}
          {hasIncome && (
            <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              {totalIncome > 0 && (
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500, marginBottom: 2 }}>Income</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>+{formatINR(totalIncome)}</p>
                </div>
              )}
              {totalInvestment > 0 && (
                <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500, marginBottom: 2 }}>Invested</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>{formatINR(totalInvestment)}</p>
                </div>
              )}
              <div style={{ textAlign: 'center', flex: 1, borderLeft: '1px solid var(--border)' }}>
                <p style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500, marginBottom: 2 }}>Saved</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: netSavings >= 0 ? '#16a34a' : '#ef4444' }}>
                  {netSavings >= 0 ? '+' : ''}{formatINR(netSavings)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Inner tabs: Expenses | Analytics ── */}
        <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 8, padding: 2, marginBottom: 12, gap: 1 }}>
          {(['list', 'analytics'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
              background: view === v ? 'var(--surface)' : 'transparent',
              color: view === v ? 'var(--text)' : 'var(--text-3)',
              cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
              transition: 'all .15s',
            }}>
              {v === 'list' ? 'Expenses' : 'Analytics'}
            </button>
          ))}
        </div>

        {/* ════════ EXPENSES TAB ════════ */}
        {view === 'list' && (
          <>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search expenses..." className="input"
                style={{ paddingLeft: 30, fontSize: 13, padding: '7px 10px 7px 30px' }} />
            </div>

            {/* Type filter + Categories button */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 10, alignItems: 'center' }}>
              {(['all', 'expense', 'income', 'investment'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)} style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  border: `1px solid ${filterType === t ? typeColor(t) : 'var(--border)'}`,
                  background: filterType === t ? typeColor(t) + '18' : 'transparent',
                  color: filterType === t ? typeColor(t) : 'var(--text-3)',
                }}>
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
              <button onClick={() => setCatMgrOpen(true)}
                style={{ marginLeft: 'auto', flexShrink: 0, background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '3px 10px', cursor: 'pointer', color: 'var(--text-2)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                🏷 Categories
              </button>
            </div>

            {/* Category filter pills */}
            {activeCats.length > 1 && filterType !== 'income' && filterType !== 'investment' && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
                {['', ...activeCats].map(key => {
                  const cat = key ? getCat(key) : null;
                  const active = filterCat === key;
                  return (
                    <button key={key || '__all__'} onClick={() => setFilterCat(key)} style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, flexShrink: 0,
                      border: `1px solid ${active ? (cat?.color || 'var(--accent)') : 'var(--border)'}`,
                      background: active ? (cat?.color ? cat.color + '12' : '#eff6ff') : 'transparent',
                      color: active ? (cat?.color || 'var(--accent)') : 'var(--text-3)',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                      {key ? `${cat?.emoji} ${cat?.label}` : 'All'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* List */}
            {loading ? (
              <div style={centered}>Loading...</div>
            ) : filtered.length === 0 ? (
              <EmptyState onAdd={openAdd} hasFilter={!!filterCat || !!search} />
            ) : (
              grouped.map(([dateKey, items]) => (
                <div key={dateKey} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, padding: '0 2px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                      {dateLabel(dateKey)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {formatINR(items.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0))}
                    </span>
                  </div>
                  <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    {items.map((expense, idx) => {
                      const cat = getCat(expense.category);
                      const isIncome = expense.type === 'income';
                      const isInvest = expense.type === 'investment';
                      return (
                        <div key={expense._id} onClick={() => openEdit(expense)}
                          style={{
                            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                            borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                            transition: 'background .12s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            background: isIncome ? '#dcfce7' : isInvest ? '#ede9fe' : cat.color + '18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                            {isIncome ? '↑' : isInvest ? '📈' : cat.emoji}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {expense.description}
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                              {isIncome ? 'Income' : isInvest ? 'Investment' : cat.label}
                              {expense.notes && <span style={{ opacity: .7 }}> · {expense.notes.slice(0, 30)}{expense.notes.length > 30 ? '…' : ''}</span>}
                            </p>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0,
                            color: isIncome ? '#16a34a' : isInvest ? '#6366f1' : 'var(--text)' }}>
                            {isIncome ? '+' : ''}{formatINR(expense.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ════════ ANALYTICS TAB ════════ */}
        {view === 'analytics' && (
          <>
            {!loading && expenses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p className="empty-state-title">No data yet</p>
                <p className="empty-state-sub">Add some expenses to see your spending breakdown and analytics</p>
              </div>
            ) : (
              <>
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  <div className="glass-card" style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Avg/Day</p>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>{formatINR(avgPerDay)}</p>
                  </div>
                  <div className="glass-card" style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Txns</p>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>{expenses.filter(e => e.type === 'expense').length}</p>
                  </div>
                  <div className="glass-card" style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Saved</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: netSavings >= 0 ? '#16a34a' : '#ef4444' }}>
                      {netSavings >= 0 ? '+' : ''}{formatINR(netSavings)}
                    </p>
                  </div>
                </div>

                {/* Income vs expense bar */}
                {hasIncome && (
                  <div className="glass-card" style={{ padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Income {formatINR(totalIncome)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Spent {formatINR(totalExpenses)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ height: '100%', background: '#16a34a', width: `${totalIncome > 0 ? Math.min(100, (totalExpenses / totalIncome) * 100) : 0}%`, borderRadius: 99, transition: 'width .5s' }} />
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5, textAlign: 'right' }}>
                      {totalIncome > 0
                        ? (() => { const p = (totalExpenses / totalIncome) * 100; return p > 0 && p < 1 ? '<1' : Math.round(p); })()
                        : 0}% of income spent
                    </p>
                  </div>
                )}

                {/* Donut + legend */}
                {catTotals.length > 0 && (
                  <div className="glass-card" style={{ padding: '14px', marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>By Category</p>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <DonutChart data={catTotals.map(c => ({ value: c.total, color: c.color }))} size={110} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        {catTotals.slice(0, 5).map(c => (
                          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-2)', flex: 1 }}>{c.emoji} {c.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{Math.round((c.total / totalExpenses) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Breakdown */}
                {catTotals.length > 0 && (
                  <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    {catTotals.map((c, idx) => (
                      <div key={c.key} style={{ padding: '10px 14px', borderBottom: idx < catTotals.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <span style={{ fontSize: 13 }}>{c.emoji}</span>
                            <span>{c.label}</span>
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{Math.round((c.total / totalExpenses) * 100)}%</span>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{formatINR(c.total)}</span>
                          </div>
                        </div>
                        <div style={{ height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, background: c.color, width: `${(c.total / totalExpenses) * 100}%`, transition: 'width .5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>



      {/* ── Add / Edit Sheet ── */}
      {addOpen && (
        <div className="modal-backdrop" onClick={closeSheet}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{editExpense ? 'Edit' : 'New Entry'}</h3>
              <button onClick={closeSheet} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 18px 18px' }}>

              {/* Type selector */}
              <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 8, padding: 2, gap: 1 }}>
                {(['expense', 'income', 'investment'] as const).map(t => (
                  <button key={t} onClick={() => setFType(t)} style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                    background: fType === t ? 'var(--surface)' : 'transparent',
                    color: fType === t ? typeColor(t) : 'var(--text-3)',
                    cursor: 'pointer', transition: 'all .12s',
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div style={{ textAlign: 'center', padding: '10px 0 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-3)' }}>₹</span>
                  <input type="number" min="0" autoFocus value={fAmount} onChange={e => setFAmount(e.target.value)}
                    placeholder="0"
                    style={{ fontSize: 32, fontWeight: 700, width: 150, border: 'none', background: 'transparent', outline: 'none', textAlign: 'center', color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1 }} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={lbl}>{fType === 'income' ? 'Source' : 'Description'}</label>
                <input className="input" placeholder={fType === 'income' ? 'e.g. Salary, freelance…' : 'What did you spend on?'}
                  value={fDesc} onChange={e => setFDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveExpense()} />
              </div>

              {/* Category (only for expenses) */}
              {fType === 'expense' && (
                <div>
                  <label style={lbl}>Category</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {allCats.map(cat => (
                      <button key={cat.key} onClick={() => setFCat(cat.key)} style={{
                        padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                        border: `1px solid ${fCat === cat.key ? cat.color : 'var(--border)'}`,
                        background: fCat === cat.key ? cat.color + '15' : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 7, transition: 'all .1s',
                      }}>
                        <span style={{ fontSize: 14 }}>{cat.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: fCat === cat.key ? cat.color : 'var(--text-2)' }}>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={lbl}>Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input className="input" placeholder="Any extra detail…" value={fNotes} onChange={e => setFNotes(e.target.value)} />
              </div>

              {/* Date */}
              <div>
                <label style={lbl}>Date</label>
                <input className="input" type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
              </div>
            </div>

            <div className="modal-footer" style={{ gap: 8 }}>
              {editExpense && (
                <>
                  <button onClick={() => openDuplicate(editExpense)} className="btn btn-ghost" style={{ marginRight: 'auto', fontSize: 12 }}>Duplicate</button>
                  <button onClick={() => deleteExpense(editExpense._id)} className="btn btn-danger">Delete</button>
                </>
              )}
              <button onClick={closeSheet} className="btn btn-ghost">Cancel</button>
              <button onClick={saveExpense} className="btn btn-primary"
                disabled={!fDesc.trim() || !fAmount || parseFloat(fAmount) <= 0 || saving}>
                {saving ? 'Saving…' : editExpense ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Manager ── */}
      {catMgrOpen && (
        <div className="modal-backdrop" onClick={() => setCatMgrOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Manage Categories</h3>
              <button onClick={() => setCatMgrOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Existing categories */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'visible' }}>
                {allCats.map((cat, idx) => (
                  <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: idx < allCats.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat.label}</span>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                    <button onClick={() => deleteCustomCategory(cat.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>

              {/* Add new category */}
              <div>
                <label style={lbl}>Add Category</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  {/* Emoji picker button */}
                  <div ref={emojiPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={() => setEmojiPickerOpen(o => !o)} style={{
                      width: 46, height: 38, borderRadius: 8, border: '1px solid var(--border)',
                      background: emojiPickerOpen ? 'var(--border)' : 'var(--surface)',
                      fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {newCatEmoji || '😊'}
                    </button>
                    {emojiPickerOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                        width: 260, maxHeight: 300, overflowY: 'auto', padding: '10px 10px 6px',
                      }}>
                        {EMOJI_GROUPS.map(group => (
                          <div key={group.label} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>
                              {group.label}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                              {group.emojis.map(e => (
                                <button key={e} onClick={() => { setNewCatEmoji(e); setEmojiPickerOpen(false); }} style={{
                                  width: 32, height: 32, borderRadius: 6, border: 'none',
                                  background: newCatEmoji === e ? 'var(--border)' : 'transparent',
                                  fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'background .1s',
                                }}
                                  onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--border)')}
                                  onMouseLeave={ev => (ev.currentTarget.style.background = newCatEmoji === e ? 'var(--border)' : 'transparent')}>
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input className="input" placeholder="Category name" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)}
                    style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addCustomCategory()} />
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                    title="Pick color"
                    style={{ width: 40, height: 38, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 3, background: 'var(--surface)' }} />
                </div>
                <button onClick={addCustomCategory} className="btn btn-primary" style={{ width: '100%', fontSize: 12 }} disabled={!newCatLabel.trim()}>
                  + Add Category
                </button>
              </div>

              <button onClick={resetCategories} style={{ ...ghostBtn, fontSize: 11, textAlign: 'center' }}>
                Reset to defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function typeColor(t: string) {
  if (t === 'income')     return '#16a34a';
  if (t === 'investment') return '#6366f1';
  return '#ef4444';
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function EmptyState({ onAdd, hasFilter }: { onAdd: () => void; hasFilter: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{hasFilter ? '🔍' : '💰'}</div>
      <p className="empty-state-title">{hasFilter ? 'No matching entries' : 'No entries this month'}</p>
      <p className="empty-state-sub">
        {hasFilter ? 'Try clearing your filters to see all entries' : 'Start tracking by logging your first expense, income or investment'}
      </p>
      {!hasFilter && <button onClick={onAdd} className="btn btn-primary">+ Add Entry</button>}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const arrowBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 20, color: 'var(--text-3)', padding: '4px 8px', lineHeight: 1, borderRadius: 7,
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
  marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.04em',
};
const centered: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '30vh', color: 'var(--text-3)',
};
const ghostBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  padding: '4px 10px', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12,
};
