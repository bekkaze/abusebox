import React from "react";
import { IoBagHandle } from "react-icons/io5";

const StatGrid = ({ title, bodyText, BoxWrapperIcon }) => {
  return (
    <div className="bg-white rounded-sm p-4 flex-1 border border-gray-200 flex items-center">
      <div className="box-wrapper">
        <div className="rounded-full h-12 w-12 flex items-center justify-center bg-sky-500">
          <IoBagHandle className="text-2xl text-white" />
        </div>
        <div className="pl-4">
          <span className="text-sm text-gray-500 font-light">{title}</span>
          <div className="flex items-center">
            <strong className="text-xl text-gray-700 font-semibold">{bodyText}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatGrid;
