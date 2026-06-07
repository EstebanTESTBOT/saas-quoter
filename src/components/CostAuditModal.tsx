import { useState, useEffect } from 'react';
import { X, Receipt, Download, Layers, Wrench, Truck, BarChart3 } from 'lucide-react';
import { useQuoterStore } from '../store/useQuoterStore';
import { calculateChargeableWeight, calculateFreight, calculateTaxes, calculateSalePrice, getTaxRatesForCategory, getSACCode, CATEGORY_OPTIONS } from '../utils/calculations';

export const CostAuditModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const store = useQuoterStore();
    const { quoteItems, localMaterials, labor, logistics, services, freightType, airRate, oceanRate, manualFreightTotal, globalMargin } = store;

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('open-audit-modal', handleOpen);
        return () => window.removeEventListener('open-audit-modal', handleOpen);
    }, []);

    if (!isOpen) return null;

    const marginMultiplier = globalMargin >= 100 ? 1 : 1 / (1 - globalMargin / 100);

    // ─── SECTION A: Equipment ─────────────────────────────────────────
    const internationalItems = quoteItems.filter(it => !it.isLocalPurchase);
    const totalProjectWeight = internationalItems.reduce((acc, it) => acc + calculateChargeableWeight(it.weight, it.length, it.width, it.height, freightType) * it.quantity, 0);
    const totalInternationalItems = internationalItems.reduce((acc, it) => acc + it.quantity, 0);

    const equipmentRows = quoteItems.map(item => {
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
        const nationalizedCost = cif + taxes.totalTaxes + (item.localFreight || 0);
        const salePrice = nationalizedCost * marginMultiplier;
        const profit = salePrice - nationalizedCost;

        return { item, chargeableW, itemFreight, insurance, cif, taxRates, taxes, nationalizedCost, salePrice, profit };
    });

    const totalEquipCost = equipmentRows.reduce((acc, r) => acc + r.nationalizedCost * r.item.quantity, 0);
    const totalEquipSale = equipmentRows.reduce((acc, r) => acc + r.salePrice * r.item.quantity, 0);

    // ─── SECTION B: Materials ──────────────────────────────────────────
    const materialRows = localMaterials.map(mat => {
        const cost = mat.quantity * mat.unitPrice;
        const sale = cost * marginMultiplier;
        return { mat, cost, sale, profit: sale - cost };
    });
    const totalMatCost = materialRows.reduce((acc, r) => acc + r.cost, 0);
    const totalMatSale = materialRows.reduce((acc, r) => acc + r.sale, 0);

    // ─── SECTION C: Services ───────────────────────────────────────────
    const laborCost = labor.numTechs * labor.hours * labor.hourlyRate;
    const logisticsCost = logistics.perDiem + (logistics.mileage * logistics.ratePerKm);
    const servicesCost = services.installation + services.startup + (services.specialEquipment || 0);
    const totalSvcCost = laborCost + logisticsCost + servicesCost;
    const totalSvcSale = totalSvcCost * marginMultiplier;

    // ─── SECTION D: Summary ────────────────────────────────────────────
    const grandCost = totalEquipCost + totalMatCost + totalSvcCost;
    const grandSale = calculateSalePrice(grandCost, globalMargin);
    const grandProfit = grandSale - grandCost;
    const grandIva = grandSale * 0.13;
    const grandTotal = grandSale + grandIva;

    // ─── Export JSON ───────────────────────────────────────────────────
    const handleExportJSON = () => {
        const memoryData = {
            timestamp: new Date().toISOString(),
            quoteId: store.currentQuoteId,
            version: store.currentQuoteVersion,
            margin: globalMargin,
            freight: { type: freightType, airRate, oceanRate, manualTotal: manualFreightTotal },
            equipment: equipmentRows.map(r => ({
                model: r.item.model, brand: r.item.brand, category: r.item.category,
                sac: getSACCode(r.item.category), qty: r.item.quantity, exw: r.item.cost,
                freight: r.itemFreight, insurance: r.insurance, cif: r.cif,
                taxes: { dai: r.taxes.dai, selectivo: r.taxes.selectivo, ley6946: r.taxes.ley6946, iva: r.taxes.iva, total: r.taxes.totalTaxes },
                taxRates: r.taxRates, nationalizedCost: r.nationalizedCost,
                salePrice: r.salePrice, totalSale: r.salePrice * r.item.quantity
            })),
            materials: materialRows.map(r => ({ name: r.mat.name, qty: r.mat.quantity, unitPrice: r.mat.unitPrice, cost: r.cost, sale: r.sale })),
            services: { labor: laborCost, logistics: logisticsCost, special: servicesCost, totalCost: totalSvcCost, totalSale: totalSvcSale },
            summary: { totalCost: grandCost, totalSale: grandSale, profit: grandProfit, marginPercent: globalMargin, iva: grandIva, totalWithIva: grandTotal }
        };
        const blob = new Blob([JSON.stringify(memoryData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Memoria_${store.currentQuoteId}_V${store.currentQuoteVersion}.json`;
        link.click();
    };

    const f = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Receipt className="w-5 h-5" />
                        <h2 className="text-xl font-bold text-slate-800">Memoria de Cálculo Completa</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleExportJSON} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                            <Download className="w-4 h-4" /> Export JSON
                        </button>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                <div className="p-6 overflow-auto flex-1 space-y-6">

                    {/* SECTION A: Equipment */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wider">
                            <Layers className="w-4 h-4 text-indigo-500" /> A. Equipos — Nacionalización y Margen
                        </h3>
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-auto">
                            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-3 font-semibold border-b border-slate-200">Modelo</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Cat/SAC</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">EXW</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Flete</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">CIF</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">DAI</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Selectivo</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Ley 6946</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">IVA</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Impuestos</th>
                                        <th className="p-3 font-semibold border-b border-slate-200 bg-amber-50">Costo Nal.</th>
                                        <th className="p-3 font-semibold border-b border-slate-200 bg-emerald-50">P.Venta Unit.</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Qty</th>
                                        <th className="p-3 font-semibold border-b border-slate-200 bg-emerald-50 text-right">P.Venta Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {equipmentRows.map((r, idx) => {
                                        const catLabel = CATEGORY_OPTIONS.find(c => c.value === r.item.category)?.label || r.item.category;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-medium text-slate-800">{r.item.brand} {r.item.model}</td>
                                                <td className="p-3 text-slate-500"><span className="block font-medium text-indigo-600">{catLabel}</span><span className="text-[10px] text-slate-400">{getSACCode(r.item.category)}</span></td>
                                                <td className="p-3 text-slate-600">{f(r.item.cost)}</td>
                                                <td className="p-3 text-emerald-600">{f(r.itemFreight)}</td>
                                                <td className="p-3 text-blue-600 font-medium">{f(r.cif)}</td>
                                                <td className="p-3 text-slate-500">{f(r.taxes.dai)} <span className="text-[10px]">({r.taxRates.dai}%)</span></td>
                                                <td className="p-3 text-slate-500">{f(r.taxes.selectivo)} <span className="text-[10px]">({r.taxRates.selectivo}%)</span></td>
                                                <td className="p-3 text-slate-500">{f(r.taxes.ley6946)} <span className="text-[10px]">({r.taxRates.ley6946}%)</span></td>
                                                <td className="p-3 text-slate-500">{f(r.taxes.iva)}</td>
                                                <td className="p-3 text-orange-600 font-medium">{f(r.taxes.totalTaxes)}</td>
                                                <td className="p-3 text-slate-800 font-bold bg-amber-50">{f(r.nationalizedCost)}</td>
                                                <td className="p-3 text-emerald-700 font-bold bg-emerald-50">{f(r.salePrice)}</td>
                                                <td className="p-3 text-slate-600 text-center">{r.item.quantity}</td>
                                                <td className="p-3 text-emerald-700 font-bold bg-emerald-50 text-right">{f(r.salePrice * r.item.quantity)}</td>
                                            </tr>
                                        );
                                    })}
                                    {quoteItems.length === 0 && (
                                        <tr><td colSpan={14} className="p-6 text-center text-slate-500 italic">Sin equipos agregados</td></tr>
                                    )}
                                    {quoteItems.length > 0 && (
                                        <tr className="bg-slate-50 font-bold text-sm">
                                            <td colSpan={10} className="p-3 text-right text-slate-600">Subtotal Equipos:</td>
                                            <td className="p-3 bg-amber-50 text-slate-800">{f(totalEquipCost)}</td>
                                            <td colSpan={2}></td>
                                            <td className="p-3 bg-emerald-50 text-emerald-700 text-right">{f(totalEquipSale)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SECTION B: Materials */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wider">
                            <Wrench className="w-4 h-4 text-orange-500" /> B. Materiales Locales
                        </h3>
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-auto">
                            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-3 font-semibold border-b border-slate-200">Material</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Cantidad</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">P. Unitario</th>
                                        <th className="p-3 font-semibold border-b border-slate-200 bg-amber-50">Costo Total</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Margen {globalMargin}%</th>
                                        <th className="p-3 font-semibold border-b border-slate-200 bg-emerald-50 text-right">P.Venta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {materialRows.map((r, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-3 font-medium text-slate-800">{r.mat.name}</td>
                                            <td className="p-3 text-slate-600">{r.mat.quantity} {r.mat.unit}</td>
                                            <td className="p-3 text-slate-600">{f(r.mat.unitPrice)}</td>
                                            <td className="p-3 text-slate-800 font-bold bg-amber-50">{f(r.cost)}</td>
                                            <td className="p-3 text-blue-600">{f(r.profit)}</td>
                                            <td className="p-3 text-emerald-700 font-bold bg-emerald-50 text-right">{f(r.sale)}</td>
                                        </tr>
                                    ))}
                                    {localMaterials.length === 0 && (
                                        <tr><td colSpan={6} className="p-4 text-center text-slate-400 italic">Sin materiales</td></tr>
                                    )}
                                    {localMaterials.length > 0 && (
                                        <tr className="bg-slate-50 font-bold text-sm">
                                            <td colSpan={3} className="p-3 text-right text-slate-600">Subtotal Materiales:</td>
                                            <td className="p-3 bg-amber-50 text-slate-800">{f(totalMatCost)}</td>
                                            <td></td>
                                            <td className="p-3 bg-emerald-50 text-emerald-700 text-right">{f(totalMatSale)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SECTION C: Services */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wider">
                            <Truck className="w-4 h-4 text-blue-500" /> C. Servicios, Mano de Obra y Logística
                        </h3>
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-auto">
                            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-3 font-semibold border-b border-slate-200">Concepto</th>
                                        <th className="p-3 font-semibold border-b border-slate-200">Detalle</th>
                                        <th className="p-3 font-semibold border-b border-slate-200 bg-amber-50">Costo</th>
                                        <th className="p-3 font-semibold border-b border-slate-200 bg-emerald-50 text-right">P.Venta ({globalMargin}%)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr className="hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-800">Mano de Obra</td>
                                        <td className="p-3 text-slate-500">{labor.numTechs} técnicos × {labor.hours}h × ${labor.hourlyRate}/h</td>
                                        <td className="p-3 text-slate-800 font-bold bg-amber-50">{f(laborCost)}</td>
                                        <td className="p-3 text-emerald-700 font-bold bg-emerald-50 text-right">{f(laborCost * marginMultiplier)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-800">Logística / Viáticos</td>
                                        <td className="p-3 text-slate-500">Viáticos ${logistics.perDiem} + {logistics.mileage}km × ${logistics.ratePerKm}/km</td>
                                        <td className="p-3 text-slate-800 font-bold bg-amber-50">{f(logisticsCost)}</td>
                                        <td className="p-3 text-emerald-700 font-bold bg-emerald-50 text-right">{f(logisticsCost * marginMultiplier)}</td>
                                    </tr>
                                    <tr className="hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-800">Servicios Especiales</td>
                                        <td className="p-3 text-slate-500">Instalación ${services.installation} + Arranque ${services.startup} + Equipos ${services.specialEquipment || 0}</td>
                                        <td className="p-3 text-slate-800 font-bold bg-amber-50">{f(servicesCost)}</td>
                                        <td className="p-3 text-emerald-700 font-bold bg-emerald-50 text-right">{f(servicesCost * marginMultiplier)}</td>
                                    </tr>
                                    <tr className="bg-slate-50 font-bold text-sm">
                                        <td colSpan={2} className="p-3 text-right text-slate-600">Subtotal Servicios:</td>
                                        <td className="p-3 bg-amber-50 text-slate-800">{f(totalSvcCost)}</td>
                                        <td className="p-3 bg-emerald-50 text-emerald-700 text-right">{f(totalSvcSale)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SECTION D: Summary */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 uppercase tracking-wider">
                            <BarChart3 className="w-4 h-4 text-emerald-500" /> D. Resumen Ejecutivo
                        </h3>
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Costo Interno</p>
                                    <p className="text-lg font-bold font-mono">{f(grandCost)}</p>
                                </div>
                                <div className="bg-emerald-900/50 rounded-lg p-4 border border-emerald-700">
                                    <p className="text-xs text-emerald-300 uppercase tracking-wider mb-1">Precio Venta</p>
                                    <p className="text-lg font-bold font-mono text-emerald-400">{f(grandSale)}</p>
                                </div>
                                <div className="bg-blue-900/50 rounded-lg p-4 border border-blue-700">
                                    <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">Margen Bruto $</p>
                                    <p className="text-lg font-bold font-mono text-blue-400">{f(grandProfit)}</p>
                                </div>
                                <div className="bg-purple-900/50 rounded-lg p-4 border border-purple-700">
                                    <p className="text-xs text-purple-300 uppercase tracking-wider mb-1">Margen %</p>
                                    <p className="text-lg font-bold font-mono text-purple-400">{globalMargin}%</p>
                                </div>
                                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">IVA Venta (13%)</p>
                                    <p className="text-lg font-bold font-mono">{f(grandIva)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg p-4 border border-emerald-500">
                                    <p className="text-xs text-emerald-100 uppercase tracking-wider mb-1">Total con IVA</p>
                                    <p className="text-xl font-black font-mono">{f(grandTotal)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
