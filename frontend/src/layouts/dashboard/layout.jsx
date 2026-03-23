import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/dashboard/Sidebar'
import Header from '../../components/dashboard/Header'

export default function DashboardLayout() {
  return (
    <div className='flex flex-row bg-slate-100 dark:bg-slate-900 min-h-screen w-screen overflow-hidden'>
      <Sidebar />
      <div className='flex-1 min-w-0 flex flex-col'>
        <Header/>
        <main className='p-5 overflow-y-auto'>
          <Outlet/>
        </main>
      </div>
    </div>
  )
}
