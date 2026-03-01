import React, { memo } from "react";
import { MdCheckBox, MdCheckBoxOutlineBlank, } from "react-icons/md";
import { RiListSettingsLine } from "react-icons/ri";
import { HiEye, HiTrash, HiPencilAlt } from "react-icons/hi";
import { Transition, Menu } from "@headlessui/react";

const formatDateTime = (value) => {
  if (!value || value === "Not checked") {
    return "Not checked";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

function HostnameTable({ hostnameListData, handleView, handleDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-slate-700 border-collapse">
        <thead className="bg-slate-50">
          <tr className="text-left border-b border-slate-200">
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Hostname</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Description</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Type</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Report</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Checked</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Created</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Monitor</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Alert</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Status</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500">Action</th>
          </tr>
        </thead>
        <tbody>
          {hostnameListData.map((hostnameData) => (
            <tr key={hostnameData.id} className="border-b border-slate-200 hover:bg-slate-50/60">
              <td className="p-3 font-medium text-slate-900">{hostnameData.hostname}</td>
              <td className="p-3">{hostnameData.description || "-"}</td>
              <td className="p-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{hostnameData.hostname_type}</span>
              </td>
              <td className={`p-3 ${hostnameData.result ? (hostnameData.result.is_blacklisted === false ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-500'}`}>
            <div>
              {!hostnameData.result ? <p>Not checked</p> : <p>Detected by: {hostnameData.result.detected_on.length} of {hostnameData.result.providers.length}</p>}
            </div>
              </td>
              <td className="p-3 text-sm">{formatDateTime(hostnameData.checked)}</td>
              <td className="p-3 text-sm">{formatDateTime(hostnameData.created)}</td>
              <td className="p-3 text-lg">
                {hostnameData.is_monitor_enabled ? <MdCheckBox className="text-emerald-600" /> : <MdCheckBoxOutlineBlank className="text-slate-400" />}
              </td>
              <td className="p-3 text-lg">
                {hostnameData.is_alert_enabled ? <MdCheckBox className="text-emerald-600" /> : <MdCheckBoxOutlineBlank className="text-slate-400" />}
              </td>
              <td className="p-3">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${hostnameData.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {hostnameData.status}
                </span>
              </td>
              <td className="p-3 relative">
                <Menu>
                  {({ open }) => (
                    <>
                      <Menu.Button className="text-slate-700 cursor-pointer hover:text-slate-900">
                        <RiListSettingsLine />
                      </Menu.Button>
                      <Transition
                        show={open}
                        enter="transition-opacity duration-75"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="transition-opacity duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Menu.Items
                          static
                          className="origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                        >
                          <div className="py-1">
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => {
                                    handleView(hostnameData);
                                  }}
                                  className={`${
                                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                  } w-full text-left py-2 px-4 text-sm`}
                                >
                                  <div className="flex items-center"><HiEye className="mr-2" />View Report</div>
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                            {({ active }) => (
                                <button
                                  disabled
                                  className={`${
                                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                  } w-full text-left py-2 px-4 text-sm cursor-not-allowed opacity-60`}
                                >
                                  <div className="flex items-center"><HiPencilAlt className="mr-2" />Edit</div>
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => {
                                    handleDelete(hostnameData.id);
                                  }}
                                  className={`${
                                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                  } w-full text-left py-2 px-4 text-sm`}
                                >
                                  <div className="flex items-center"><HiTrash className="mr-2" />Delete</div>
                                </button>
                              )}
                            </Menu.Item>
                          </div>
                        </Menu.Items>
                      </Transition>
                    </>
                  )}
                </Menu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default memo(HostnameTable);
