import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../../components/dashboard/Sidebar'
import Header from '../../components/dashboard/Header'

export default function DashboardLayout() {
  return (
    <div className='flex flex-row bg-slate-100 h-screen w-screen overflow-hidden'>
      <Sidebar />
      <div className='flex-1'>
        <Header/>
        <div className='p-4'>{<Outlet/>}</div>
      </div>
    </div>
  )
}