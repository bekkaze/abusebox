import { useEffect } from 'react'
import { DASHBOARD_SIDEBAR_BOTTOM_LINKS, DASHBOARD_SIDEBAR_SECTIONS } from './constants'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HiXMark } from 'react-icons/hi2'
import classNames from 'classnames'
import { useAuth } from '../../services/auth/authProvider'

const linkClass =
  'relative flex items-center h-8 px-2.5 rounded-md text-sm transition-colors hover:no-underline'

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const handleLogout = () => {
    setToken(null, null);
    navigate('/', { replace: true });
  }

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-scrim/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside aria-label='Main navigation' className={classNames(
        'bg-rail w-60 px-3 pb-3 flex flex-col border-r border-rule overflow-y-auto',
        'fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:flex-shrink-0',
        'transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className='flex items-center justify-between h-14 px-1.5'>
          <Link to='/dashboard' onClick={onClose} className='flex items-center gap-2.5 hover:no-underline'>
            <img src="/logo.png" alt="" className='h-7 w-7 rounded-md object-cover' />
            <span className='text-[15px] font-semibold tracking-tight text-ink'>AbuseBox</span>
          </Link>
          <button
            type='button'
            onClick={onClose}
            className='lg:hidden p-1.5 rounded-md text-ink-2 hover:bg-paper hover:text-ink'
            aria-label='Close navigation'
          >
            <HiXMark className='text-lg' aria-hidden='true' />
          </button>
        </div>

        <nav className='flex-1 pt-2 flex flex-col gap-5'>
          {DASHBOARD_SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className='px-2.5 mb-1 text-xs font-medium text-ink-2'>{section.label}</p>
              <div className='flex flex-col gap-px'>
                {section.links.map((item) => (
                  <SidebarLink key={item.key} item={item} onClose={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className='flex flex-col gap-px pt-3 mt-4 border-t border-rule'>
          {DASHBOARD_SIDEBAR_BOTTOM_LINKS.map(item => (
            <SidebarLink key={item.key} item={item} onClose={onClose}/>
          ))}
          <button
            type='button'
            className={classNames('w-full text-left text-ink-2 hover:text-s5 hover:bg-paper', linkClass)}
            onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

function SidebarLink({ item, onClose }) {
  const { pathname } = useLocation()
  const isExternal = item.path.startsWith('http') || item.path.includes('/swagger/')
  const isActive = !isExternal && (pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(`${item.path}/`)))
  const classes = classNames(
    isActive
      ? 'bg-paper text-ink font-semibold ring-1 ring-rule shadow-[0_1px_2px_rgb(20_23_28/0.06)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-accent'
      : 'text-ink-2 hover:text-ink hover:bg-paper/70',
    linkClass
  )
  if (isExternal) {
    return (
      <a href={item.path} className={classes} target='_blank' rel='noreferrer'>
        {item.label}
      </a>
    )
  }

  return (
    <Link to={item.path} className={classes} onClick={onClose} aria-current={isActive ? 'page' : undefined}>
      {item.label}
    </Link>
  )
}
