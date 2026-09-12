'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Credential = { expiresAt: string };
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ShortcutSetupPage() {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) { setNeedsLogin(true); setLoading(false); return; }
      try {
        const res = await fetch(`${API}/api/shortcuts/credential`, {
          headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal,
        });
        if (res.status === 401) { setNeedsLogin(true); return; }
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load connection.');
        setCredential(data.credential);
        setReady(true);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load connection.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function update(method: 'POST' | 'DELETE') {
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); setToken('');
    try {
      const res = await fetch(`${API}/api/shortcuts/credential`, {
        method, headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      if (res.status === 401) { setNeedsLogin(true); return; }
      const data = res.status === 204 ? null : await res.json();
      if (!res.ok) throw new Error(data?.message || 'Could not update connection.');
      setCredential(data?.credential || null);
      setToken(data?.token || '');
      setNotice(method === 'DELETE' ? 'Disconnected. Your Shortcut can no longer add expenses.' : 'Connection created. Copy the authorization value before leaving this page.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update connection. Please try again.'); }
    finally { setBusy(false); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice('Copied.'); }
    catch { setNotice('Copy was unavailable. Select and copy the value manually.'); }
  }

  const endpoint = `${API.replace(/\/$/, '')}/api/shortcuts/expenses`;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 100px', lineHeight: 1.65 }}>
      <Link href="/expenses" className="btn btn-ghost">← Expenses</Link>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 20 }}>Add expenses with Back Tap</h1>
      <p style={{ color: 'var(--text-2)', margin: '8px 0 24px' }}>Double-tap the back of your iPhone, enter an amount and description, and save without opening Note Bot.</p>

      <section className="glass-card" style={{ padding: 20, marginBottom: 24 }} aria-labelledby="connection-title">
        <h2 id="connection-title" style={{ fontSize: 18, fontWeight: 600 }}>1. Connect your Shortcut</h2>
        {loading ? <p>Loading connection…</p> : needsLogin ? (
          <p><Link href="/">Sign in to Note Bot</Link>, then return to Expenses → iPhone Back Tap.</p>
        ) : <>
          {ready && <p style={{ margin: '10px 0' }}>{credential
            ? `Connection ${new Date(credential.expiresAt) <= new Date() ? 'expired' : 'expires'} ${new Date(credential.expiresAt).toLocaleDateString()}. Replacing it stops the previous connection.`
            : 'Create a connection that can only add expenses. It lasts one year and can be disconnected here anytime.'}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            <button className="btn btn-primary" disabled={busy || !ready} onClick={() => update('POST')}>
              {busy ? 'Updating…' : credential ? 'Replace connection' : 'Create connection'}
            </button>
            {credential && <button className="btn btn-danger" disabled={busy} onClick={() => update('DELETE')}>Disconnect</button>}
            {!ready && <button className="btn btn-ghost" onClick={() => window.location.reload()}>Try again</button>}
          </div>
          {token && <>
            <label htmlFor="shortcut-authorization">Authorization value — shown only now</label>
            <textarea id="shortcut-authorization" className="input" readOnly value={`Bearer ${token}`} rows={3} style={{ width: '100%', marginTop: 8, fontFamily: 'monospace', overflowWrap: 'anywhere' }} />
            <button className="btn btn-ghost" onClick={() => copy(`Bearer ${token}`)}>Copy authorization</button>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Keep this value private. Remove it before sharing your Shortcut. If lost, replace the connection and update the Shortcut.</p>
          </>}
        </>}
        {error && <p role="alert" style={{ color: 'var(--danger, #dc2626)', marginTop: 12 }}>{error}</p>}
        {notice && <p role="status" style={{ marginTop: 12 }}>{notice}</p>}
      </section>

      <section aria-labelledby="shortcut-title">
        <h2 id="shortcut-title" style={{ fontSize: 18, fontWeight: 600 }}>2. Create “Add Note Bot Expense” in Shortcuts</h2>
        <p style={{ margin: '8px 0' }}>On your iPhone, open Apple Shortcuts, tap +, and add these actions in order. Rename each output variable as shown so you can select it later.</p>
        <ol style={{ paddingLeft: 24, display: 'grid', gap: 12 }}>
          <li><strong>Ask for Input:</strong> “How much?” Set input type to Number. Name the output <strong>Amount</strong>.</li>
          <li><strong>Ask for Input:</strong> “What for?” Set input type to Text. Name the output <strong>Description</strong>.</li>
          <li><strong>Current Date → Format Date:</strong> choose Custom, enter <code>yyyy-MM-dd</code>, and use your local timezone. Name the output <strong>Expense Date</strong>.</li>
          <li><strong>Generate UUID:</strong> name the output <strong>Request ID</strong>. Generate it once per expense.</li>
          <li><strong>Get Contents of URL:</strong> paste this address and set Method to <strong>POST</strong>.
            <label htmlFor="shortcut-endpoint" style={{ display: 'block', marginTop: 8 }}>Expense endpoint</label>
            <input id="shortcut-endpoint" className="input" readOnly value={endpoint} style={{ width: '100%' }} />
            <button className="btn btn-ghost" onClick={() => copy(endpoint)}>Copy endpoint</button>
            <p>Add a header named <code>Authorization</code> and paste the full authorization value from step 1, including <code>Bearer </code>.</p>
            <p>Set Request Body to <strong>JSON</strong>. Add these fields and select their output variables:</p>
            <table style={{ width: '100%', textAlign: 'left', margin: '10px 0' }}>
              <thead><tr><th>Key</th><th>Type</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td><code>amount</code></td><td>Number</td><td>Amount</td></tr>
                <tr><td><code>description</code></td><td>Text</td><td>Description</td></tr>
                <tr><td><code>date</code></td><td>Text</td><td>Expense Date</td></tr>
                <tr><td><code>requestId</code></td><td>Text</td><td>Request ID</td></tr>
              </tbody>
            </table>
          </li>
          <li><strong>Get Dictionary Value:</strong> get <code>message</code> from the Get Contents of URL result. Then <strong>Show Alert</strong> with that value. This displays either the confirmed save or the server’s error.</li>
        </ol>
        <p style={{ margin: '16px 0', color: 'var(--text-2)' }}>Run it once in Shortcuts and allow access to the API when prompted. Amounts are in INR; entries use the Other category. Canceling an input prompt stops before saving.</p>
      </section>

      <section style={{ marginTop: 24 }} aria-labelledby="back-tap-title">
        <h2 id="back-tap-title" style={{ fontSize: 18, fontWeight: 600 }}>3. Assign Double Tap</h2>
        <p style={{ margin: '8px 0' }}>Open Settings → Accessibility → Touch → Back Tap → Double Tap, then select Add Note Bot Expense.</p>
        <p>Test while your iPhone is unlocked. Locked-screen behavior can vary; unlocking may be needed. Internet access is required.</p>
        <p style={{ marginTop: 12 }}>If a save times out, check Expenses before starting again. Re-running the whole Shortcut generates a new Request ID. Automatic retries must reuse the original ID and fields.</p>
        <p style={{ marginTop: 12 }}><a href="https://support.apple.com/en-ca/guide/shortcuts/apd897693606/ios" target="_blank" rel="noreferrer">Apple’s Back Tap guide ↗</a></p>
      </section>
    </main>
  );
}
