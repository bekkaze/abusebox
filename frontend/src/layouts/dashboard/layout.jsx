import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { HiExclamation, HiX } from 'react-icons/hi'
import Sidebar from '../../components/dashboard/Sidebar'
import Header from '../../components/dashboard/Header'
import ErrorBoundary from '../../components/shared/ErrorBoundary'
import CommandPalette from '../../components/shared/CommandPalette'
import useCurrentUser from '../../services/users/useCurrentUser'

const BANNER_KEY = 'abusebox.defaultPasswordBannerDismissed'

function DefaultPasswordBanner() {
  const me = useCurrentUser();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
  });
  if (!me?.using_default_password || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(BANNER_KEY, '1'); } catch { /* storage unavailable */ }
  };
  return (
    <div role="alert" className='flex items-start gap-3 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 sm:px-6 py-2.5 text-sm text-amber-900 dark:text-amber-100'>
      <HiExclamation className='mt-0.5 flex-shrink-0 text-lg text-amber-600 dark:text-amber-400' aria-hidden='true' />
      <p className='flex-1'>
        You&apos;re signed in with the default password from the install guide.{' '}
        <Link to='/dashboard/settings?tab=security' className='font-semibold underline'>Change it now</Link>
      </p>
      <button type='button' onClick={dismiss} className='p-1 -m-1 rounded hover:bg-amber-100 dark:hover:bg-amber-800/40' aria-label='Dismiss for this session'>
        <HiX aria-hidden='true' />
      </button>
    </div>
  );
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl/Cmd+K opens the command palette from anywhere in the dashboard.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className='flex flex-row bg-slate-100 dark:bg-slate-900 min-h-screen w-full'>
      <a
        href='#main-content'
        className='sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg'
      >
        Skip to content
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className='flex-1 min-w-0 flex flex-col'>
        <Header onMenuToggle={() => setSidebarOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <DefaultPasswordBanner />
        <main id='main-content' tabIndex={-1} className='p-4 sm:p-5 w-full max-w-7xl mx-auto focus:outline-none'>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
