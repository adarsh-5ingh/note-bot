'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const spinner = (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid #e5e7eb', borderTopColor: '#111827',
      animation: 'spin 0.7s linear infinite',
    }} />
    <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Signing you in...</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

// This page is the landing spot after a successful OAuth login.
// Express redirects here with: /auth/callback?token=<JWT>
// We grab the token, store it in localStorage, then send the user to /dashboard.
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      router.replace('/?error=' + error);
      return;
    }

    if (token) {
      localStorage.setItem('auth_token', token);
      window.location.replace('/dashboard');
    } else {
      router.replace('/');
    }
  }, [router, searchParams]);

  return spinner;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={spinner}>
      <AuthCallbackInner />
    </Suspense>
  );
}
