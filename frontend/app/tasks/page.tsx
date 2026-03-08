'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '../context/AppContext';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Types ────────────────────────────────────────────────────────────────────

interface Subtask { _id: string; title: string; completed: boolean; }
interface Task {
  _id: string;
  title: string;
  notes: string;
  completed: boolean;
  dueDate: string | null;
  priority: 'none' | 'low' | 'medium' | 'high';
  label: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  subtasks: Subtask[];
  order: number;
  createdAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  high: '#ef4444', medium: '#f59e0b', low: '#22c55e', none: 'transparent',
};

const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  work:     { bg: '#eff6ff', text: '#2563eb' },
  personal: { bg: '#faf5ff', text: '#7c3aed' },
  home:     { bg: '#f0fdf4', text: '#16a34a' },
  health:   { bg: '#fff7ed', text: '#ea580c' },
  other:    { bg: '#f9fafb', text: '#6b7280' },
};

const RECURRENCE_LABELS = { none: 'None', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date) { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function groupTasks(tasks: Task[]) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const groups: Record<string, Task[]> = { overdue: [], today: [], tomorrow: [], upcoming: [], noDate: [], completed: [] };
  for (const t of tasks) {
    if (t.completed) { groups.completed.push(t); continue; }
    if (!t.dueDate)  { groups.noDate.push(t);    continue; }
    const d = startOfDay(new Date(t.dueDate));
    if (d < today)             { groups.overdue.push(t);   continue; }
    if (isSameDay(d, today))   { groups.today.push(t);     continue; }
    if (isSameDay(d, tomorrow)){ groups.tomorrow.push(t);  continue; }
    groups.upcoming.push(t);
  }
  // Sort each group by order, then createdAt descending
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => a.order - b.order || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return groups;
}
const GROUP_META: Record<string, { label: string; color: string }> = {
  overdue:   { label: 'Overdue',   color: '#ef4444' },
  today:     { label: 'Today',     color: '#f97316' },
  tomorrow:  { label: 'Tomorrow',  color: '#8b5cf6' },
  upcoming:  { label: 'Upcoming',  color: '#2563eb' },
  noDate:    { label: 'No date',   color: '#9ca3af' },
  completed: { label: 'Completed', color: '#9ca3af' },
};
const GROUP_ORDER = ['overdue', 'today', 'tomorrow', 'upcoming', 'noDate', 'completed'];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const { refreshTasks } = useAppContext();

  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  // Form state
  const [fTitle, setFTitle] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fDue,   setFDue]   = useState('');
  const [fPri,   setFPri]   = useState<Task['priority']>('none');
  const [fLabel, setFLabel] = useState('');
  const [fRecur, setFRecur] = useState<Task['recurrence']>('none');
  const [fSubs,  setFSubs]  = useState<{ title: string; completed: boolean }[]>([]);
  const [fNewSub, setFNewSub] = useState('');
  const [saving,  setSaving]  = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function authHeader() {
    const token = localStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`${API}/api/tasks`, { headers: authHeader() });
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { router.replace('/'); return; }
    fetchTasks();
  }, [fetchTasks, router]);

  // Listen for FAB click dispatched by AppShell
  useEffect(() => {
    const handler = () => openAdd();
    document.addEventListener('app:fab', handler);
    return () => document.removeEventListener('app:fab', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function openAdd() {
    setFTitle(''); setFNotes(''); setFDue(''); setFPri('none');
    setFLabel(''); setFRecur('none'); setFSubs([]); setFNewSub('');
    setEditTask(null); setAddOpen(true);
  }
  function openEdit(task: Task) {
    setFTitle(task.title);
    setFNotes(task.notes || '');
    setFDue(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setFPri(task.priority);
    setFLabel(task.label);
    setFRecur(task.recurrence || 'none');
    setFSubs(task.subtasks.map(s => ({ title: s.title, completed: s.completed })));
    setFNewSub('');
    setEditTask(task); setAddOpen(true);
  }
  function closeSheet() { setAddOpen(false); setEditTask(null); }

  async function saveTask() {
    if (!fTitle.trim()) return;
    setSaving(true);
    const body = { title: fTitle.trim(), notes: fNotes, dueDate: fDue || null, priority: fPri, label: fLabel, recurrence: fRecur, subtasks: fSubs };
    if (editTask) {
      const res = await fetch(`${API}/api/tasks/${editTask._id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(body) });
      if (res.ok) { const u = await res.json(); setTasks(p => p.map(t => t._id === u._id ? u : t)); }
    } else {
      const res = await fetch(`${API}/api/tasks`, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
      if (res.ok) { const c = await res.json(); setTasks(p => [c, ...p]); }
    }
    setSaving(false); closeSheet(); refreshTasks();
  }

  async function toggleComplete(task: Task) {
    const res = await fetch(`${API}/api/tasks/${task._id}`, {
      method: 'PUT', headers: authHeader(),
      body: JSON.stringify({ completed: !task.completed }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks(p => p.map(t => t._id === updated._id ? updated : t));
      refreshTasks();
      // If recurring task was completed, a new one was created — refetch
      if (!task.completed && task.recurrence !== 'none') fetchTasks();
    }
  }

  async function deleteTask(id: string) {
    const res = await fetch(`${API}/api/tasks/${id}`, { method: 'DELETE', headers: authHeader() });
    if (res.ok) { setTasks(p => p.filter(t => t._id !== id)); refreshTasks(); }
    closeSheet();
  }

  async function handleDragEnd(event: DragEndEvent, groupKey: string) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groups = groupTasks(tasks);
    const list = groups[groupKey];
    const oldIdx = list.findIndex(t => t._id === active.id);
    const newIdx = list.findIndex(t => t._id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(list, oldIdx, newIdx);
    const updates = reordered.map((t, i) => ({ id: t._id, order: i * 10 }));

    // Optimistic update
    const orderMap: Record<string, number> = {};
    updates.forEach(u => { orderMap[u.id] = u.order; });
    setTasks(p => p.map(t => t._id in orderMap ? { ...t, order: orderMap[t._id] } : t));

    await fetch(`${API}/api/tasks/reorder`, {
      method: 'PATCH', headers: authHeader(),
      body: JSON.stringify({ updates }),
    });
  }

  function addSubtask() {
    if (!fNewSub.trim()) return;
    setFSubs(p => [...p, { title: fNewSub.trim(), completed: false }]);
    setFNewSub('');
  }

  const pendingCount = tasks.filter(t => !t.completed).length;
  const groups = groupTasks(tasks);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Content ── */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', paddingBottom: 100 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>My Tasks</h1>
            {!loading && (
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
                {pendingCount > 0 ? `${pendingCount} pending` : 'All done!'}
              </p>
            )}
          </div>
          <button onClick={openAdd} className="btn btn-primary new-note-btn" style={{ whiteSpace: 'nowrap' }}>
            + Add Task
          </button>
        </div>

        {loading ? (
          <div style={centered}>Loading...</div>
        ) : tasks.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          GROUP_ORDER.map(key => {
            const list = groups[key];
            if (!list.length) return null;
            const meta = GROUP_META[key];
            return (
              <div key={key} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>({list.length})</span>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleDragEnd(e, key)}>
                  <SortableContext items={list.map(t => t._id)} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {list.map(task => (
                        <SortableTaskRow key={task._id} task={task} onToggle={() => toggleComplete(task)} onEdit={() => openEdit(task)} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            );
          })
        )}
      </main>


      {/* ── Add / Edit Sheet ── */}
      {addOpen && (
        <div className="modal-backdrop" onClick={closeSheet}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>{editTask ? 'Edit Task' : 'New Task'}</h3>
              <button onClick={closeSheet} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Title */}
              <div>
                <label style={lbl}>Title</label>
                <input className="input" placeholder="What needs to be done?" value={fTitle} onChange={e => setFTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveTask()} autoFocus />
              </div>

              {/* Notes */}
              <div>
                <label style={lbl}>Notes</label>
                <textarea className="input" placeholder="Add details..." value={fNotes} onChange={e => setFNotes(e.target.value)} style={{ resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }} />
              </div>

              {/* Due date + Recurrence row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Due Date</label>
                  <input className="input" type="date" value={fDue} onChange={e => setFDue(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Repeat</label>
                  <select className="input" value={fRecur} onChange={e => setFRecur(e.target.value as Task['recurrence'])} style={{ cursor: 'pointer' }}>
                    {(Object.keys(RECURRENCE_LABELS) as Task['recurrence'][]).map(r => (
                      <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={lbl}>Priority</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['none', 'low', 'medium', 'high'] as const).map(p => (
                    <button key={p} onClick={() => setFPri(p)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8,
                      border: `1.5px solid ${fPri === p ? (PRIORITY_COLOR[p] || 'var(--accent)') : 'var(--border)'}`,
                      background: fPri === p ? (p === 'none' ? 'var(--border)' : PRIORITY_COLOR[p] + '20') : 'transparent',
                      color: fPri === p && p !== 'none' ? PRIORITY_COLOR[p] : 'var(--text)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    }}>{p === 'none' ? 'None' : p}</button>
                  ))}
                </div>
              </div>

              {/* Label */}
              <div>
                <label style={lbl}>Label</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['', 'work', 'personal', 'home', 'health', 'other'] as const).map(l => {
                    const lc = LABEL_COLORS[l] ?? { bg: 'var(--border)', text: 'var(--text)' };
                    const active = fLabel === l;
                    return (
                      <button key={l || '__none__'} onClick={() => setFLabel(l)} style={{
                        padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                        border: `1.5px solid ${active ? lc.text : 'var(--border)'}`,
                        background: active ? lc.bg : 'transparent',
                        color: active ? lc.text : 'var(--text-2)',
                        cursor: 'pointer', textTransform: 'capitalize',
                      }}>{l || 'None'}</button>
                    );
                  })}
                </div>
              </div>

              {/* Subtasks */}
              <div>
                <label style={lbl}>Subtasks</label>
                {fSubs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {fSubs.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setFSubs(p => p.map((x, j) => j === i ? { ...x, completed: !x.completed } : x))}
                          style={{ width: 18, height: 18, borderRadius: '50%', border: s.completed ? 'none' : '2px solid var(--border)', background: s.completed ? '#2563eb' : 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {s.completed && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                        <span style={{ flex: 1, fontSize: 13, textDecoration: s.completed ? 'line-through' : 'none', color: s.completed ? 'var(--text-3)' : 'var(--text)' }}>{s.title}</span>
                        <button onClick={() => setFSubs(p => p.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="Add subtask..." value={fNewSub}
                    onChange={e => setFNewSub(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                    style={{ flex: 1 }} />
                  <button onClick={addSubtask} className="btn btn-ghost" style={{ flexShrink: 0, padding: '8px 12px' }}>Add</button>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ gap: 10 }}>
              {editTask && (
                <button onClick={() => deleteTask(editTask._id)} className="btn btn-danger" style={{ marginRight: 'auto' }}>Delete</button>
              )}
              <button onClick={closeSheet} className="btn btn-ghost">Cancel</button>
              <button onClick={saveTask} className="btn btn-primary" disabled={!fTitle.trim() || saving}>
                {saving ? 'Saving...' : editTask ? 'Save' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sortable Task Row ─────────────────────────────────────────────────────────

function SortableTaskRow({ task, onToggle, onEdit }: { task: Task; onToggle: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow task={task} onToggle={onToggle} onEdit={onEdit} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function TaskRow({ task, onToggle, onEdit, dragHandleProps }: {
  task: Task; onToggle: () => void; onEdit: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const today = startOfDay(new Date());
  const isOverdue = due && startOfDay(due) < today && !task.completed;
  const dueLabel = due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
  const completedSubs = task.subtasks.filter(s => s.completed).length;
  const totalSubs = task.subtasks.length;

  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={onEdit}>
      {/* Drag handle */}
      <div {...dragHandleProps} onClick={e => e.stopPropagation()} style={{ cursor: 'grab', color: 'var(--text-3)', padding: '0 2px', flexShrink: 0, touchAction: 'none', lineHeight: 1 }} title="Drag to reorder">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
          <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
          <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
        </svg>
      </div>

      {/* Checkbox */}
      <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: task.completed ? 'none' : '2px solid var(--border)',
        background: task.completed ? '#2563eb' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all .15s',
      }} aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}>
        {task.completed && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{
            fontSize: 14, fontWeight: 500, lineHeight: 1.3,
            textDecoration: task.completed ? 'line-through' : 'none',
            color: task.completed ? 'var(--text-3)' : 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>{task.title}</p>
          {task.recurrence !== 'none' && (
            <span style={{ fontSize: 10, color: 'var(--text-3)' }} title={`Repeats ${task.recurrence}`}>🔁</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          {task.label && LABEL_COLORS[task.label] && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 7px', borderRadius: 99, background: LABEL_COLORS[task.label].bg, color: LABEL_COLORS[task.label].text, textTransform: 'capitalize' }}>{task.label}</span>
          )}
          {totalSubs > 0 && (
            <span style={{ fontSize: 11, color: completedSubs === totalSubs ? '#22c55e' : 'var(--text-3)' }}>
              ✓ {completedSubs}/{totalSubs}
            </span>
          )}
          {dueLabel && (
            <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : 'var(--text-3)' }}>{isOverdue ? '⚠ ' : ''}{dueLabel}</span>
          )}
          {task.notes && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>📝</span>}
        </div>
      </div>

      {/* Priority dot */}
      {task.priority !== 'none' && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[task.priority], flexShrink: 0 }} title={task.priority} />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-3)' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>No tasks yet</p>
      <p style={{ fontSize: 13, marginBottom: 24 }}>Tap + to add your first task</p>
      <button onClick={onAdd} className="btn btn-primary">+ Add Task</button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
  marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em',
};
const centered: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: '40vh', color: 'var(--text-3)',
};
