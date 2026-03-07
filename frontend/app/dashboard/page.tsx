'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../theme-provider';

const fixMd = (md: string) => md.replace(/\)\n?(#{1,6} )/g, ')\n\n$1');

interface User { id: string; name: string; email: string; avatar: string; }
interface Note {
  _id: string; title: string; content: string;
  tags: string[]; isPublic: boolean; updatedAt: string;
  isPinned: boolean;
}
interface FeedNote extends Note {
  userId: { name: string; avatar: string };
}

export default function Dashboard() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [user, setUser]           = useState<User | null>(null);
  const [tab, setTab]             = useState<'mine' | 'explore'>('mine');
  const [notes, setNotes]         = useState<Note[]>([]);
  const [allTags, setAllTags]     = useState<string[]>([]);
  const [feed, setFeed]           = useState<FeedNote[]>([]);
  const [search, setSearch]       = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [menuOpen, setMenuOpen]     = useState(false);
  const [previewNote, setPreviewNote] = useState<Note | FeedNote | null>(null);
  const [lightbox, setLightbox]     = useState<string | null>(null);
  const menuRef                     = useRef<HTMLDivElement>(null);
  const modalContentRef             = useRef<HTMLDivElement>(null);
  const { theme, toggle: toggleTheme } = useTheme();

  function authHeader() {
    const token = localStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  // ── Load user ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { router.replace('/'); return; }
    fetch(`${API}/auth/me`, { headers: authHeader() })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setUser(d.user))
      .catch(() => { localStorage.removeItem('auth_token'); router.replace('/'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch notes ──────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async (q = '', tag = '') => {
    const params = new URLSearchParams();
    if (q) params.set('search', q);
    if (tag) params.set('tag', tag);
    const res = await fetch(`${API}/api/notes?${params}`, { headers: authHeader() });
    const data = await res.json();
    const fetched: Note[] = data.notes ?? [];
    setNotes(fetched);
    // Only update the full tag list when not filtering, so tags don't disappear
    if (!q && !tag) {
      setAllTags(Array.from(new Set(fetched.flatMap(n => n.tags))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API]);

  // ── Fetch feed ───────────────────────────────────────────────────────────
  const fetchFeed = useCallback(async () => {
    const res = await fetch(`${API}/api/feed`, { headers: authHeader() });
    const data = await res.json();
    setFeed(data.notes ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API]);

  useEffect(() => { if (user) fetchNotes(); }, [user, fetchNotes]);
  useEffect(() => { if (tab === 'explore' && user) fetchFeed(); }, [tab, user, fetchFeed]);

  // ── Debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => fetchNotes(search, activeTag), 350);
    return () => clearTimeout(t);
  }, [search, activeTag, fetchNotes]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close lightbox or preview modal on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else setPreviewNote(null);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightbox]);

  // Click image inside modal → open lightbox
  useEffect(() => {
    const el = modalContentRef.current;
    if (!el) return;
    function onClick(e: MouseEvent) {
      if ((e.target as HTMLElement).tagName === 'IMG')
        setLightbox((e.target as HTMLImageElement).src);
    }
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  });

  async function logout() {
    localStorage.removeItem('auth_token');
    try { await fetch(`${API}/auth/logout`, { credentials: 'include' }); } catch (_) {}
    router.replace('/');
  }

  if (!user) return <div style={centered}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Topbar ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="topbar-inner">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#111827"/>
              <rect x="8" y="9" width="16" height="2" rx="1" fill="white"/>
              <rect x="8" y="14" width="12" height="2" rx="1" fill="white"/>
              <rect x="8" y="19" width="9" height="2" rx="1" fill="white"/>
              <circle cx="24" cy="22" r="4" fill="#2563eb"/>
              <path d="M22.5 22l1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Note Bot</span>
          </div>

          {/* Desktop tabs */}
          <nav className="tabs-desktop" style={{ display: 'flex', gap: 2 }}>
            {(['mine', 'explore'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '5px 12px', borderRadius: 7, border: 'none',
                background: tab === t ? 'var(--border)' : 'transparent',
                fontWeight: tab === t ? 600 : 400,
                fontSize: 13, cursor: 'pointer', color: 'var(--text)',
              }}>
                {t === 'mine' ? 'My Notes' : 'Explore'}
              </button>
            ))}
          </nav>

          {/* Right side */}
          <div className="topbar-right">
            <button
              onClick={toggleTheme}
              title="Toggle dark mode"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, padding: '2px 4px', lineHeight: 1 }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="hide-sm" style={{ fontSize: 13, color: 'var(--text-2)' }}>{user.name}</span>

            {/* Avatar + dropdown */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" referrerPolicy="no-referrer"
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>
                    {user.name?.[0] ?? '?'}
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
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#dc2626' }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile tab bar */}
        <div className="tabs-mobile">
          {(['mine', 'explore'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color .15s, border-color .15s',
            }}>
              {t === 'mine' ? 'My Notes' : 'Explore'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* ─────────── MY NOTES TAB ─────────── */}
        {tab === 'mine' && (
          <>
            <div className="controls-row">
              <input
                className="input"
                placeholder="Search notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: '1 1 160px', minWidth: 0 }}
              />
              <button onClick={() => router.push('/notes/new')} className="btn btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                + New Note
              </button>
            </div>
            {allTags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                {['', ...allTags].map(tag => (
                  <button key={tag || '__all__'} onClick={() => setActiveTag(tag)} style={{
                    padding: '4px 11px', borderRadius: 99, border: '1px solid',
                    borderColor: activeTag === tag ? '#2563eb' : 'var(--border)',
                    background: activeTag === tag ? '#eff6ff' : 'transparent',
                    color: activeTag === tag ? '#2563eb' : 'var(--text-2)',
                    fontSize: 12, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                  }}>
                    {tag || 'All'}
                  </button>
                ))}
              </div>
            )}

            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                <p style={{ fontSize: 15 }}>{search || activeTag ? 'No notes match your search.' : 'No notes yet. Create your first one!'}</p>
              </div>
            ) : (
              <div className="notes-grid">
                {notes.map(note => (
                  <div
                    key={note._id}
                    className="card"
                    onClick={() => setPreviewNote(note)}
                    style={{ padding: 16, cursor: 'pointer', transition: 'box-shadow .15s', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{note.title}</h3>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                        {note.isPinned && <span style={{ fontSize: 12 }}>📌</span>}
                        <span style={{ fontSize: 13 }}>{note.isPublic ? '🌐' : '🔒'}</span>
                      </div>
                    </div>
                    {fixMd(note.content) && (
                      <div className="card-preview card-preview--sm">
                        <ReactMarkdown>{fixMd(note.content)}</ReactMarkdown>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {note.tags.slice(0, 2).map(tag => <span key={tag} className="tag">{tag}</span>)}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─────────── EXPLORE TAB ─────────── */}
        {tab === 'explore' && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {feed.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
                <p style={{ fontSize: 15 }}>No public notes yet. Be the first to share one!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {feed.map(note => (
                  <div key={note._id} className="card" onClick={() => setPreviewNote(note)} style={{ padding: 18, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      {note.userId?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={note.userId.avatar} alt="" referrerPolicy="no-referrer"
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                          {note.userId?.name?.[0] ?? '?'}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.userId?.name ?? 'Unknown'}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeAgo(note.updatedAt)}</p>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{note.title}</h3>
                      {fixMd(note.content) && (
                        <div className="card-preview card-preview--lg" style={{ marginBottom: 10 }}>
                          <ReactMarkdown>{fixMd(note.content)}</ReactMarkdown>
                        </div>
                      )}
                      {note.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {note.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Preview Modal ── */}
      {previewNote && (
        <div className="modal-backdrop" onClick={() => setPreviewNote(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="modal-header" style={{ borderRadius: '14px 14px 0 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {'userId' in previewNote && typeof previewNote.userId === 'object' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {previewNote.userId?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewNote.userId.avatar} alt="" referrerPolicy="no-referrer"
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>
                        {previewNote.userId?.name?.[0] ?? '?'}
                      </div>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{previewNote.userId?.name ?? 'Unknown'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{timeAgo(previewNote.updatedAt)}</span>
                  </div>
                )}
                <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>{previewNote.title}</h2>
                {previewNote.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {previewNote.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                )}
              </div>
              <button onClick={() => setPreviewNote(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 20,
                color: 'var(--text-3)', padding: '0 4px', lineHeight: 1, flexShrink: 0, alignSelf: 'flex-start',
              }}>×</button>
            </div>

            {/* Modal content */}
            <div className="modal-content" ref={modalContentRef}>
              {previewNote.content
                ? <ReactMarkdown>{fixMd(previewNote.content)}</ReactMarkdown>
                : <p style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No content.</p>
              }
            </div>

            {/* Modal footer — Edit button for own notes */}
            {!('userId' in previewNote && typeof previewNote.userId === 'object') && (
              <div className="modal-footer">
                <button onClick={() => router.push(`/notes/${previewNote._id}`)} className="btn btn-primary" style={{ fontSize: 13 }}>
                  Edit note
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Image lightbox ── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 24,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,.5)' }} />
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const centered: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-3)' };
