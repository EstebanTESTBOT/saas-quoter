
import { useQuoterStore } from '../store/useQuoterStore';
import { calculateChargeableWeight, calculateFreight, calculateTaxes, calculateSalePrice, getTaxRatesForCategory } from '../utils/calculations';
import { FileText, Save, Calculator, ZoomIn } from 'lucide-react';

export const QuoteSummary = () => {
    const { 
        quoteItems, localMaterials, labor, logistics, services, globalMargin,
        freightType, setFreightType, freightOrigin, setFreightOrigin, airRate, setAirRate, oceanRate, setOceanRate,
        manualFreightTotal, setManualFreightTotal, setGlobalMargin 
    } = useQuoterStore();

    // 1. Calculate Equipment Total Puesto (Nationalized Cost)
    let totalEquipmentCost = 0;
    
    const internationalItems = quoteItems.filter(it => !it.isLocalPurchase);
    const totalProjectWeight = internationalItems.reduce((acc, it) => acc + calculateChargeableWeight(it.weight, it.length, it.width, it.height, freightType) * it.quantity, 0);
    const totalInternationalItems = internationalItems.reduce((acc, it) => acc + it.quantity, 0);

    quoteItems.forEach(item => {
        const isLocal = item.isLocalPurchase;
        const chargeableW = calculateChargeableWeight(item.weight, item.length, item.width, item.height, freightType);
        const activeRate = freightType === 'AIR' ? airRate : oceanRate;
        
        let itemFreight = 0;
        if (!isLocal) {
            if (manualFreightTotal !== null) {
                const weightRatio = totalProjectWeight > 0 ? (chargeableW / totalProjectWeight) : (1 / totalInternationalItems);
                itemFreight = manualFreightTotal * weightRatio;
            } else {
                itemFreight = calculateFreight(chargeableW, activeRate);
            }
        }
        
        const insurance = isLocal ? 0 : item.cost * 0.01;
        const cif = item.cost + itemFreight + insurance;
        
        const taxRates = isLocal
            ? { dai: 0, selectivo: 0, ley6946: 0, iva: 0 }
            : getTaxRatesForCategory(item.category, item.taxOverrides);

        const taxes = calculateTaxes(cif, taxRates.dai, taxRates.selectivo, taxRates.ley6946, taxRates.iva);
        const totalNationalized = cif + taxes.totalTaxes + (item.localFreight || 0);
        
        totalEquipmentCost += (totalNationalized * item.quantity);
    });

    // 2. Local Materials
    const totalMaterialsCost = localMaterials.reduce((acc, mat) => acc + (mat.quantity * mat.unitPrice), 0);

    // 3. Labor
    const totalLaborCost = labor.numTechs * labor.hours * labor.hourlyRate;

    // 4. Logistics
    const totalLogisticsCost = logistics.perDiem + (logistics.mileage * logistics.ratePerKm);

    // 5. Services
    const totalServicesCost = services.installation + services.startup + (services.specialEquipment || 0);

    // 6. TOTAL COST
    const grandTotalCost = totalEquipmentCost + totalMaterialsCost + totalLaborCost + totalLogisticsCost + totalServicesCost;

    // 7. SALE PRICE (Subtotal)
    const finalSalePrice = calculateSalePrice(grandTotalCost, globalMargin);
    const expectedProfit = finalSalePrice - grandTotalCost;

    // 8. IVA and Final Total
    const saleIva = finalSalePrice * 0.13;
    const finalSalePriceWithIva = finalSalePrice + saleIva;

    return (
        <div className="bg-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden text-slate-100 sticky top-24 font-sans">
            
            <div className="p-6 bg-slate-900/50 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Calculator className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold">Quote Output</h3>
                </div>
            </div>

            <div className="p-6 space-y-6">
                
                {/* Margin Configuration */}
                <div className="space-y-3 pb-6 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">Target Profit Margin (%)</label>
                        <span className="text-2xl font-bold text-emerald-400">{globalMargin}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="80" step="1" 
                        value={globalMargin} onChange={e => setGlobalMargin(parseInt(e.target.value))}
                        className="w-full appearance-none h-2 bg-slate-700 rounded-full cursor-pointer overflow-hidden checked:bg-emerald-500"
                    />
                </div>

                {/* Global Freight Configuration */}
                <div className="space-y-4 pb-6 border-b border-slate-700">
                    <h4 className="text-sm font-medium text-slate-300">International Freight (Global)</h4>
                    
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => {
                                setFreightOrigin('CHINA');
                                setAirRate(8.5);
                                setOceanRate(150);
                            }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded border transition-colors ${freightOrigin === 'CHINA' ? 'bg-red-500/20 text-red-300 border-red-500/50' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'}`}
                        >
                            🇨🇳 Origen China
                        </button>
                        <button 
                            onClick={() => {
                                setFreightOrigin('MIAMI');
                                setAirRate(3.5);
                                setOceanRate(65);
                            }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded border transition-colors ${freightOrigin === 'MIAMI' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'}`}
                        >
                            🇺🇸 Origen Miami
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className={`p-3 rounded-xl border cursor-pointer transition-colors ${freightType === 'AIR' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                            <input type="radio" className="hidden" checked={freightType === 'AIR'} onChange={() => setFreightType('AIR')} />
                            <div className="font-bold text-sm flex items-center justify-between">Flete Aéreo <span className="opacity-50">✈️</span></div>
                            <div className="text-xs opacity-70">Tarifa por Kg Volumétrico</div>
                        </label>
                        <label className={`p-3 rounded-xl border cursor-pointer transition-colors ${freightType === 'OCEAN' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                            <input type="radio" className="hidden" checked={freightType === 'OCEAN'} onChange={() => setFreightType('OCEAN')} />
                            <div className="font-bold text-sm flex items-center justify-between">Flete Marítimo <span className="opacity-50">🚢</span></div>
                            <div className="text-xs opacity-70">Tarifa por Rev. Ton / CBM</div>
                        </label>
                    </div>
                    <div className="flex items-center justify-between gap-4 mt-2">
                        <div className="flex-1">
                            <label className="text-xs text-slate-400 block mb-1">Tarifa Global ({freightType === 'AIR' ? 'USD/Kg' : 'USD/CBM'})</label>
                            <input 
                                type="number" 
                                value={freightType === 'AIR' ? airRate : oceanRate} 
                                onChange={(e) => freightType === 'AIR' ? setAirRate(parseFloat(e.target.value)||0) : setOceanRate(parseFloat(e.target.value)||0)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-slate-400 block mb-1 flex justify-between">Flete Manual <span className="text-amber-400 text-[10px]">(Anula todo)</span></label>
                            <input 
                                type="number" 
                                placeholder="Auto"
                                value={manualFreightTotal || ''} 
                                onChange={(e) => setManualFreightTotal(e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 focus:border-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Subtotals Breakdown */}
                <div className="space-y-4 text-sm bg-slate-900/30 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex justify-between items-center text-slate-300">
                        <span>Equipment Cost (Nationalized)</span>
                        <span className="font-mono text-slate-100">${totalEquipmentCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                        <span>Local Materials</span>
                        <span className="font-mono text-slate-100">${totalMaterialsCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                        <span>Labor Force</span>
                        <span className="font-mono text-slate-100">${totalLaborCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                        <span>Logistics & Viáticos</span>
                        <span className="font-mono text-slate-100">${totalLogisticsCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300 pb-3 border-b border-slate-700">
                        <span>Special Services</span>
                        <span className="font-mono text-slate-100">${totalServicesCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-200 font-semibold pt-1">
                        <span>Total Internal Cost</span>
                        <span className="font-mono tracking-tight text-white">${grandTotalCost.toFixed(2)}</span>
                    </div>
                </div>

                {/* Final Price Area */}
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/40 border border-blue-500/30 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/30 rounded-full blur-2xl"></div>
                    <div className="flex flex-col gap-1 relative z-10">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-500/30">
                            <span className="text-xs uppercase tracking-wider text-blue-200 font-bold">Precio Venta (Subtotal)</span>
                            <span className="text-lg font-bold text-white font-mono">${finalSalePrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-500/30">
                            <span className="text-xs uppercase tracking-wider text-blue-200 font-bold">IVA (13%)</span>
                            <span className="text-lg font-medium text-blue-100 font-mono">${saleIva.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold mt-1">Total con IVA</span>
                        <span className="text-4xl font-black tracking-tight text-white font-mono break-all line-clamp-1 truncate">
                            ${finalSalePriceWithIva.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                        <span className="text-sm font-medium text-blue-300 mt-2 flex justify-between">
                            Est. Gross Profit (Pre-tax): 
                            <span className="text-emerald-400 font-mono">${expectedProfit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('save-draft'))}
                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" /> Save
                    </button>
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('open-export-modal'))}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors border border-blue-500/50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                        <FileText className="w-4 h-4" /> View Offer
                    </button>
                </div>
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('open-audit-modal'))}
                    className="w-full py-2 bg-slate-800 text-blue-400 hover:bg-slate-700 hover:text-blue-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700 mt-2"
                >
                    <ZoomIn className="w-4 h-4" /> Memoria de Cálculo
                </button>

            </div>
        </div>
    );
};
