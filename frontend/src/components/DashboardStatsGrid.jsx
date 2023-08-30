import React from 'react';
import { HiChartBar } from 'react-icons/hi';
import { TbNetwork, TbNetworkOff } from 'react-icons/tb'
import { BiNetworkChart } from 'react-icons/bi'

function DashboardStatsGrid() {
  return (
    <div className="flex gap-4 w-full">
      <BoxWrapper>
        <div className='rounded-full h-12 w-12 flex items-center justify-center bg-sky-500'>
          <HiChartBar className='text-2xl text-white'/>
        </div>
        <div className='pl-4'>
          <span className='text-sm text-gray-500 font-light'>Total IP Addresses</span>
          <div className='flex items-center'>
            <strong className='text-xl text-gray-700 font-semibold'>157000</strong>
          </div>
        </div>
      </BoxWrapper>
      <BoxWrapper>
        <div className='rounded-full h-12 w-12 flex items-center justify-center bg-green-500'>
          <TbNetwork className='text-2xl text-white'/>
        </div>
        <div className='pl-4'>
          <span className='text-sm text-gray-500 font-light'>Not blacklisted IP Addresses</span>
          <div className='flex items-center'>
            <strong className='text-xl text-gray-700 font-semibold'>100000</strong>
          </div>
        </div>
      </BoxWrapper>
      
      <BoxWrapper>
        <div className='rounded-full h-12 w-12 flex items-center justify-center bg-red-500'>
          <TbNetworkOff className='text-2xl text-white'/>
        </div>
        <div className='pl-4'>
          <span className='text-sm text-gray-500 font-light'>Blacklisted IP Addresses</span>
          <div className='flex items-center'>
            <strong className='text-xl text-gray-700 font-semibold'>57000</strong>
          </div>
        </div>
      </BoxWrapper>
    </div>
  )
}

export default DashboardStatsGrid;

function BoxWrapper({children}) {
  return <div className="bg-white rounded-sm p-4 flex-1 border border-gray-200 flex items-center">{children}</div>
}