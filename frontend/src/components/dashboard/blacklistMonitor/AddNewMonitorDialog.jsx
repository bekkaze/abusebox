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
            <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-xl border border-slate-200">
              <Dialog.Title
                as="h3"
                className="text-xl font-semibold leading-6 text-slate-900"
              >
                Add New Monitor
              </Dialog.Title>

              <div className="mt-2">
                <form>
                  {/* Form fields */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Hostname
                    </label>
                    <input
                      type="text"
                      name="hostname"
                      value={formData.hostname}
                      onChange={handleInputChange}
                      required
                      className="mt-1 p-2.5 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Hostname Type
                    </label>
                    <select
                      name="hostname_type"
                      value={formData.hostname_type}
                      onChange={handleInputChange}
                      required
                      className="mt-1 p-2.5 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    >
                      <option value="">Select Hostname Type</option>
                      <option value="domain">Domain</option>
                      <option value="ipv4">IPv4</option>
                    </select>
                  </div>


                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Description
                    </label>
                    <input
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="mt-1 p-2.5 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_alert_enabled"
                        checked={formData.is_alert_enabled}
                        onChange={handleInputChange}
                        className="mr-2 rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">
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
                        className="mr-2 rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Is Monitor Enabled
                      </span>
                    </label>
                  </div>

                  {/* Submit button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      className="bg-slate-100 text-slate-700 py-2 px-4 rounded-lg mr-2 hover:bg-slate-200 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded-lg transition-colors"
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
