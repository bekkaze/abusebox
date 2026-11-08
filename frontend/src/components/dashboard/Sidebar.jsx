import { useCallback, useEffect, useMemo, useState } from 'react'
import { DASHBOARD_SIDEBAR_BOTTOM_LINKS, DASHBOARD_SIDEBAR_SECTIONS } from './constants'
import { Link, useLocation } from 'react-router-dom'
import { HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight, HiXMark } from 'react-icons/hi2'
import classNames from 'classnames'
import ToolsMenu from './ToolsMenu'

const linkClass =
  'relative flex items-center h-8 gap-2.5 rounded-md text-sm transition-colors hover:no-underline'

const RAIL_KEY = 'abusebox.sidebar.collapsed'

/** A preference that survives a reload, and shrugs if storage is unavailable. */
function useStoredFlag(key, fallback) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(key) === '1'; } catch { return fallback; }
  });
  const update = useCallback((next) => {
    setValue(next);
    try { localStorage.setItem(key, next ? '1' : '0'); } catch { /* storage unavailable */ }
  }, [key]);
  return [value, update];
}

export default function Sidebar({ open, onClose }) {
  const { pathname } = useLocation();
  const [railed, setRailed] = useStoredFlag(RAIL_KEY, false);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The drawer is always full width on mobile: a rail you cannot hover is no use
  // on a touch screen, and the icons alone would be the only label.
  const collapsed = railed && !open;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-scrim/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside aria-label='Main navigation' className={classNames(
        'bg-canvas px-3 pb-3 flex flex-col border-r border-rule/70 overflow-y-auto overflow-x-hidden',
        'fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:flex-shrink-0',
        'transition-[transform,width] duration-200 ease-out',
        collapsed ? 'w-60 lg:w-[4.25rem]' : 'w-60',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className='flex items-center justify-between h-14 px-1.5'>
          <Link
            to='/dashboard'
            onClick={onClose}
            className='flex items-center gap-2.5 hover:no-underline min-w-0'
            title={collapsed ? 'AbuseBox' : undefined}
            // Collapsed there is no text and the logo is decorative, so the link
            // would otherwise fall back to its title for an accessible name.
            aria-label={collapsed ? 'AbuseBox, go to dashboard' : undefined}
          >
            <img src="/logo.png" alt="" className='h-7 w-7 flex-shrink-0 rounded-md object-cover' />
            {!collapsed && <span className='text-[15px] font-semibold tracking-tight text-ink truncate'>AbuseBox</span>}
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
            <Section key={section.label} section={section} collapsed={collapsed} pathname={pathname} onClose={onClose} />
          ))}
        </nav>

        <div className='flex flex-col gap-px pt-3 mt-4 border-t border-rule'>
          {DASHBOARD_SIDEBAR_BOTTOM_LINKS.map(item => (
            <SidebarLink key={item.key} item={item} collapsed={collapsed} onClose={onClose} />
          ))}
          <button
            type='button'
            onClick={() => setRailed(!railed)}
            className={classNames('hidden lg:flex w-full text-ink-2 hover:text-ink hover:bg-paper/70 px-2.5', linkClass)}
            aria-label={railed ? 'Expand navigation' : 'Collapse navigation'}
            title={railed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <span className='flex w-[18px] flex-shrink-0 justify-center text-[17px]' aria-hidden='true'>
              {railed ? <HiOutlineChevronDoubleRight /> : <HiOutlineChevronDoubleLeft />}
            </span>
            {!collapsed && <span className='truncate'>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

function Section({ section, collapsed, pathname, onClose }) {
  const overflow = useMemo(
    () => (section.collapsible ? section.links.filter((item) => !item.primary) : []),
    [section]
  );
  // The page you are on always has an entry in the nav, even when it lives in
  // the flyout. Otherwise nothing looks selected and the page reads as
  // orphaned; the flyout still lists it, marked as current.
  const activeOverflowItem = overflow.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
  const pinned = section.collapsible
    ? section.links.filter((item) => item.primary || item === activeOverflowItem)
    : section.links;

  return (
    <div>
      {!collapsed && (
        <p className='px-2.5 mb-1 text-xs font-medium text-ink-2'>{section.label}</p>
      )}
      <div className='flex flex-col gap-px'>
        {pinned.map((item) => (
          <SidebarLink key={item.key} item={item} collapsed={collapsed} onClose={onClose} />
        ))}
        {section.collapsible && (
          <ToolsMenu
            items={overflow}
            collapsed={collapsed}
            label={`More tools (${overflow.length})`}
            onNavigate={onClose}
          />
        )}
      </div>
    </div>
  )
}

function SidebarLink({ item, collapsed, onClose }) {
  const { pathname } = useLocation()
  const isExternal = item.path.startsWith('http') || item.path.includes('/swagger/')
  const isActive = !isExternal && (pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(`${item.path}/`)))
  const classes = classNames(
    isActive
      ? 'bg-paper text-ink font-semibold ring-1 ring-rule shadow-[0_1px_2px_rgb(20_23_28/0.06)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-accent'
      : 'text-ink-2 hover:text-ink hover:bg-paper/70',
    collapsed ? 'justify-center px-0' : 'px-2.5',
    linkClass
  )
  const body = (
    <>
      {item.icon && (
        <span className='flex w-[18px] flex-shrink-0 justify-center text-[17px]' aria-hidden='true'>{item.icon}</span>
      )}
      {!collapsed && <span className='truncate'>{item.label}</span>}
    </>
  )
  // Collapsed to a rail there is no label to read, so the name goes in a tooltip
  // for sighted users and stays available to a screen reader.
  const title = collapsed ? item.label : undefined
  const label = collapsed ? item.label : undefined

  if (isExternal) {
    return (
      <a href={item.path} className={classes} target='_blank' rel='noreferrer' title={title} aria-label={label}>
        {body}
      </a>
    )
  }

  return (
    <Link
      to={item.path}
      className={classes}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      title={title}
      aria-label={label}
    >
      {body}
    </Link>
  )
}
