import React from 'react'
import { BsBoxSeamFill } from 'react-icons/bs'
import { DASHBOARD_SIDEBAR_BOTTOM_LINKS, DASHBOARD_SIDEBAR_LINKS } from './constants'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiOutlineLogout } from 'react-icons/hi'
import classNames from 'classnames'

const linkClass =
	'flex items-center gap-2 font-light px-3 py-2 hover:bg-slate-700 hover:no-underline active:bg-slate-600 rounded-sm text-base'

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken();
    navigate('/', { replace: true });
  }

  return (
    <div className='bg-slate-900 w-60 p-3 flex flex-col text-white'>
      <div className='flex items-center gap-2 px-1 py-3'>
        <BsBoxSeamFill fontSize={24}/>
        <span className='text-slate-100' text-lg>AbuseBox</span>
      </div> 
      <div className='flex-1 py-8 flex flex-col gap0.5'>
        {DASHBOARD_SIDEBAR_LINKS.map( (item) => (
          <SidebarLink key={item.key} item={item}/>
        ))}
      </div>
      <div className='flex flex-col gap-0.5 pt-2 border-t border-slate-700'>
        {DASHBOARD_SIDEBAR_BOTTOM_LINKS.map(item => (
          <SidebarLink key={item.key} item={item}/>
        ))}
        <div
          className={classNames('text-red-500 cursor-pointer', linkClass)}>
          <span className='text-xl' onClick={handleLogout}><HiOutlineLogout /></span>
          Logout
        </div>
      </div>
    </div>
  )
}

function SidebarLink({item}) {
  const { pathname } = useLocation()

  return (
    <Link to={item.path} className={classNames(pathname === item.path ? 'bg-slate-700 text-white' : 'text-slate-400', linkClass)}>
      <span className='text-xl'>{item.icon}</span>
      {item.label}
    </Link>
  )
}