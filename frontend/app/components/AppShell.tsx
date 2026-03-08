'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import { useAppContext } from '../context/AppContext';

type ActiveTab = 'notes' | 'explore' | 'tasks' | 'expenses';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAppContext();

  // Pages where the shell (header + nav) should not appear
  const isAuthPage   = pathname === '/' || pathname.startsWith('/auth');
  const isEditorPage = pathname.startsWith('/notes/');

  if (isAuthPage || isEditorPage || !user) {
    return <>{children}</>;
  }

  const isExplore = pathname === '/dashboard' && searchParams.get('tab') === 'explore';
  const activeTab: ActiveTab =
    pathname === '/tasks'    ? 'tasks'   :
    pathname === '/expenses' ? 'expenses':
    isExplore                ? 'explore' : 'notes';

  // FAB: dashboard navigates to new note, other pages dispatch event for page to handle
  function handleFab() {
    if (pathname === '/dashboard') {
      router.push('/notes/new');
    } else {
      document.dispatchEvent(new CustomEvent('app:fab'));
    }
  }

  // .fab = mobile-only (dashboard), .tasks-fab = always visible (tasks/expenses)
  const fabClass = pathname === '/dashboard' ? 'fab' : 'tasks-fab';

  return (
    <>
      <AppHeader />
      {children}
      <button className={fabClass} onClick={handleFab} aria-label="Add">+</button>
      <BottomNav active={activeTab} />
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<>{children}</>}><AppShellInner>{children}</AppShellInner></Suspense>;
}
