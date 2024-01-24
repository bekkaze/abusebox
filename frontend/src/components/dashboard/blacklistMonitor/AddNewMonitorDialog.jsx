import React from "react";
import { Dialog, Transition } from "@headlessui/react";

export default function AddNewMonitorDialog({ formData, handleInputChange, handleSubmit, isOpen, setIsOpen }) {
  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-10 overflow-y-auto"
        onClose={() => setIsOpen(false)}
      >
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
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-md rounded-md">
              <Dialog.Title
                as="h3"
                className="text-lg font-medium leading-6 text-gray-900"
              >
                Add New Monitor
              </Dialog.Title>

              <div className="mt-2">
                <form>
                  {/* Form fields */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Hostname
                    </label>
                    <input
                      type="text"
                      name="hostname"
                      value={formData.hostname}
                      onChange={handleInputChange}
                      className="mt-1 p-2 w-full border rounded-md"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Hostname Type
                    </label>
                    <select
                      name="hostname_type"
                      value={formData.hostname_type}
                      onChange={handleInputChange}
                      className="mt-1 p-2 w-full border rounded-md"
                    >
                      <option value="">Select Hostname Type</option>
                      <option value="domain">Domain</option>
                      <option value="ipv4">IPv4</option>
                    </select>
                  </div>


                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <input
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="mt-1 p-2 w-full border rounded-md"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_alert_enabled"
                        checked={formData.is_alert_enabled}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Is Alert Enabled
                      </span>
                    </label>
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_monitor_enabled"
                        checked={formData.is_monitor_enabled}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Is Monitor Enabled
                      </span>
                    </label>
                  </div>

                  {/* Submit button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      className="bg-blue-500 text-white py-2 px-4 rounded"
                      onClick={handleSubmit}
                    >
                      Submit
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}