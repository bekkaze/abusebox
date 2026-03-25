import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/dashboard/Sidebar'
import Header from '../../components/dashboard/Header'
import ErrorBoundary from '../../components/shared/ErrorBoundary'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className='flex flex-row bg-slate-100 dark:bg-slate-900 min-h-screen w-screen overflow-hidden'>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className='flex-1 min-w-0 flex flex-col'>
        <Header onMenuToggle={() => setSidebarOpen(true)} />
        <main className='p-5 overflow-y-auto'>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
