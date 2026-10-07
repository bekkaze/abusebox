import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/dashboard/Sidebar'
import Header from '../../components/dashboard/Header'
import ErrorBoundary from '../../components/shared/ErrorBoundary'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <Header onMenuToggle={() => setSidebarOpen(true)} />
        <main id='main-content' tabIndex={-1} className='p-4 sm:p-5 w-full max-w-7xl mx-auto focus:outline-none'>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
