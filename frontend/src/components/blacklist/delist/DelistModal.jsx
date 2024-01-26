// DelistModal.jsx
import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import FormFieldRender from './FormFieldRender';
import DelistSerivce from '../../../services/blacklist/delist';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DelistModal = ({ isOpen, onClose, provider, data, fields }) => {
  const [formData, setFormData] = useState({});
  const delistService = DelistSerivce(); 

  const handleInputChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };
   

  const handleSubmit = async () => {
    const body = {
      'provider': provider,
      'delist_required_data': {
        'id': data.id,
        ...formData,
      }
    };
    
    try {
      const response = await delistService.delistRequest(body);
      if (response.success) {
        toast.success('Delist request sent successfully');
        window.location.reload();
      } else if (response.msg === 'Not implemented') {
        toast.error(`Not implemented auto list feature on ${provider}`);
      }
    } catch (error) {
      console.error('Error during delist request:', error);
      toast.error('An error occurred while processing your request.');
    }
    onClose(); 
  };

  return (
    <div>
      <Transition show={isOpen} as={React.Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-10 overflow-y-auto"
          onClose={onClose}
        >
          <div className="min-h-screen px-4 text-center">
            <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
            <div className="inline-block align-middle my-20 w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-md">
              <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                Delist Provider: {provider}
              </Dialog.Title>
              <div className="mt-4">
                {fields.map((field, index) => (
                  <FormFieldRender 
                    key={index} 
                    label={field.label} 
                    name={field.name} 
                    value={formData[field.name]}
                    onChange={handleInputChange}
                  />
                ))}
              </div>

              <div className="mt-4 flex justify-between">
                <button
                  onClick={handleSubmit}
                  className="bg-blue-500 text-white py-2 px-4 rounded"
                >
                  Send delist request
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition>

      <ToastContainer position="top-center" autoClose={5000} />
    </div>
  );
};

export default DelistModal;
