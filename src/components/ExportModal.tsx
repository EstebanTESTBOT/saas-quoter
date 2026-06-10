import { useState, useEffect } from 'react';
import { X, Copy, Download, Check, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuoterStore } from '../store/useQuoterStore';
import { calculateChargeableWeight, calculateFreight, calculateTaxes, getTaxRatesForCategory } from '../utils/calculations';

// ─── Default Terms & Conditions ────────────────────────────────────────────────
const DEFAULT_TERMS = `1. Se respetarán los precios vigentes de la oferta al momento de recibir la orden de compra, sin embargo los precios de esta oferta están sujetos a cambios debido a las variaciones en costos de importación, fletes, seguros y tasas cambiarias.

2. Grupo SIMEC, es responsable de la aplicación técnica siempre y cuando se cumpla con las recomendaciones y especificaciones técnicas emitidas por el fabricante.

3. Grupo SIMEC, no es responsable de daños a terceros, si no que se limita a los productos incluidos, ni tampoco de los trabajos que no estén contemplados por escrito en el presente documento. El cliente deberá velar que las especificaciones presentadas sean las adecuadas para su necesidad.

4. Todos los materiales y equipos ofertados en esta oferta son nuevos y cuentan con garantía de fábrica, aplica a defectos de fabricación, no cubre daño por negligencia, mal uso o causas de fuerza mayor.

5. Se debe disponer de un contacto designado por parte del cliente y contratista que servirá como referencia de los equipos en el proyecto.

6. Los tiempos indicados son estimados en días hábiles partiendo desde la fecha de recepción de la orden de compra o firma del contrato, son susceptibles a retrasos logísticos fuera del control de Grupo SIMEC, como retrasos en aduanas o transporte internacional.

7. Los equipos ofrecidos son estándar del fabricante. Cualquier personalización requiere validación de fábrica y podría impactar precio y tiempo de entrega.

8. Las ofertas vigentes en esta cotización se asignan por línea, se especifica la vigencia en cada una.

9. Los precios de la oferta NO incluyen: adecuaciones civiles, eléctricas o mecánicas no especificadas, permisos y trámites municipales, trabajos fuera del horario regular de lunes a viernes de 7:00am a 5:00pm, impuestos adicionales no contemplados. Todo trabajo extraordinario será cotizado aparte.

10. Toda propuesta de equipamiento es responsabilidad técnica de la empresa contratante, por lo cual en caso de que Grupo SIMEC evidencie en sitio diferencias, se requiere cambiar o adicionar/eliminar equipos para garantizar las condiciones comerciales del fabricante.

11. Los pagos se hacen mediante un trámite de 15 días hábiles a partir de la fecha de recepción de la factura electrónica con los soportes de entrega correspondientes y se realizan en colones o dólares, y mediante transferencia a Grupo SIMEC, al número de cuenta indicado en la factura.

12. Grupo SIMEC, se reserva el derecho de suspender la entrega de los equipos o la prestación de servicios en caso de atraso en pagos de la factura emitida, sin perjuicio de acciones legales que procedan.

13. Todo pago de la oferta a Grupo SIMEC, tiene un tiempo de vigencia de 15 días naturales después de presentar la factura o recibido a satisfacción de la entrega de los productos o actualizados o anulados si fuera requerido.

14. Se exige el uso de las hojas de trabajo de entrega, para registrar las entregas, los trabajos realizados, observaciones o información pertinente asociada para cada entrega.

15. En caso de cancelación de órdenes de compra sin previo procedimiento, el cliente acepta una penalización que se le cobra como multa impuesta por Grupo SIMEC de los costos incurridos en el proceso.`;

export const ExportModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'config'>('config');

    const store = useQuoterStore();
    const offerNumber = `${store.currentQuoteId || `APE-${new Date().getFullYear()}-001`}-V${store.currentQuoteVersion || 1}`;

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('open-export-modal', handleOpen);
        return () => window.removeEventListener('open-export-modal', handleOpen);
    }, []);

    if (!isOpen) return null;

    // ─── Build pricing rows ────────────────────────────────────────────
    const marginMultiplier = store.globalMargin >= 100 ? 1 : 1 / (1 - store.globalMargin / 100);
    const totalLaborCost = store.labor.numTechs * store.labor.hours * store.labor.hourlyRate;
    const totalLogisticsCost = store.logistics.perDiem + (store.logistics.mileage * store.logistics.ratePerKm);
    const totalServicesCost = store.services.installation + store.services.startup + (store.services.specialEquipment || 0);

    const rows: { category: string, description: string, qty: number, leadTime: string, unitPrice: number, total: number }[] = [];

    const internationalItems = store.quoteItems.filter(it => !it.isLocalPurchase);
    const totalProjectWeight = internationalItems.reduce((acc, it) => acc + calculateChargeableWeight(it.weight, it.length, it.width, it.height, store.freightType) * it.quantity, 0);
    const totalInternationalItems = internationalItems.reduce((acc, it) => acc + it.quantity, 0);

    store.quoteItems.forEach(item => {
        const isLocal = item.isLocalPurchase;
        const chargeableW = calculateChargeableWeight(item.weight, item.length, item.width, item.height, store.freightType);
        const activeRate = store.freightType === 'AIR' ? store.airRate : store.oceanRate;
        let itemFreight = 0;
        if (!isLocal) {
            if (store.manualFreightTotal !== null) {
                const weightRatio = totalProjectWeight > 0 ? (chargeableW / totalProjectWeight) : (1 / totalInternationalItems);
                itemFreight = store.manualFreightTotal * weightRatio;
            } else {
                itemFreight = calculateFreight(chargeableW, activeRate);
            }
        }
        const insurance = isLocal ? 0 : item.cost * 0.01;
        const cif = item.cost + itemFreight + insurance;
        const taxRates = isLocal ? { dai: 0, selectivo: 0, ley6946: 0, iva: 0 } : getTaxRatesForCategory(item.category, item.taxOverrides);
        const taxes = calculateTaxes(cif, taxRates.dai, taxRates.selectivo, taxRates.ley6946, taxRates.iva);
        const nationalizedCost = cif + taxes.totalTaxes + (item.localFreight || 0);
        const unitSalePrice = nationalizedCost * marginMultiplier;
        rows.push({
            category: 'Equipos',
            description: `${item.brand} ${item.model} - ${item.description}`,
            qty: item.quantity,
            leadTime: item.leadTime || '8-10 semanas',
            unitPrice: unitSalePrice,
            total: unitSalePrice * item.quantity
        });
    });

    const groupedMats = store.localMaterials.filter(m => m.isGrouped);
    if (groupedMats.length > 0) {
        const groupedCost = groupedMats.reduce((acc, m) => acc + (m.quantity * m.unitPrice), 0);
        rows.push({ category: 'Materiales', description: 'Materiales Eléctricos', qty: 1, leadTime: 'Stock', unitPrice: groupedCost * marginMultiplier, total: groupedCost * marginMultiplier });
    }
    store.localMaterials.filter(m => !m.isGrouped).forEach(m => {
        rows.push({ category: 'Materiales', description: m.name, qty: m.quantity, leadTime: m.leadTime || 'Stock', unitPrice: m.unitPrice * marginMultiplier, total: (m.quantity * m.unitPrice) * marginMultiplier });
    });

    const combinedServicesCost = totalLaborCost + totalLogisticsCost + totalServicesCost;
    if (combinedServicesCost > 0) {
        rows.push({ category: 'Servicios', description: 'Instalación, Mano de Obra, Puesta en Marcha y Equipos Especiales', qty: 1, leadTime: 'N/A', unitPrice: combinedServicesCost * marginMultiplier, total: combinedServicesCost * marginMultiplier });
    }

    const finalSubtotal = rows.reduce((acc, row) => acc + row.total, 0);
    const ivaAmount = finalSubtotal * 0.13;
    const finalTotalWithIva = finalSubtotal + ivaAmount;

    const handleCopy = () => {
        const text = rows.map(r => `${r.description}\t${r.qty}\t${r.leadTime}\t${r.unitPrice.toFixed(2)}\t${r.total.toFixed(2)}`).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ─── PDF Generation ─────────────────────────────────────────────────
    const handleExportPDF = async () => {
        const doc = new jsPDF();
        const pageW = 210;
        const pageH = 297;
        const simecBlue: [number, number, number] = [15, 139, 177];
        const darkText: [number, number, number] = [15, 23, 42];
        const grayText: [number, number, number] = [100, 116, 139];

        // ─── Helper: Load image as data URL ──────────
        const loadImageAsDataUrl = (imgUrl: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d')!;
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg'));
                };
                img.onerror = reject;
                img.src = imgUrl;
            });
        };

        // Pre-load logo as JPEG data URL
        let logoDataUrl: string | null = null;
        try {
            logoDataUrl = await loadImageAsDataUrl('/logoSIMEC.jpg');
        } catch(e) {
            console.warn('Could not load logo, using text fallback');
        }

        // ════════════════════════════════════════════════════════════════
        // PAGE 1: COVER PAGE
        // ════════════════════════════════════════════════════════════════
        
        // Background subtle watermark
        doc.setFillColor(245, 247, 250);
        doc.rect(0, 0, pageW, pageH, 'F');
        
        // Logo
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'JPEG', 83, 40, 44, 44);
        } else {
            doc.setFontSize(36);
            doc.setTextColor(...simecBlue);
            doc.setFont("helvetica", "bold");
            doc.text("GRUPO SIMEC", pageW / 2, 70, { align: "center" });
            doc.setFontSize(12);
            doc.setTextColor(...grayText);
            doc.text("INGENIERÍA, PLANIFICACIÓN Y CONSTRUCCIÓN", pageW / 2, 82, { align: "center" });
        }

        // "Proyecto" label
        doc.setFontSize(16);
        doc.setTextColor(...grayText);
        doc.setFont("helvetica", "normal");
        doc.text("Proyecto", pageW / 2, 125, { align: "center" });

        // Blue banner for client name
        doc.setFillColor(...simecBlue);
        doc.rect(20, 132, pageW - 40, 16, 'F');
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(store.clientName || "Nombre del Cliente", pageW / 2, 143, { align: "center" });

        // Project name below
        if (store.projectName) {
            doc.setFontSize(14);
            doc.setTextColor(...darkText);
            doc.setFont("helvetica", "normal");
            doc.text(store.projectName, pageW / 2, 162, { align: "center" });
        }

        // Quote reference
        doc.setFontSize(11);
        doc.setTextColor(...grayText);
        doc.text(`Oferta No. ${offerNumber}`, pageW / 2, 180, { align: "center" });
        doc.setFontSize(10);
        doc.text(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }), pageW / 2, 188, { align: "center" });

        // Footer company info
        doc.setFontSize(10);
        doc.setTextColor(...darkText);
        doc.setFont("helvetica", "bold");
        doc.text("GRUPO SIMEC", pageW / 2, 248, { align: "center" });

        // Bottom blue line
        doc.setDrawColor(...simecBlue);
        doc.setLineWidth(2);
        doc.line(30, 270, pageW - 30, 270);

        // ════════════════════════════════════════════════════════════════
        // PAGE 2+: ECONOMIC OFFER TABLE
        // ════════════════════════════════════════════════════════════════
        doc.addPage();

        const tableBody = rows.map(r => [
            r.description,
            r.qty.toString(),
            r.leadTime,
            `$${r.unitPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
            `$${r.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
        ]);
        
        tableBody.push(["", "", "", "Precio Venta (Subtotal):", `$${finalSubtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
        tableBody.push(["", "", "", "IVA (13%):", `$${ivaAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
        tableBody.push(["", "", "", "Total con IVA:", `$${finalTotalWithIva.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`]);
        
        // Shared header/footer for content pages
        const drawContentHeader = (data: any) => {
            doc.setFillColor(245, 248, 252);
            doc.rect(0, 0, pageW, 38, "F");
            if (logoDataUrl) {
                doc.addImage(logoDataUrl, 'JPEG', 14, 5, 16.5, 16.5);
            } else {
                doc.setFontSize(16);
                doc.setTextColor(...simecBlue);
                doc.setFont("helvetica", "bold");
                doc.text("GRUPO SIMEC", 14, 18);
            }
            // Right side info
            doc.setFontSize(8);
            doc.setTextColor(...grayText);
            doc.setFont("helvetica", "bold");
            doc.text("COTIZACIÓN NO.", 196, 12, { align: "right" });
            doc.setFontSize(11);
            doc.setTextColor(...darkText);
            doc.text(offerNumber, 196, 18, { align: "right" });
            doc.setFontSize(8);
            doc.setTextColor(...grayText);
            doc.text(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }), 196, 25, { align: "right" });
            if (store.clientName) {
                doc.setFontSize(8);
                doc.text(`Cliente: ${store.clientName}`, 196, 32, { align: "right" });
            }
            // Blue line
            doc.setDrawColor(...simecBlue);
            doc.setLineWidth(0.8);
            doc.line(14, 38, 196, 38);
            // Footer
            const pageCount = (doc.internal as any).getNumberOfPages();
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${data.pageNumber} de ${pageCount}`, 196, 289, { align: "right" });
            // Footer line and company
            doc.setDrawColor(210, 215, 223);
            doc.setLineWidth(0.3);
            doc.line(14, 284, 196, 284);
            doc.setFontSize(7);
            doc.text("GRUPO SIMEC", pageW / 2, 289, { align: "center" });
        };

        autoTable(doc, {
            startY: 48,
            head: [['Descripción', 'Cant.', 'Tiempo de Entrega', 'Precio Unitario', 'Precio Total']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: simecBlue, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: 4 },
            bodyStyles: { fontSize: 8.5, textColor: [60, 60, 60], cellPadding: 3.5 },
            columnStyles: {
                0: { cellWidth: 70 },
                3: { halign: 'right' },
                4: { halign: 'right' },
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { top: 48, left: 14, right: 14, bottom: 30 },
            didDrawPage: drawContentHeader
        });

        // ════════════════════════════════════════════════════════════════
        // NEXT SECTION: COMMERCIAL CONDITIONS (user-entered)
        // ════════════════════════════════════════════════════════════════
        if (store.commercialNotes && store.commercialNotes.trim()) {
            let cursorY = (doc as any).lastAutoTable?.finalY || 100;
            if (cursorY + 40 > pageH - 30) {
                doc.addPage();
                drawContentHeader({ pageNumber: (doc.internal as any).getNumberOfPages() });
                cursorY = 48;
            } else {
                cursorY += 10;
            }
            doc.setFontSize(12);
            doc.setTextColor(...simecBlue);
            doc.setFont("helvetica", "bold");
            doc.text("Condiciones Comerciales", 14, cursorY);
            doc.setDrawColor(...simecBlue);
            doc.setLineWidth(0.3);
            doc.line(14, cursorY + 2, 100, cursorY + 2);
            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);
            doc.setFont("helvetica", "normal");
            const condLines = doc.splitTextToSize(store.commercialNotes, 178);
            doc.text(condLines, 14, cursorY + 10);
        }

        // ════════════════════════════════════════════════════════════════
        // NEXT SECTION: NOTES (user-entered, optional)
        // ════════════════════════════════════════════════════════════════
        if (store.offerNotes && store.offerNotes.trim()) {
            let cursorY2 = (doc as any).lastAutoTable?.finalY || 100;
            // Estimate where commercial notes ended
            if (store.commercialNotes && store.commercialNotes.trim()) {
                const condLinesCount = doc.splitTextToSize(store.commercialNotes, 178).length;
                cursorY2 = cursorY2 + 10 + (condLinesCount * 4) + 15;
            }
            if (cursorY2 + 30 > pageH - 30 || cursorY2 < 48) {
                doc.addPage();
                drawContentHeader({ pageNumber: (doc.internal as any).getNumberOfPages() });
                cursorY2 = 48;
            }
            doc.setFontSize(12);
            doc.setTextColor(...simecBlue);
            doc.setFont("helvetica", "bold");
            doc.text("Notas", 14, cursorY2);
            doc.setDrawColor(...simecBlue);
            doc.setLineWidth(0.3);
            doc.line(14, cursorY2 + 2, 40, cursorY2 + 2);
            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);
            doc.setFont("helvetica", "normal");
            const noteLines = doc.splitTextToSize(store.offerNotes, 178);
            doc.text(noteLines, 14, cursorY2 + 10);
        }

        // ════════════════════════════════════════════════════════════════
        // LAST PAGE: TERMS & CONDITIONS (default)
        // ════════════════════════════════════════════════════════════════
        doc.addPage();
        drawContentHeader({ pageNumber: (doc.internal as any).getNumberOfPages() });

        // Logo small + Title
        doc.setFontSize(14);
        doc.setTextColor(...simecBlue);
        doc.setFont("helvetica", "bold");
        doc.text("Términos y condiciones de venta", pageW / 2, 52, { align: "center" });

        doc.setDrawColor(...simecBlue);
        doc.setLineWidth(0.5);
        doc.line(50, 54, pageW - 50, 54);

        // Terms text
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        const termsLines = doc.splitTextToSize(DEFAULT_TERMS, 178);
        
        let termsY = 62;
        const maxY = pageH - 35;
        for (let i = 0; i < termsLines.length; i++) {
            if (termsY > maxY) {
                doc.addPage();
                drawContentHeader({ pageNumber: (doc.internal as any).getNumberOfPages() });
                termsY = 48;
            }
            doc.text(termsLines[i], 14, termsY);
            termsY += 4;
        }

        // Fix page numbers (re-draw footer on all pages)
        const totalPages = (doc.internal as any).getNumberOfPages();
        for (let i = 2; i <= totalPages; i++) {
            doc.setPage(i);
            // Clear old page numbers
            doc.setFillColor(255, 255, 255);
            doc.rect(150, 286, 50, 6, 'F');
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`Página ${i} de ${totalPages}`, 196, 289, { align: "right" });
        }

        doc.save(`Oferta_${offerNumber}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/10 w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-800">Propuesta Comercial</h2>
                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                            <button onClick={() => setActiveTab('config')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'config' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                Configuración
                            </button>
                            <button onClick={() => setActiveTab('preview')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'preview' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                                Vista Previa Tabla
                            </button>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 overflow-auto flex-1 space-y-6">
                    
                    {activeTab === 'config' && (
                        <>
                            {/* Cover Page Info */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Portada de la Oferta
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Nombre del Cliente</label>
                                        <input
                                            value={store.clientName}
                                            onChange={(e) => store.setClientName(e.target.value)}
                                            placeholder="Nombre del cliente..."
                                            className="w-full h-10 px-3 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-700">Nombre del Proyecto</label>
                                        <input
                                            value={store.projectName}
                                            onChange={(e) => store.setProjectName(e.target.value)}
                                            placeholder="Suministro e instalación de..."
                                            className="w-full h-10 px-3 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Commercial Conditions */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">📋 Condiciones Comerciales</label>
                                <textarea
                                    value={store.commercialNotes}
                                    onChange={(e) => store.setCommercialNotes(e.target.value)}
                                    placeholder="Forma de pago, vigencia de la oferta, garantías específicas, condiciones de entrega..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm text-slate-700 resize-y bg-slate-50"
                                />
                                <p className="text-xs text-slate-400">Se incluirá después de la tabla de precios.</p>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">📝 Notas Adicionales</label>
                                <textarea
                                    value={store.offerNotes}
                                    onChange={(e) => store.setOfferNotes(e.target.value)}
                                    placeholder="Notas técnicas, aclaraciones, exclusiones específicas..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm text-slate-700 resize-y bg-slate-50"
                                />
                                <p className="text-xs text-slate-400">Sección de notas libres. Opcional.</p>
                            </div>

                            {/* Terms preview */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 block">📄 Términos y Condiciones de Venta (por defecto)</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-40 overflow-auto text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">
                                    {DEFAULT_TERMS}
                                </div>
                                <p className="text-xs text-slate-400">Estos términos se incluyen automáticamente en la última página del PDF.</p>
                            </div>
                        </>
                    )}

                    {activeTab === 'preview' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 font-semibold text-sm border-b border-slate-200">
                                    <th className="py-3 px-4 rounded-tl-lg">Descripción</th>
                                    <th className="py-3 px-4">Cant.</th>
                                    <th className="py-3 px-4">Tiempo de Entrega</th>
                                    <th className="py-3 px-4 text-right">Precio Unitario</th>
                                    <th className="py-3 px-4 text-right rounded-tr-lg">Precio Total</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700 text-sm">
                                {rows.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="py-3 px-4">
                                            <div className="font-medium">{row.description}</div>
                                            <div className="text-xs text-slate-500">{row.category}</div>
                                        </td>
                                        <td className="py-3 px-4">{row.qty}</td>
                                        <td className="py-3 px-4">{row.leadTime}</td>
                                        <td className="py-3 px-4 text-right font-mono">${row.unitPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td className="py-3 px-4 text-right font-mono font-medium">${row.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={4} className="py-2 px-4 text-right border-b border-slate-200">Precio Venta (Subtotal):</td>
                                    <td className="py-2 px-4 text-right font-mono text-slate-700 border-b border-slate-200">${finalSubtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="py-2 px-4 text-right border-b border-slate-200">IVA (13%):</td>
                                    <td className="py-2 px-4 text-right font-mono text-slate-600 border-b border-slate-200">${ivaAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="py-4 px-4 text-right text-lg">Total con IVA:</td>
                                    <td className="py-4 px-4 text-right font-mono text-xl text-blue-700">${finalTotalWithIva.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                    <button 
                        onClick={handleCopy}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                        {copied ? <Check className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado' : 'Copiar Datos'}
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        className="px-5 py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-sm shadow-blue-500/20"
                    >
                        <Download className="w-4 h-4" />
                        Exportar PDF Completo
                    </button>
                </div>
            </div>
        </div>
    );
};
