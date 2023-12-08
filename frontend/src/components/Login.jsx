import React, { useState } from 'react';
import axios from 'axios';
import loginImg from '../assets/login.jpg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [detail, setDetail] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
 
    try {
      const response = await axios.post('http://localhost:8000/v1/login/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'accept': 'application/json',
        }
      });
 
      document.cookie = `access_token=Bearer ${response.data.access_token}; path=/`;
      window.location.href = '/dashboard';
    } catch (error) {
      setDetail(error.response.data.detail);
    }
  };

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 h-screen w-full'>
      <div className='hidden sm:block'>
        <img className='w-full h-full object-cover' src={loginImg} alt=''/>
      </div>

      <div className='bg-gray-800 flex flex-col justify-center'>
        <form className='max-w-[400px] w-full mx-auto bg-gray-900 p-8 px-8 rounded-lg' onSubmit={handleLogin}>
          <h2 className='text-4xl dark:text-white font-bold text-center'>Sign in</h2>
          <div className='flex flex-col text-gray-400 py-2'>
            <label>User Name</label>
            <input className='rounded-lg bg-gray-700 mt-2 p-2 focus:border-blue-500 focus:bg-gray-800 focus:outline-none' type='text' value={username} onChange={(e) => setUsername(e.target.value)}/>
          </div>
          <div className='flex flex-col text-gray-400 py-2'>
            <label>Password</label>
            <input className='rounded-lg bg-gray-700 mt-2 p-2 focus:border-blue-500 focus:bg-gray-800 focus:outline-none' type="password" value={password} onChange={(e) => setPassword(e.target.value)}/>
          </div>
          <div className='flex justify-between text-gray-400 py-2'>
            <p className='flex items-center'><input className='mr-2' type="checkbox" /> Remember Me</p>
            <p>Forgot Password</p>
          </div>
          <button className='w-full my-5 py-2 bg-teal-500 shadow-lg shadow-teal-500/10 hover:shadow-teal-500/40 text-white font-semibold rounded-lg'>Sign in</button>
          <p className='text-red-600'>{detail}</p>
        </form>
      </div>
    </div>
  ) 
}