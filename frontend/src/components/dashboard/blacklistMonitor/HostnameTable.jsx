import React, { memo } from "react";
import { MdCheckBox, MdCheckBoxOutlineBlank } from "react-icons/md";
import { RiListSettingsLine } from "react-icons/ri";
import { HiEye, HiTrash, HiPencilAlt } from "react-icons/hi";
import { Transition, Menu } from "@headlessui/react";

const CHECK_BADGES = [
  { key: "check_blacklist", label: "BL" },
  { key: "check_abuseipdb", label: "ABUSE" },
  { key: "check_dns", label: "DNS" },
  { key: "check_ssl", label: "SSL" },
  { key: "check_whois", label: "WHOIS" },
  { key: "check_email_security", label: "DMARC" },
  { key: "check_server_status", label: "UP" },
];

const formatDateTime = (value) => {
  if (!value || value === "Not checked") return "Not checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

function HostnameTable({ hostnameListData, handleView, handleDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-slate-700 dark:text-slate-300 border-collapse">
        <thead className="bg-slate-50 dark:bg-slate-700">
          <tr className="text-left border-b border-slate-200 dark:border-slate-600">
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Hostname</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Type</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Checks</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Report</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Checked</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Monitor</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Alert</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
            <th className="p-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Action</th>
          </tr>
        </thead>
        <tbody>
          {hostnameListData.map((hostnameData) => (
            <tr key={hostnameData.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
              <td className="p-3">
                <p className="font-medium text-slate-900 dark:text-white">{hostnameData.hostname}</p>
                {hostnameData.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{hostnameData.description}</p>
                )}
              </td>
              <td className="p-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-600 px-2.5 py-1 text-xs font-medium">{hostnameData.hostname_type}</span>
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1">
                  {CHECK_BADGES.filter(b => hostnameData[b.key]).map(b => (
                    <span key={b.key} className="inline-flex rounded bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 text-[10px] font-bold">
                      {b.label}
                    </span>
                  ))}
                </div>
              </td>
              <td className={`p-3 ${hostnameData.result ? (hostnameData.is_blacklisted ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-500'}`}>
                <div className="text-sm">
                  {!hostnameData.result ? (
                    <p>Not checked</p>
                  ) : hostnameData.result.blacklist ? (
                    <p>Detected: {hostnameData.result.blacklist.detected_on?.length ?? 0} / {hostnameData.result.blacklist.providers?.length ?? 0}</p>
                  ) : hostnameData.result.detected_on ? (
                    <p>Detected: {hostnameData.result.detected_on?.length ?? 0} / {hostnameData.result.providers?.length ?? 0}</p>
                  ) : (
                    <p>Checked</p>
                  )}
                </div>
              </td>
              <td className="p-3 text-sm">{formatDateTime(hostnameData.checked)}</td>
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
                      <Menu.Button className="text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-white">
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
                          className="origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-white dark:bg-slate-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                        >
                          <div className="py-1">
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleView(hostnameData)}
                                  className={`${active ? 'bg-gray-100 dark:bg-slate-600' : ''} text-gray-700 dark:text-slate-200 w-full text-left py-2 px-4 text-sm`}
                                >
                                  <div className="flex items-center"><HiEye className="mr-2" />View Report</div>
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  disabled
                                  className="text-gray-700 dark:text-slate-200 w-full text-left py-2 px-4 text-sm cursor-not-allowed opacity-60"
                                >
                                  <div className="flex items-center"><HiPencilAlt className="mr-2" />Edit</div>
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleDelete(hostnameData.id)}
                                  className={`${active ? 'bg-gray-100 dark:bg-slate-600' : ''} text-gray-700 dark:text-slate-200 w-full text-left py-2 px-4 text-sm`}
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
  );
}

export default memo(HostnameTable);
