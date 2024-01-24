import React from 'react';
import { Dialog, Transition } from '@headlessui/react';

function ViewReport({ hostnameData, isOpen, setIsOpen }) {
  const tableContainerStyle = {
    maxHeight: '80vh',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    overflowY: 'auto',
  };

  const providers = [...hostnameData.result.providers].sort((a, b) => {
    const isBlacklistedA = hostnameData.result.detected_on.some((item) => item.provider === a);
    const isBlacklistedB = hostnameData.result.detected_on.some((item) => item.provider === b);

    return isBlacklistedB - isBlacklistedA;
  });

  const isBlacklisted = (provider) => {
    return hostnameData.result.detected_on.some((item) => item.provider === provider);
  };

  return (
    <Transition
      show={isOpen}
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
      >
      <Dialog as="div" className="fixed inset-0 z-10 overflow-y-auto" onClose={() => setIsOpen(false)}>
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
            </Transition.Child>

            <span
              className="inline-block h-screen align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-4"
            >
              <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-md rounded-md" style={{ maxHeight: "600vh" }}>
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Blacklist Report of hostname : {hostnameData.hostname}
                </Dialog.Title>

                <div style={tableContainerStyle} className="overflow-y-auto">
                  <table className="table-auto w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-2">Provider</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                    {providers.map((provider, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">{provider}</td>
                        <td className={`px-4 py-2 ${isBlacklisted(provider) ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                          {isBlacklisted(provider) ? 'Blacklisted' : 'Clear'}
                        </td>
                        <td className="px-4 py-2">
                        {isBlacklisted(provider) ? <button className="bg-[#EF4444] hover:bg-[#ff7676] text-white font-bold py-0.5 px-4 rounded">
                            Delist
                          </button> : ''}
                        </td> 
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                  type="button"
                  className="bg-blue-500 text-white py-2 px-4 rounded"
                  onClick={() => setIsOpen(false)}
                  >
                  Close
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
      </Dialog>
    </Transition> 
  )
}

export default ViewReport;
