import { MdCheckBox, MdCheckBoxOutlineBlank, } from "react-icons/md";
import { RiListSettingsLine } from "react-icons/ri";
import { HiEye, HiTrash, HiPencilAlt } from "react-icons/hi";
import { Transition, Menu } from "@headlessui/react";

export default function HostnameTable({ hostnameListData, handleView, handleDelete }) {
  return (
    <table className="w-full text-gray-700 border-collapse">
      <thead>
        <tr className="text-left border-b border-gray-300">
          <th className="p-2">Hostname</th>
          <th className="p-2">Type</th>
          <th className="p-2">Report</th>
          <th className="p-2">Checked</th>
          <th className="p-2">Created</th>
          <th className="p-2">Monitor</th>
          <th className="p-2">Alert</th>
          <th className="p-2">Status</th>
          <th className="p-2">Action</th>
        </tr>
      </thead>
      <tbody>
        {hostnameListData.map((hostnameData) => (
          <tr key={hostnameData.id} className="border-b border-gray-300">
            <td className="p-2">{hostnameData.hostname}</td>
            <td className="p-2">{hostnameData.hostname_type}</td>
            <td className={`p-2 ${hostnameData.result ? (hostnameData.result.is_blacklisted === false ? 'text-green-500' : 'text-red-500') : 'text-black'}`}>
            <div>
              {!hostnameData.result ? <p>Not checked</p> : <p>Detected by: {hostnameData.result.detected_on.length} of {hostnameData.result.providers.length}</p>}
            </div>
            </td>
            <td className="p-2">{hostnameData.checked}</td>
            <td className="p-2">{hostnameData.created}</td>
            <td className="p-2">
              {hostnameData.is_alert_enabled ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
            </td>
            <td className="p-2">
              {hostnameData.is_monitor_enabled ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
            </td>
            <td className={`p-2 ${hostnameData.status === 'active' ? 'text-green-500' : 'text-red-500'}`}>
              {hostnameData.status}
            </td>
            <td className="p-2">
                <Menu>
                  {({ open }) => (
                    <>
                      <Menu.Button className="text-gray-700 cursor-pointer">
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
                          className="origin-top-right absolute right-0 mt-2 w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
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
                                  <div className="flex items-center"><HiEye className="mr-2" />Report</div>
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                            {({ active }) => (
                                <button
                                  onClick={() => {
                                    /* handleEdit(hostnameData.id); */
                                  }}
                                  className={`${
                                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                                  } w-full text-left py-2 px-4 text-sm`}
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
  )
}