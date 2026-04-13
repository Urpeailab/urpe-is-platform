import React from 'react';

export const AdminDashboardSimple = () => {
  console.log("🔥 AdminDashboardSimple IS RENDERING!");
  return (
    <div className="p-8 bg-red-500 min-h-screen">
      <h1 className="text-4xl font-bold text-yellow-400 mb-4">🔥 Dashboard Test 🔥</h1>
      <p className="text-white text-2xl font-bold">Si puedes ver esto, el problema está en el componente AdminDashboard complejo.</p>
      
      <div className="mt-8 p-6 bg-blue-600 border-4 border-yellow-400 rounded-xl">
        <h2 className="text-3xl font-bold text-white mb-2">Card Test</h2>
        <p className="text-yellow-300 text-xl">Este es un card simple con estilos explícitos muy visibles.</p>
      </div>
    </div>
  );
};
