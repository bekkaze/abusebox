import React, { useState, useEffect } from "react";
import { HiOutlinePlusCircle, HiEye, HiTrash, HiPencilAlt } from "react-icons/hi";
import { Dialog, Transition, Menu } from "@headlessui/react";
import HostnameService from "../../services/hostname";
import { MdCheckBox, MdCheckBoxOutlineBlank, } from "react-icons/md";
import { RiListSettingsLine } from "react-icons/ri";


export default function BlacklistMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    hostname_type: "",
    hostname: "",
    description: "",
    is_alert_enabled: false,
    is_monitor_enabled: false,
  });
  const hostnameService = HostnameService();
  const [hostnameListData, setHostnameListData] = useState([]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async () => {
    try {
      console.log(formData);
      const result = await hostnameService.createHostname(formData);
      fetchHostnameList();
    } catch (error) {
      console.error("Failed to create hostname. Please try again:", error);
    }

    setIsOpen(false);
  };

  const fetchHostnameList = async () => {
    try {
      const listData = await hostnameService.listHostname();
      setHostnameListData(listData);
    } catch (error) {
      console.error("Failed to retrieve hostname list:", error);
    }
  };

  useEffect(() => {
    fetchHostnameList();
  }, []);

  const handleView = (id) => {
    console.log(`View clicked for ID: ${id}`);
  }

  const handleDelete = async (id) => {
    try {
      const result = await hostnameService.deleteHostname(id);
      fetchHostnameList();
    } catch (error) {
      console.error("Failed to delete hostname. Please try again:", error);
    }

    setIsOpen(false);
  }

  return (
    <div className="bg-white px-4 pt-3 pb-4 rounded-sm border border-gray-200 flex-1">
      <div className='bg-white h-16 px-4 flex items-center border-b border-color-gray-200'>
        <strong className="text-gray-700 font-medium">Blacklist Monitors</strong>
        <div className="ml-auto">
          <button
            className="bg-blue-500 text-white py-2 px-4 flex items-center rounded"
            onClick={() => setIsOpen(true)}
          >
            <HiOutlinePlusCircle className="mr-2" /> Add New
          </button>
        </div>
      </div>

      <div className="border-x border-gray-200 rounded-sm mt-3">
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
              <td className="p-2"></td>
              <td className="p-2"></td>
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
                                      handleView(hostnameData.id);
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
      </div>
    </div>
  );
}
