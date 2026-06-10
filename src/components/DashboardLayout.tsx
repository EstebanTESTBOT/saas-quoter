import React from 'react';
import { Package, Search, Bell, Settings } from 'lucide-react';
import { useQuoterStore } from '../store/useQuoterStore';

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const logout = useQuoterStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-auto h-16 flex items-center justify-center">
              <img src="/logoSIMEC.jpg" alt="Grupo SIMEC" className="h-full object-contain max-w-[300px]" onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }} />
              <div className="hidden flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-800 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Package className="text-white w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xl tracking-tight text-slate-800 leading-none">
                    GRUPO <span className="text-indigo-600">SIMEC</span>
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Pricing Engine</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
              title="Cerrar sesión (Logout)"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
              <img src="https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff" alt="User" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {children}
      </main>
    </div>
  );
};
