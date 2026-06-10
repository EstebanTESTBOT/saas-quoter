import React, { useState, useEffect, useRef } from 'react';
import { X, Database, Download, Upload } from 'lucide-react';
import { useQuoterStore } from '../store/useQuoterStore';

export const DatabasesModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { equipmentDB, materialDB, setLoadingEquipment, setLoadingMaterial } = useQuoterStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('open-databases-modal', handleOpen);
        return () => window.removeEventListener('open-databases-modal', handleOpen);
    }, []);

    const handleLoadEquipment = (eq: any) => {
        setLoadingEquipment(eq);
        setIsOpen(false);
    };

    const handleLoadMaterial = (mat: any) => {
        setLoadingMaterial(mat);
        setIsOpen(false);
    };

    const handleExport = () => {
        const data = localStorage.getItem('saas-quoter-storage');
        if (data) {
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `saas-quoter-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                JSON.parse(text); // validate JSON
                localStorage.setItem('saas-quoter-storage', text);
                alert('¡Datos importados con éxito! La página se recargará para aplicar los cambios.');
                window.location.reload();
            } catch (err) {
                alert('El archivo no es un JSON válido o está corrupto.');
            }
        };
        reader.readAsText(file);
        // Reset the input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSyncToCloud = async () => {
        setSyncing(true);
        try {
            const { supabase } = await import('../lib/supabase');
            
            // Sync equipment
            const eqArray = Object.values(equipmentDB);
            for (const eq of eqArray) {
                const { error } = await supabase.from('equipment_db').upsert({
                    model: eq.model,
                    brand: eq.brand,
                    description: eq.description,
                    cost: eq.cost,
                    weight: eq.weight,
                    length: eq.length,
                    width: eq.width,
                    height: eq.height,
                    category: eq.category,
                    lead_time: eq.leadTime,
                    is_local_purchase: eq.isLocalPurchase || false,
                    local_freight: eq.localFreight || 0,
                    tax_overrides: eq.taxOverrides || {}
                });
                if (error) throw error;
            }

            // Sync materials
            const matArray = Object.values(materialDB || {});
            for (const mat of matArray) {
                const { error } = await supabase.from('material_db').upsert({
                    name: mat.name,
                    unit: mat.unit,
                    unit_price: mat.unitPrice,
                    is_grouped: mat.isGrouped || false,
                    lead_time: mat.leadTime
                }, { onConflict: 'name' });
                if (error) throw error;
            }

            alert('¡Toda la base de datos local se ha sincronizado y guardado en Supabase con éxito!');
        } catch (err: any) {
            console.error('Error syncing local DB to Supabase:', err);
            alert(`Error al sincronizar con Supabase: ${err.message}`);
        } finally {
            setSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Database className="w-5 h-5" />
                        <h2 className="text-xl font-bold text-slate-800">Master Databases (Learned Data)</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                            <button 
                                onClick={handleExport}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
                            >
                                <Download className="w-3.5 h-3.5" /> Export DB
                            </button>
                            <input 
                                type="file" 
                                accept=".json" 
                                ref={fileInputRef} 
                                onChange={handleImport} 
                                className="hidden" 
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-200"
                            >
                                <Upload className="w-3.5 h-3.5" /> Import DB
                            </button>
                            <button 
                                onClick={handleSyncToCloud}
                                disabled={syncing}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold rounded-lg transition-colors border border-emerald-500 shadow-sm"
                            >
                                <Database className="w-3.5 h-3.5" /> {syncing ? 'Sincronizando...' : 'Subir a Supabase'}
                            </button>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                <div className="p-6 overflow-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50">
                    {/* Equipment DB */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-auto">
                        <h3 className="font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>Equipment ({Object.keys(equipmentDB).length})
                        </h3>
                        <div className="space-y-2">
                            {Object.values(equipmentDB).map((eq, i) => (
                                <div key={i} className="text-xs p-3 bg-slate-50/50 border border-slate-100 rounded-lg flex items-center justify-between group hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm mb-1">{eq.model} <span className="font-normal text-slate-500">by {eq.brand}</span></div>
                                        <div className="text-slate-600 flex gap-4">
                                            <span>Cost: ${eq.cost.toLocaleString()}</span>
                                            <span>Vol: {eq.length}x{eq.width}x{eq.height} cm</span>
                                        </div>
                                        <div className="text-slate-500 mt-1 truncate max-w-sm">{eq.description}</div>
                                    </div>
                                    <button 
                                        onClick={() => handleLoadEquipment(eq)}
                                        className="h-8 px-3 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white rounded-md font-medium transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                                    >
                                        Load
                                    </button>
                                </div>
                            ))}
                            {Object.keys(equipmentDB).length === 0 && <p className="text-slate-400 text-sm italic">No equipment learned yet.</p>}
                        </div>
                    </div>
                    
                    {/* Material DB */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-auto">
                        <h3 className="font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>Materials ({Object.keys(materialDB || {}).length})
                        </h3>
                        <div className="space-y-2">
                            {Object.values(materialDB || {}).map((mat, i) => (
                                <div key={i} className="text-xs p-3 bg-slate-50/50 border border-slate-100 rounded-lg flex items-center justify-between group hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm mb-1">{mat.name}</div>
                                        <div className="text-slate-600 flex gap-4">
                                            <span>Cost: ${mat.unitPrice} / {mat.unit}</span>
                                            <span>Lead Time: {mat.leadTime}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleLoadMaterial(mat)}
                                        className="h-8 px-3 bg-orange-100 text-orange-700 hover:bg-orange-600 hover:text-white rounded-md font-medium transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
                                    >
                                        Load
                                    </button>
                                </div>
                            ))}
                            {Object.keys(materialDB || {}).length === 0 && <p className="text-slate-400 text-sm italic">No materials learned yet.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
