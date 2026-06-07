import React, { useState, useEffect } from 'react';
import { Plus, Calculator, PackageSearch, AlertCircle, TrendingUp, Trash2, Pencil, ChevronDown } from 'lucide-react';
import { useQuoterStore } from '../store/useQuoterStore';
import type { Equipment } from '../store/useQuoterStore';
import { calculateChargeableWeight, calculateFreight, calculateTaxes, getTaxRatesForCategory, getSACCode, CATEGORY_OPTIONS, TARIFF_MAP } from '../utils/calculations';
import type { EquipmentCategory, TaxRates } from '../utils/calculations';

export const EquipmentForm = () => {
    const { 
        equipmentDB, 
        saveToEquipmentDB, 
        addQuoteItem, 
        removeQuoteItem,
        quoteItems,
        loadingEquipment,
        setLoadingEquipment,
        freightType,
        airRate,
        oceanRate,
        manualFreightTotal 
    } = useQuoterStore();

    const [formData, setFormData] = useState<Equipment>({
        model: '',
        brand: '',
        description: '',
        category: 'UPS',
        cost: 0,
        weight: 0,
        length: 0,
        width: 0,
        height: 0,
        leadTime: '8-10 semanas',
        isLocalPurchase: false,
        localFreight: 0,
        taxOverrides: undefined
    });
    const [quantity, setQuantity] = useState(1);
    const [showTaxOverrides, setShowTaxOverrides] = useState(false);
    const [localOverrides, setLocalOverrides] = useState<Partial<TaxRates>>({});
    
    // Listen to Database Load
    useEffect(() => {
        if (loadingEquipment) {
            setFormData(loadingEquipment);
            setLocalOverrides(loadingEquipment.taxOverrides || {});
            setLoadingEquipment(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [loadingEquipment, setLoadingEquipment]);

    // Auto-complete logic
    useEffect(() => {
        if (formData.model && formData.model.length > 2) {
            const found = equipmentDB[formData.model.toUpperCase()];
            if (found) {
                setFormData(found);
                setLocalOverrides(found.taxOverrides || {});
            }
        }
    }, [formData.model, equipmentDB]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const { name, value, type, checked } = target;
        const isNumberField = ['cost', 'weight', 'length', 'width', 'height', 'localFreight'].includes(name);
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (isNumberField ? parseFloat(value) || 0 : value)
        }));
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCat = e.target.value as EquipmentCategory;
        setFormData(prev => ({ ...prev, category: newCat }));
        setLocalOverrides({}); // Reset overrides when changing category
        setShowTaxOverrides(false);
    };

    const handleOverrideChange = (field: keyof TaxRates, value: string) => {
        const num = parseFloat(value);
        setLocalOverrides(prev => ({
            ...prev,
            [field]: isNaN(num) ? undefined : num
        }));
    };

    const handleAddEquipment = () => {
        const eqWithOverrides: Equipment = {
            ...formData,
            taxOverrides: Object.keys(localOverrides).length > 0 ? localOverrides : undefined
        };
        saveToEquipmentDB(eqWithOverrides);
        addQuoteItem({
            ...eqWithOverrides,
            id: Date.now().toString(),
            quantity
        });
        setFormData(prev => ({ ...prev, model: '', description: '' }));
        setLocalOverrides({});
    };

    const handleEditEquipment = (id: string) => {
        const item = quoteItems.find(i => i.id === id);
        if (item) {
            setFormData(item);
            setLocalOverrides(item.taxOverrides || {});
            setQuantity(item.quantity);
            removeQuoteItem(id);
        }
    };

    // Calculate live estimations for preview
    const chargeableW = calculateChargeableWeight(formData.weight, formData.length, formData.width, formData.height, freightType);
    const activeRate = freightType === 'AIR' ? airRate : oceanRate;
    const freight = formData.isLocalPurchase ? 0 : (manualFreightTotal !== null ? manualFreightTotal : calculateFreight(chargeableW, activeRate));
    const insurance = formData.isLocalPurchase ? 0 : (formData.cost * 0.01);
    const cif = formData.cost + freight + insurance;
    
    // Tax rates from category + overrides
    const effectiveRates = formData.isLocalPurchase 
        ? { dai: 0, selectivo: 0, ley6946: 0, iva: 0 }
        : getTaxRatesForCategory(formData.category, localOverrides);
    
    const taxes = calculateTaxes(cif, effectiveRates.dai, effectiveRates.selectivo, effectiveRates.ley6946, effectiveRates.iva);
    const totalNationalized = cif + taxes.totalTaxes + (formData.localFreight || 0);

    const sacCode = getSACCode(formData.category);
    const baseRates = TARIFF_MAP[formData.category]?.rates;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <PackageSearch className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-800">Equipment Logistics Engine</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Learning system active</span>
                </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Inputs Area */}
                <div className="col-span-1 lg:col-span-7 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Model (Auto-completes)</label>
                            <input 
                                name="model" value={formData.model} onChange={handleInputChange}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all uppercase"
                                placeholder="E.g. UPS-60KVA"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Brand</label>
                            <input 
                                name="brand" value={formData.brand} onChange={handleInputChange}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Brand Name"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Description</label>
                            <input 
                                name="description" value={formData.description} onChange={handleInputChange}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Technical specifications..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Lead Time</label>
                            <input 
                                name="leadTime" value={formData.leadTime || ''} onChange={handleInputChange}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                placeholder="E.g. 8-10 semanas"
                            />
                        </div>
                    </div>

                    {/* Category + SAC */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-indigo-700">Categoría Equipo</label>
                                <select
                                    value={formData.category}
                                    onChange={handleCategoryChange}
                                    className="w-full h-10 px-3 rounded-lg border border-indigo-200 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-medium"
                                >
                                    {CATEGORY_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-indigo-700">Partida SAC</label>
                                <div className="h-10 px-3 rounded-lg border border-indigo-200 bg-indigo-100/50 flex items-center text-sm font-mono font-bold text-indigo-800">
                                    {sacCode}
                                </div>
                            </div>
                        </div>
                        
                        {/* Base rates info */}
                        <div className="flex items-center gap-3 text-xs text-indigo-600">
                            <span className="bg-indigo-100 px-2 py-0.5 rounded font-medium">DAI {effectiveRates.dai}%</span>
                            <span className="bg-indigo-100 px-2 py-0.5 rounded font-medium">Selectivo {effectiveRates.selectivo}%</span>
                            <span className="bg-indigo-100 px-2 py-0.5 rounded font-medium">Ley 6946 {effectiveRates.ley6946}%</span>
                            <span className="bg-indigo-100 px-2 py-0.5 rounded font-medium">IVA {effectiveRates.iva}%</span>
                            <button 
                                onClick={() => setShowTaxOverrides(!showTaxOverrides)}
                                className="ml-auto text-indigo-500 hover:text-indigo-700 flex items-center gap-1 font-medium"
                            >
                                <ChevronDown className={`w-3 h-3 transition-transform ${showTaxOverrides ? 'rotate-180' : ''}`} />
                                Editar tasas
                            </button>
                        </div>

                        {/* Editable tax overrides */}
                        {showTaxOverrides && (
                            <div className="grid grid-cols-4 gap-3 pt-2 border-t border-indigo-100">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-indigo-600">DAI %</label>
                                    <input 
                                        type="number" step="0.01"
                                        placeholder={String(baseRates?.dai ?? 0)}
                                        value={localOverrides.dai ?? ''}
                                        onChange={e => handleOverrideChange('dai', e.target.value)}
                                        className="w-full h-8 px-2 text-sm rounded border border-indigo-200 bg-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-indigo-600">Selectivo %</label>
                                    <input 
                                        type="number" step="0.01"
                                        placeholder={String(baseRates?.selectivo ?? 0)}
                                        value={localOverrides.selectivo ?? ''}
                                        onChange={e => handleOverrideChange('selectivo', e.target.value)}
                                        className="w-full h-8 px-2 text-sm rounded border border-indigo-200 bg-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-indigo-600">Ley 6946 %</label>
                                    <input 
                                        type="number" step="0.01"
                                        placeholder={String(baseRates?.ley6946 ?? 0)}
                                        value={localOverrides.ley6946 ?? ''}
                                        onChange={e => handleOverrideChange('ley6946', e.target.value)}
                                        className="w-full h-8 px-2 text-sm rounded border border-indigo-200 bg-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-indigo-600">IVA %</label>
                                    <input 
                                        type="number" step="0.01"
                                        placeholder={String(baseRates?.iva ?? 13)}
                                        value={localOverrides.iva ?? ''}
                                        onChange={e => handleOverrideChange('iva', e.target.value)}
                                        className="w-full h-8 px-2 text-sm rounded border border-indigo-200 bg-white outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-px w-full bg-slate-100"></div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-1.5 flex flex-col justify-center">
                            <label className="text-sm font-medium text-slate-700">Compra Local</label>
                            <label className="flex items-center gap-2 cursor-pointer mt-2">
                                <input 
                                    name="isLocalPurchase" type="checkbox" checked={formData.isLocalPurchase || false} onChange={handleInputChange}
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-600">Sin Flete/Nal.</span>
                            </label>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Cost (Orig. USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                                <input 
                                    name="cost" type="number" value={formData.cost !== 0 ? formData.cost : ''} onChange={handleInputChange}
                                    className="w-full h-10 pl-8 pr-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Flete Local ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                                <input 
                                    name="localFreight" type="number" value={formData.localFreight !== 0 ? (formData.localFreight || '') : ''} onChange={handleInputChange}
                                    className="w-full h-10 pl-8 pr-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                    placeholder="Interno"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Qty for Quote</label>
                            <input 
                                type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Weight (kg)</label>
                            <input name="weight" type="number" value={formData.weight || ''} onChange={handleInputChange} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">L (cm)</label>
                            <input name="length" type="number" value={formData.length || ''} onChange={handleInputChange} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">W (cm)</label>
                            <input name="width" type="number" value={formData.width || ''} onChange={handleInputChange} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">H (cm)</label>
                            <input name="height" type="number" value={formData.height || ''} onChange={handleInputChange} className="w-full h-10 px-3 rounded-lg border border-slate-200 outline-none" />
                        </div>
                    </div>

                    <button 
                        onClick={handleAddEquipment}
                        disabled={!formData.model || formData.cost <= 0}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
                    >
                        <Plus className="w-5 h-5" />
                        Add to Quote & Learn Model
                    </button>
                </div>

                {/* Live Preview Logistics Area */}
                <div className="col-span-1 lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-5 font-mono text-sm relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-200/50 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <h3 className="font-sans font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-slate-500" />
                        Live Cost Preview (Per Unit)
                    </h3>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-slate-600">
                            <span>{freightType === 'AIR' ? 'Volumetric Weight:' : 'Volume (CBM):'}</span>
                            <span className="font-medium text-slate-800">
                                {freightType === 'AIR' ? ((formData.length * formData.width * formData.height) / 6000).toFixed(2) + ' kg' : ((formData.length * formData.width * formData.height) / 1000000).toFixed(4) + ' CBM'}
                            </span>
                        </div>
                        <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200 border-dashed">
                            <span>Chargeable W.:</span>
                            <span className="font-semibold">{chargeableW.toFixed(2)} kg</span>
                        </div>
                        <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200 border-dashed">
                            <span>Est. Freight (CIP):</span>
                            <span>${freight.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-800 font-semibold pb-2 border-b border-slate-200">
                            <span>CIF Value:</span>
                            <span>${cif.toFixed(2)}</span>
                        </div>
                        
                        {/* Taxes */}
                        <div className="flex justify-between text-slate-500 text-xs pl-4">
                            <span>DAI ({effectiveRates.dai}%):</span>
                            <span>${taxes.dai.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-xs pl-4">
                            <span>Selectivo ({effectiveRates.selectivo}%):</span>
                            <span>${taxes.selectivo.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-xs pl-4 pb-2 border-b border-slate-100">
                            <span>Ley 6946 ({effectiveRates.ley6946}%):</span>
                            <span>${taxes.ley6946.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200 border-dashed pl-2 font-semibold">
                            <span>Base IVA:</span>
                            <span>${taxes.baseIva.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-blue-600 text-xs pl-4 pb-2 border-b border-slate-200">
                            <span>IVA ({effectiveRates.iva}% on Base):</span>
                            <span>${taxes.iva.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200 border-dashed pl-2 font-semibold">
                            <span>Flete Local:</span>
                            <span>${(formData.localFreight || 0).toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-slate-900 pt-2 text-base font-sans font-bold">
                            <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4 text-emerald-500"/> Total Landed Cost:</span>
                            <span className="text-emerald-600">${totalNationalized.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Added Items List */}
            {quoteItems.length > 0 && (
                <div className="border-t border-slate-100 p-6 bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Equipment Added to Quote</h3>
                    <div className="space-y-2">
                        {quoteItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm group">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">
                                        {item.brand} {item.model} 
                                        {item.isLocalPurchase && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Local</span>}
                                        <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                            {CATEGORY_OPTIONS.find(c => c.value === item.category)?.label || item.category}
                                        </span>
                                    </span>
                                    <span className="text-xs text-slate-500">{item.description} • {item.quantity} units</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-semibold text-slate-700">${(item.cost * item.quantity).toLocaleString()}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditEquipment(item.id)} className="text-slate-400 hover:text-blue-500">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => removeQuoteItem(item.id)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
