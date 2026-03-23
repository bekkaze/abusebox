import React, { useState } from 'react';
import { AiOutlineClose, AiOutlineMenu } from 'react-icons/ai';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';

const itemClass = 'px-4 py-2 rounded-lg text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors';

const Navbar = () => {
  const { token } = useAuth();
  const [nav, setNav] = useState(false);
  const navigate = useNavigate();

  const go = (path) => {
    setNav(false);
    navigate(path);
  };

  return (
    <header className='sticky top-0 z-20 backdrop-blur-md bg-slate-950/60 border-b border-white/10'>
      <div className='max-w-6xl mx-auto px-4 h-20 flex justify-between items-center text-white'>
        <button className='flex items-center gap-3' onClick={() => go('/')}>
          <img src="/logo.png" alt="AbuseBox" className='h-9 w-9 rounded-xl object-cover' />
          <div className='text-left'>
            <p className='text-base font-semibold'>AbuseBox</p>
            <p className='text-xs text-slate-400'>Threat Monitoring</p>
          </div>
        </button>

        <nav className='hidden md:flex items-center gap-2'>
          <button className={itemClass} onClick={() => go('/')}>Home</button>
          <button className={itemClass} onClick={() => go('/quick-check')}>Quick Check</button>
          {!token ? (
            <button
              className='px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:opacity-90 transition-opacity'
              onClick={() => go('/login')}
            >
              Sign in
            </button>
          ) : (
            <button
              className='px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:opacity-90 transition-opacity'
              onClick={() => go('/dashboard')}
            >
              Open Dashboard
            </button>
          )}
        </nav>

        <button onClick={() => setNav((prev) => !prev)} className='md:hidden text-slate-200'>
          {nav ? <AiOutlineClose size={22} /> : <AiOutlineMenu size={22} />}
        </button>
      </div>

      {nav ? (
        <div className='md:hidden border-t border-white/10 px-4 py-3 bg-slate-950/95'>
          <div className='flex flex-col gap-2'>
            <button className={itemClass} onClick={() => go('/')}>Home</button>
            <button className={itemClass} onClick={() => go('/quick-check')}>Quick Check</button>
            {!token ? (
              <button className='px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-400 text-slate-950' onClick={() => go('/login')}>
                Sign in
              </button>
            ) : (
              <button className='px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-400 text-slate-950' onClick={() => go('/dashboard')}>
                Open Dashboard
              </button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
