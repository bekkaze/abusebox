import React from 'react'
import { DASHBOARD_SIDEBAR_BOTTOM_LINKS, DASHBOARD_SIDEBAR_SECTIONS } from './constants'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiOutlineLogout } from 'react-icons/hi'
import classNames from 'classnames'
import { useAuth } from '../../services/auth/authProvider'

const linkClass =
	'flex items-center gap-3 px-3 py-2 hover:bg-slate-800 hover:no-underline active:bg-slate-700 rounded-xl text-sm font-medium transition-colors'

export default function Sidebar() {
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const handleLogout = () => {
    setToken(null);
    navigate('/', { replace: true });
  }

  return (
    <aside className='bg-slate-900 w-64 p-4 flex flex-col text-white border-r border-slate-800 overflow-y-auto'>
      <div className='flex items-center gap-3 px-2 py-3'>
        <img src="/logo.png" alt="AbuseBox" className='h-9 w-9 rounded-xl object-cover' />
        <div>
          <p className='text-slate-100 text-lg font-semibold leading-none'>AbuseBox</p>
          <p className='text-slate-400 text-xs mt-1'>Threat Monitoring</p>
        </div>
      </div>

      <div className='flex-1 py-4 flex flex-col gap-4'>
        {DASHBOARD_SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className='px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500'>
              {section.label}
            </p>
            <div className='flex flex-col gap-0.5'>
              {section.links.map((item) => (
                <SidebarLink key={item.key} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className='flex flex-col gap-1 pt-3 border-t border-slate-800'>
        {DASHBOARD_SIDEBAR_BOTTOM_LINKS.map(item => (
          <SidebarLink key={item.key} item={item}/>
        ))}
        <div
          className={classNames('text-rose-400 cursor-pointer', linkClass)}
          onClick={handleLogout}>
          <span className='text-xl'><HiOutlineLogout /></span>
          Logout
        </div>
      </div>
    </aside>
  )
}

function SidebarLink({item}) {
  const { pathname } = useLocation()
  const isExternal = item.path.startsWith('http') || item.path.startsWith('/swagger/')
  const classes = classNames(
    !isExternal && pathname === item.path ? 'bg-slate-800 text-white' : 'text-slate-300',
    linkClass
  )

  if (isExternal) {
    return (
      <a href={item.path} className={classes} target='_blank' rel='noreferrer'>
        <span className='text-lg'>{item.icon}</span>
        {item.label}
      </a>
    )
  }

  return (
    <Link to={item.path} className={classes}>
      <span className='text-lg'>{item.icon}</span>
      {item.label}
    </Link>
  )
}
