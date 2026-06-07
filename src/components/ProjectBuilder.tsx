import { useState, useEffect } from 'react';
import { HardHat, Truck, Wrench, Settings2, Plus, Trash2, Pencil } from 'lucide-react';
import { useQuoterStore } from '../store/useQuoterStore';

export const ProjectBuilder = () => {
    const { 
        materialDB, saveToMaterialDB,
        localMaterials, addLocalMaterial, removeLocalMaterial, updateLocalMaterial,
        loadingMaterial, setLoadingMaterial,
        labor, updateLabor,
        logistics, updateLogistics,
        services, updateServices
    } = useQuoterStore();

    const [newMaterial, setNewMaterial] = useState({ name: '', unit: 'uds', quantity: 1, unitPrice: 0, isGrouped: true, leadTime: 'Stock' });

    // Listen to Database Load
    useEffect(() => {
        if (loadingMaterial) {
            setNewMaterial({
                name: loadingMaterial.name,
                unit: loadingMaterial.unit,
                unitPrice: loadingMaterial.unitPrice,
                leadTime: loadingMaterial.leadTime || 'Stock',
                quantity: 1,
                isGrouped: true
            });
            setLoadingMaterial(null);
        }
    }, [loadingMaterial, setLoadingMaterial]);

    // Auto-complete logic for material
    useEffect(() => {
        if (newMaterial.name && newMaterial.name.length > 2) {
            const found = materialDB[newMaterial.name.toUpperCase()];
            if (found) {
                // Auto-fill price and unit, but leave quantity empty
                setNewMaterial(prev => ({ ...prev, unit: found.unit, unitPrice: found.unitPrice, leadTime: found.leadTime || 'Stock' }));
            }
        }
    }, [newMaterial.name, materialDB]);

    const handleAddMaterial = () => {
        if (!newMaterial.name) return;
        saveToMaterialDB({ id: '', ...newMaterial });
        addLocalMaterial({ ...newMaterial, id: Date.now().toString() });
        setNewMaterial({ name: '', unit: 'uds', quantity: 1, unitPrice: 0, isGrouped: true, leadTime: 'Stock' });
    };

    const handleEditMaterial = (id: string) => {
        const mat = localMaterials.find(m => m.id === id);
        if (mat) {
            setNewMaterial(mat);
            removeLocalMaterial(id);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {/* Materials */}
            <div className="p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">Local Materials</h3>
                </div>
                
                <div className="grid grid-cols-12 gap-3 mb-4">
                    <input 
                        placeholder="Material name" className="col-span-5 h-9 px-3 rounded-md border border-slate-200 focus:ring-1 focus:ring-orange-500 outline-none text-sm uppercase"
                        value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})}
                    />
                    <select 
                        className="col-span-2 h-9 px-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-orange-500 outline-none text-sm bg-white"
                        value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})}
                    >
                        <option value="uds">uds</option>
                        <option value="m">m</option>
                        <option value="rls">rls</option>
                        <option value="kg">kg</option>
                    </select>
                    <input 
                        type="number" min="1" placeholder="Qty" className="col-span-1 h-9 px-2 rounded-md border border-slate-200 outline-none text-sm"
                        value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: parseFloat(e.target.value) || 0})}
                    />
                    <div className="col-span-2 h-9 flex items-center relative">
                        <span className="absolute left-2 text-slate-400 text-sm">$</span>
                        <input 
                            type="number" placeholder="Cost" className="w-full h-full pl-6 pr-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                            value={newMaterial.unitPrice || ''} onChange={e => setNewMaterial({...newMaterial, unitPrice: parseFloat(e.target.value) || 0})}
                        />
                    </div>
                    <input 
                        placeholder="Lead Time" className="col-span-2 h-9 px-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                        value={newMaterial.leadTime} onChange={e => setNewMaterial({...newMaterial, leadTime: e.target.value})}
                    />
                </div>
                <div className="flex justify-end mb-4">
                    <button 
                        onClick={handleAddMaterial}
                        disabled={!newMaterial.name}
                        className="h-9 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white rounded-md flex items-center justify-center transition-colors shadow-sm text-sm font-medium"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Añadir / Guardar
                    </button>
                </div>

                {localMaterials.length > 0 && (
                    <div className="space-y-2 mt-4">
                        {localMaterials.map(mat => (
                            <div key={mat.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 gap-3 group">
                                <div className="flex items-center gap-3 flex-1">
                                    <span className="font-medium text-slate-700 text-sm">{mat.name}</span>
                                    <span className="text-xs text-slate-500">{mat.quantity} {mat.unit} • {mat.leadTime}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-semibold text-slate-700">${(mat.quantity * mat.unitPrice).toFixed(2)}</span>
                                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={mat.isGrouped} 
                                            onChange={e => updateLocalMaterial(mat.id, { isGrouped: e.target.checked })} 
                                            className="w-3 h-3 text-orange-500 rounded border-slate-300 focus:ring-orange-500" 
                                        />
                                        Group Detailed
                                    </label>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditMaterial(mat.id)} className="text-slate-400 hover:text-blue-500">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => removeLocalMaterial(mat.id)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* General Project Costs (Labor, Logistics, Services) in 3 columns */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50">
                
                {/* Labor */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                        <HardHat className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-semibold text-slate-700 text-sm">Labor Workforce</h4>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Techs</span>
                            <input type="number" min="0" value={labor.numTechs || ''} onChange={e => updateLabor({ numTechs: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Hours</span>
                            <input type="number" min="0" value={labor.hours || ''} onChange={e => updateLabor({ hours: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">$/Hour</span>
                            <input type="number" min="0" value={labor.hourlyRate || ''} onChange={e => updateLabor({ hourlyRate: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                    </div>
                </div>

                {/* Logistics */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-slate-700 text-sm">Local Logistics</h4>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Viáticos ($)</span>
                            <input type="number" min="0" value={logistics.perDiem || ''} onChange={e => updateLogistics({ perDiem: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Mileage (Km)</span>
                            <input type="number" min="0" value={logistics.mileage || ''} onChange={e => updateLogistics({ mileage: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">$/Km</span>
                            <input type="number" min="0" value={logistics.ratePerKm || ''} onChange={e => updateLogistics({ ratePerKm: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                    </div>
                </div>

                {/* Services */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Settings2 className="w-4 h-4 text-purple-600" />
                        <h4 className="font-semibold text-slate-700 text-sm">Special Services</h4>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Installation ($)</span>
                            <input type="number" min="0" value={services.installation || ''} onChange={e => updateServices({ installation: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Start-up ($)</span>
                            <input type="number" min="0" value={services.startup || ''} onChange={e => updateServices({ startup: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-slate-200 rounded outline-none" />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 font-semibold text-purple-700">Equipos Especiales ($)</span>
                            <input type="number" min="0" value={services.specialEquipment || ''} onChange={e => updateServices({ specialEquipment: parseFloat(e.target.value)||0 })} className="w-20 h-8 px-2 border border-purple-300 bg-purple-50 rounded outline-none" title="Grúas, perra hidráulica, etc." />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
