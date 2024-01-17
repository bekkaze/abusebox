import React, { useState } from 'react';
import Typed from 'react-typed';
import { useNavigate } from 'react-router-dom';
import { checkBlacklist } from '../../services/blacklist';

const Hero = () => {

  const navigate = useNavigate();
  const [hostname, setHostname] = useState('');
 
  const handleCheck = async () => {
    try {
      console.log('call');
      navigate('/quick-check', { state: { hostname: hostname } });
    } catch (error) {
      console.error('Failed to navigate to guestCheck:', error);
    }
  };
   
   
  return (
    <div className='text-white'>
      <div className='max-w-[800px] mt-[-96px] w-full h-screen mx-auto text-center flex flex-col justify-center'>
        <p className='text-[#00df9a] font-bold p-2'>
          Blacklist Monitor and check
        </p>
        <h1 className='md:text-7xl sm:text-6xl text-4xl font-bold md:py-6'>
          Keep it clean from...
        </h1>
        <div className='flex justify-center items-center'>
          <p className='md:text-5xl sm:text-4xl text-xl font-bold py-4'>
            
          </p>
          <Typed
          className='md:text-5xl sm:text-4xl text-xl font-bold md:pl-4 pl-2'
            strings={['malicious activity', 'spam', 'botnet']}
            typeSpeed={120}
            backSpeed={140}
            loop
          />
        </div>
{/*         <p className='md:text-2xl text-xl font-bold text-gray-500'>Keep it clean from malicious activity </p> */}
        <div className='my-4'>
          <div className='flex flex-col sm:flex-row items-center justify-between w-full'>
          <input
            className='p-3 flex w-full rounded-md text-black'
            type='text'
            placeholder='example.com or IP address...'
            onChange={(e) => setHostname(e.target.value)}
          />
          <button 
            className='bg-[#EF4444] text-white rounded-md font-medium w-[200px] ml-4 my-6 px-6 py-3'
            onClick={handleCheck}
            >
            Blacklist check
          </button>
          </div>
        </div>
{/*         <button className='bg-[#00df9a] w-[200px] rounded-md font-medium my-6 mx-auto py-3 text-black'>Get Started</button> */}
      </div>
    </div>
  );
};

export default Hero;