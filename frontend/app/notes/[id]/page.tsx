'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';

interface Note {
  _id: string; title: string; content: string;
  tags: string[]; isPublic: boolean; publicId?: string;
  isPinned: boolean;
}

export default function NoteEditor() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [noteId, setNoteId]       = useState<string | null>(isNew ? null : id);
  const [title, setTitle]         = useState('');
  const [content, setContent]     = useState('');
  const [tags, setTags]           = useState<string[]>([]);
  const [isPublic, setIsPublic]   = useState(false);
  const [isPinned, setIsPinned]   = useState(false);
  const [tagInput, setTagInput]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [copied, setCopied]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef    = useRef<HTMLDivElement>(null);

  function authHeader() {
    const token = localStorage.getItem('auth_token');
    return { Authorization: `Bearer ${token}` };
  }

  async function uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API}/api/upload`, { method: 'POST', headers: authHeader(), body: fd });
    const data = await res.json();
    if (!data.url) throw new Error('Upload failed');
    return data.url;
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Markdown,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Image.configure({ inline: false }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setContent((editor.storage as any).markdown.getMarkdown());
      setSaved(false);
    },
    editorProps: {
      handlePaste(_, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find(i => i.type.startsWith('image/'));
        if (imageItem) {
          const file = imageItem.getAsFile();
          if (!file) return false;
          setUploading(true);
          uploadImage(file)
            .then(url => { editor?.chain().focus().setImage({ src: url }).run(); })
            .finally(() => setUploading(false));
          return true;
        }
        const text = event.clipboardData?.getData('text/plain');
        if (text && text.includes('\n')) {
          event.preventDefault();
          const content = text.split('\n').map(line => ({
            type: 'paragraph',
            content: line.trim() ? [{ type: 'text', text: line }] : [],
          }));
          editor?.chain().focus().insertContent(content).run();
          return true;
        }
        return false;
      },
    },
  });

  // Click image in editor → open lightbox
  useEffect(() => {
    const container = editorRef.current;
    if (!container) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') setLightbox((target as HTMLImageElement).src);
    }
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, []);

  // Close lightbox on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLightbox(null); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── Load existing note ───────────────────────────────────────────────────
  useEffect(() => {
    if (isNew) return;
    fetch(`${API}/api/notes`, { headers: { ...authHeader(), 'Content-Type': 'application/json' } })
      .then(r => r.json())
      .then(data => {
        const found = (data.notes ?? []).find((n: Note) => n._id === id);
        if (!found) { router.replace('/dashboard'); return; }
        setTitle(found.title === 'Untitled' ? '' : found.title);
        setTags(found.tags);
        setIsPublic(found.isPublic);
        setIsPinned(found.isPinned ?? false);
        // Ensure headings have a blank line before them so tiptap-markdown
        // parses them as heading nodes (not literal "## text" paragraphs).
        const fixedContent = found.content.replace(/\)\n?(#{1,6} )/g, ')\n\n$1');
        setContent(fixedContent);
        editor?.commands.setContent(fixedContent);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editor]);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function save() {
    if (!title.trim()) return alert('Please add a title before saving.');
    setSaving(true);
    if (!noteId) {
      const res = await fetch(`${API}/api/notes`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags }),
      });
      const data = await res.json();
      setNoteId(data.note._id);
      window.history.replaceState(null, '', `/notes/${data.note._id}`);
    } else {
      await fetch(`${API}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags, isPublic, isPinned }),
      });
    }
    setSaving(false);
    setSaved(true);
    router.push('/dashboard');
  }

  async function patchNote(patch: Record<string, unknown>) {
    if (!noteId) return;
    await fetch(`${API}/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, tags, isPublic, isPinned, ...patch }),
    });
  }

  // ── Public toggle ─────────────────────────────────────────────────────────
  async function togglePublic() {
    if (!noteId) { alert('Save the note first.'); return; }
    const next = !isPublic;
    setIsPublic(next);
    await patchNote({ isPublic: next });
  }

  // ── Pin toggle ────────────────────────────────────────────────────────────
  async function togglePin() {
    if (!noteId) { alert('Save the note first.'); return; }
    const next = !isPinned;
    setIsPinned(next);
    await patchNote({ isPinned: next });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteNote() {
    if (!noteId) { router.replace('/dashboard'); return; }
    if (!confirm('Delete this note?')) return;
    await fetch(`${API}/api/notes/${noteId}`, { method: 'DELETE', headers: authHeader() });
    router.replace('/dashboard');
  }

  // ── Tags ──────────────────────────────────────────────────────────────────
  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const tag = tagInput.trim().toLowerCase();
    if (!tag || tags.includes(tag)) { setTagInput(''); return; }
    setTags([...tags, tag]);
    setTagInput('');
    setSaved(false);
  }
  function removeTag(tag: string) { setTags(tags.filter(t => t !== tag)); setSaved(false); }

  function copyShareMessage() {
    navigator.clipboard.writeText(`Check out my note "${title}" on Notes app!`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Image file upload ─────────────────────────────────────────────────────
  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      editor?.chain().focus().setImage({ src: url }).run();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  // Trim selection if it bleeds into the very start of the next block,
  // then apply a block-level command. Prevents H1/list from affecting an
  // unintended neighbour paragraph when the drag-selection end lands at
  // offset 0 of that paragraph.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function blockCmd(fn: (c: any) => any) {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const $to = editor.state.doc.resolve(to);
    const c = editor.chain().focus();
    if (!empty && $to.parentOffset === 0 && to > from) {
      c.setTextSelection({ from, to: to - 1 });
    }
    fn(c).run();
  }

  // ── Toolbar button ────────────────────────────────────────────────────────
  function ToolBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button
        onMouseDown={e => { e.preventDefault(); onClick(); }}
        style={{
          padding: '4px 9px', borderRadius: 6, border: '1px solid',
          borderColor: active ? '#2563eb' : 'var(--border)',
          background: active ? '#eff6ff' : 'var(--surface)',
          color: active ? '#2563eb' : 'var(--text)',
          fontWeight: 600, fontSize: 13, cursor: 'pointer', lineHeight: 1.4,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Toolbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px',
      }}>
        <div className="editor-toolbar">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost" style={{ padding: '5px 10px' }}>
            ← Back
          </button>

          <div style={{ flex: 1 }} />

          {saved && <span style={{ fontSize: 13, color: '#16a34a' }}>✓ Saved</span>}

          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ fontSize: 13 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>

          {/* Pin */}
          {noteId && (
            <button
              onClick={togglePin}
              title={isPinned ? 'Unpin note' : 'Pin note'}
              style={{
                background: isPinned ? '#fefce8' : 'transparent',
                border: `1px solid ${isPinned ? '#fde047' : 'var(--border)'}`,
                borderRadius: 7, padding: '4px 9px', cursor: 'pointer', fontSize: 15,
              }}
            >
              📌
            </button>
          )}

          {/* Public toggle */}
          {noteId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{isPublic ? '🌐 Public' : '🔒 Private'}</span>
              <button
                onClick={togglePublic}
                style={{
                  width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: isPublic ? '#2563eb' : '#d1d5db', position: 'relative', transition: 'background .2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: isPublic ? 20 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left .2s', display: 'block',
                }} />
              </button>
            </div>
          )}

          {isPublic && noteId && (
            <button onClick={copyShareMessage} className="btn btn-ghost" style={{ fontSize: 13 }}>
              {copied ? '✓ Copied!' : '📤 Share'}
            </button>
          )}

          <button onClick={deleteNote} className="btn btn-danger" style={{ fontSize: 13 }}>
            Delete
          </button>
        </div>
      </header>

      {/* ── Editor area ── */}
      <div className="editor-body">

        {/* Title */}
        <input
          className="input"
          value={title}
          onChange={e => { setTitle(e.target.value); setSaved(false); }}
          placeholder="Note title"
          style={{ fontSize: 22, fontWeight: 700, border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '8px 0', background: 'transparent' }}
        />

        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <span key={tag} className="tag">
              {tag}
              <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={addTag}
            placeholder="Add tag + Enter"
            style={{ border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-2)', background: 'transparent', width: 130 }}
          />
        </div>

        {/* Formatting toolbar */}
        {editor && (
          <div className="wysiwyg-toolbar">
            <ToolBtn label="B"      active={editor.isActive('bold')}                       onClick={() => editor.chain().focus().toggleBold().run()} />
            <ToolBtn label="I"      active={editor.isActive('italic')}                     onClick={() => editor.chain().focus().toggleItalic().run()} />
            <ToolBtn label="H1"     active={editor.isActive('heading', { level: 1 })}      onClick={() => blockCmd(c => c.toggleHeading({ level: 1 }))} />
            <ToolBtn label="H2"     active={editor.isActive('heading', { level: 2 })}      onClick={() => blockCmd(c => c.toggleHeading({ level: 2 }))} />
            <ToolBtn label="• List" active={editor.isActive('bulletList')}                 onClick={() => blockCmd(c => c.toggleBulletList())} />
            <ToolBtn label="1. List" active={editor.isActive('orderedList')}               onClick={() => blockCmd(c => c.toggleOrderedList())} />
            <ToolBtn label="`"      active={editor.isActive('code')}                        onClick={() => editor.chain().focus().toggleCode().run()} />
            <ToolBtn label="</>"   active={editor.isActive('codeBlock')}                  onClick={() => blockCmd(c => c.toggleCodeBlock())} />
            {/* Image upload button */}
            <button
              onMouseDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}
              style={{
                padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, cursor: 'pointer', lineHeight: 1.4,
              }}
            >
              🖼 Image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
          </div>
        )}

        {/* WYSIWYG editor */}
        <div className="wysiwyg-editor" ref={editorRef}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── Upload toast ── */}
      {uploading && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, background: '#1e293b', color: '#fff',
          padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,.25)',
          pointerEvents: 'none',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,.3)',
            borderTopColor: '#fff',
            display: 'inline-block',
            animation: 'spin .7s linear infinite',
            flexShrink: 0,
          }} />
          Uploading image…
        </div>
      )}

      {/* ── Image lightbox ── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
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
