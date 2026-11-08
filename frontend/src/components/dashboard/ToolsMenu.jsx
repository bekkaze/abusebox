import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Portal, Transition } from '@headlessui/react'
import { HiChevronRight, HiOutlineEllipsisHorizontal } from 'react-icons/hi2'
import classNames from 'classnames'

const PANEL_WIDTH = 224
const GUTTER = 8

/**
 * Where the flyout goes, measured from the button rather than positioned with
 * CSS, because the sidebar scrolls its own content: a panel inside it would be
 * clipped by `overflow-y-auto`. So it renders in a portal at the document root
 * and is given fixed coordinates.
 */
function useAnchoredPanel(buttonRef, open) {
  const [style, setStyle] = useState(null);

  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    // Anchored to the nav's edge, not the button's. The button sits inside the
    // sidebar's padding, so anchoring to it puts the panel a few pixels over
    // the sidebar's own border instead of clear of it.
    const nav = button.closest('aside');
    const edge = nav ? nav.getBoundingClientRect().right : rect.right;
    const left = Math.min(edge + GUTTER, window.innerWidth - PANEL_WIDTH - GUTTER);
    // Opened near the bottom of the window it would run off the end, so it
    // grows upwards from the button instead.
    const spaceBelow = window.innerHeight - rect.top;
    const fromBottom = spaceBelow < 360;
    setStyle({
      position: 'fixed',
      left: Math.max(GUTTER, left),
      width: PANEL_WIDTH,
      ...(fromBottom
        ? { bottom: Math.max(GUTTER, window.innerHeight - rect.bottom) }
        : { top: Math.max(GUTTER, rect.top) }),
    });
  }, [buttonRef]);

  useEffect(() => {
    if (!open) return undefined;
    place();
    // Scrolling the sidebar or the page moves the button, so follow it.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  return style;
}

/**
 * The tools that are not pinned to the sidebar, in a flyout.
 *
 * A dropdown rather than an inline expansion so the nav keeps its height, and
 * so it works the same whether the sidebar is full width or collapsed to a rail
 * where there are no labels to expand.
 */
export default function ToolsMenu({ items, collapsed, label = 'More tools', onNavigate }) {
  const { pathname } = useLocation();
  const buttonRef = useRef(null);

  if (items.length === 0) return null;

  return (
    <Menu as='div'>
      {({ open }) => (
        <ToolsMenuBody
          open={open}
          items={items}
          collapsed={collapsed}
          label={label}
          pathname={pathname}
          buttonRef={buttonRef}
          onNavigate={onNavigate}
        />
      )}
    </Menu>
  )
}

function ToolsMenuBody({ open, items, collapsed, label, pathname, buttonRef, onNavigate }) {
  const style = useAnchoredPanel(buttonRef, open);

  return (
    <>
      <Menu.Button
        ref={buttonRef}
        className={classNames(
          'relative flex h-8 w-full items-center gap-2.5 rounded-md text-sm transition-colors',
          collapsed ? 'justify-center px-0' : 'px-2.5',
          open ? 'bg-paper text-ink' : 'text-ink-2 hover:text-ink hover:bg-paper/70'
        )}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
      >
        <span className='flex w-[18px] flex-shrink-0 justify-center text-[17px]' aria-hidden='true'>
          <HiOutlineEllipsisHorizontal />
        </span>
        {!collapsed && (
          <>
            <span className='truncate'>{label}</span>
            <HiChevronRight className='ml-auto flex-shrink-0 text-base' aria-hidden='true' />
          </>
        )}
      </Menu.Button>

      <Portal>
        <Transition
          show={open}
          enter='transition ease-out duration-100'
          enterFrom='opacity-0 scale-95'
          enterTo='opacity-100 scale-100'
          leave='transition ease-in duration-75'
          leaveFrom='opacity-100 scale-100'
          leaveTo='opacity-0 scale-95'
        >
          <Menu.Items
            static
            style={style || { position: 'fixed', left: -9999, top: 0, width: PANEL_WIDTH }}
            className='z-[60] max-h-[70vh] origin-top-left overflow-y-auto rounded-lg border border-rule bg-paper p-1 shadow-e2 focus:outline-none'
          >
            {items.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Menu.Item key={item.key}>
                  {({ active }) => (
                    <Link
                      to={item.path}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={classNames(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm hover:no-underline',
                        isActive ? 'font-semibold text-ink' : 'text-ink-2',
                        active && 'bg-sunk text-ink'
                      )}
                    >
                      {item.icon && (
                        <span className='flex w-[18px] flex-shrink-0 justify-center text-[17px]' aria-hidden='true'>
                          {item.icon}
                        </span>
                      )}
                      <span className='truncate'>{item.label}</span>
                    </Link>
                  )}
                </Menu.Item>
              );
            })}
          </Menu.Items>
        </Transition>
      </Portal>
    </>
  )
}
