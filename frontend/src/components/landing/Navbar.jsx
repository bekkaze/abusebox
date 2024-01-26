import React, { useState } from 'react';
import { AiOutlineClose, AiOutlineMenu } from 'react-icons/ai';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/authProvider';

const Navbar = () => {
  const { token } = useAuth();
  const [nav, setNav] = useState(false);
  const navigate = useNavigate();

  const handleNav = () => {
    setNav(!nav);
  };

  return (
    <div className='flex justify-between items-center h-24 max-w-[1240px] mx-auto px-4 text-white'>
      <h1 className='w-full text-3xl font-bold text-[#00df9a]'>AbuseBox</h1>
      <ul className='hidden md:flex'>
        <li className='p-4 hover:bg-[#00df9a] cursor-pointer rounded-md'>Home</li>
        <li className='p-4 hover:bg-[#00df9a] cursor-pointer rounded-md'>Features</li>
        {!token ? (
            <>
              <li className='p-4 hover:bg-[#00df9a] cursor-pointer rounded-md' onClick={() => navigate('/login')}>Signin</li>
              <li className='p-4 hover:bg-[#00df9a] cursor-pointer rounded-md' onClick={() => navigate('/signup')}>Signup</li>
            </>
        ) : (
            <li className='p-4 hover:bg-[#00df9a] cursor-pointer rounded-md' onClick={() => navigate('/dashboard')}>Dashboard</li>
        )}
        </ul>
      <div onClick={handleNav} className='block md:hidden'>
          {nav ? <AiOutlineClose size={20}/> : <AiOutlineMenu size={20} />}
      </div>
      <ul className={nav ? 'fixed left-0 top-0 w-[60%] h-full border-r border-r-gray-900 bg-[#000300] ease-in-out duration-500' : 'ease-in-out duration-500 fixed left-[-100%]'}>
        <h1 className='w-full text-3xl font-bold text-[#00df9a] m-4'>AbuseBox</h1>
          <li className='p-4 hover:bg-[#00df9a] border-b border-gray-600 cursor-pointer rounded-md'>Home</li>
          <li className='p-4 hover:bg-[#00df9a] border-b border-gray-600 cursor-pointer rounded-md'>Features</li>
          <li className='p-4 hover:bg-[#00df9a] border-b border-gray-600 cursor-pointer rounded-md' onClick={() => navigate('/login')}>Sign in</li>
          <li className='p-4 hover:bg-[#00df9a] border-b border-gray-600 cursor-pointer rounded-md' onClick={() => navigate('/signup')}>Signup</li>
      </ul>
    </div>
  );
};

export default Navbar;
