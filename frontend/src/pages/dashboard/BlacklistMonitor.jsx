import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlusCircle } from 'react-icons/hi'
import HostnameService from "../../services/hostname";
import HostnameTable from "../../components/dashboard/blacklistMonitor/HostnameTable";
import AddNewMonitorDialog from "../../components/dashboard/blacklistMonitor/AddNewMonitorDialog";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function BlacklistMonitor() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

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
      const result = await hostnameService.createHostname(formData);
      if (result.status === 'active') {
        toast.success("Successfully added hostname");
        setFormData({
          hostname_type: "",
          hostname: "",
          description: "",
          is_alert_enabled: false,
          is_monitor_enabled: false,
        });
        fetchHostnameList();
      }
    } catch (error) {
      toast.error("Failed to create hostname. Please try again.");
    }

    setAddModalOpen(false);
  };

  const fetchHostnameList = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const listData = await hostnameService.listHostname();
      setHostnameListData(listData);
    } catch (error) {
      setErrorMessage("Failed to retrieve hostname list.");
      console.error("Failed to retrieve hostname list:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHostnameList();
  }, []);

  const handleView = (hostnameData) => {
    navigate('/dashboard/blacklist-monitor/report', { state: { hostnameData } });
   }

  const handleDelete = async (id) => {
    try {
      const result = await hostnameService.deleteHostname(id);

      if (result.status === 204) {
        toast.success('Successfully delete hostname');
        fetchHostnameList();
      }
      
    } catch (error) {
      toast.error('Failed to delete hostname. Please try again.');
    }
  }

  return (
    <div className="bg-white px-4 pt-3 pb-4 rounded-sm border border-gray-200 flex-1">
      <div className='bg-white h-16 px-4 flex items-center border-b border-color-gray-200'>
        <strong className="text-gray-700 font-medium">Blacklist Monitors</strong>
        <div className="ml-auto">
        <button
          className="bg-blue-500 text-white py-2 px-4 flex items-center rounded"
          onClick={() => setAddModalOpen(true)}
        >
          <HiOutlinePlusCircle className="mr-2" /> Add New
        </button>
        </div>
      </div>

      <div className="border-x border-gray-200 rounded-sm mt-3">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading monitors...</div>
        ) : errorMessage ? (
          <div className="p-6 text-sm text-red-600">{errorMessage}</div>
        ) : hostnameListData.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No monitors yet. Add one to start tracking blacklist status.</div>
        ) : (
          <HostnameTable
            hostnameListData={hostnameListData}
            handleView={handleView}
            handleDelete={handleDelete}
          />
        )}
        <AddNewMonitorDialog 
        formData={formData} 
        handleInputChange={handleInputChange} 
        handleSubmit={handleSubmit} 
        isOpen={addModalOpen} 
        setIsOpen={setAddModalOpen} 
        />
      </div>

      <ToastContainer position="top-center" autoClose={5000} />
    </div>
  );
}
