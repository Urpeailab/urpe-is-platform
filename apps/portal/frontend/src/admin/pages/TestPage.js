import React from 'react';

export const TestPage = () => {
  return (
    <div className="min-h-screen bg-red-500 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl">
        <h1 className="text-4xl font-bold text-black mb-4">
          TEST PAGE - Admin Panel
        </h1>
        <p className="text-xl text-gray-700">
          If you can see this, the routing and basic rendering work.
        </p>
        <div className="mt-4 p-4 bg-yellow-100 border-2 border-yellow-500">
          <p className="text-black font-bold">Backend URL: {process.env.REACT_APP_BACKEND_URL || 'UNDEFINED'}</p>
        </div>
      </div>
    </div>
  );
};
