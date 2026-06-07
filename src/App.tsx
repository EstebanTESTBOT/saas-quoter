import { useEffect } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { EquipmentForm } from './components/EquipmentForm';
import { ProjectBuilder } from './components/ProjectBuilder';
import { QuoteSummary } from './components/QuoteSummary';
import { ExportModal } from './components/ExportModal';
import { DatabasesModal } from './components/DatabasesModal';
import { CostAuditModal } from './components/CostAuditModal';
import { useQuoterStore } from './store/useQuoterStore';

function App() {
  const { currentQuoteId, currentQuoteVersion, startNewQuote, createVersion, fetchFromSupabase, fetchQuotesList, quotesList, loadQuoteFromSupabase, saveQuoteToSupabase } = useQuoterStore();
  const offerNumber = `${currentQuoteId}-V${currentQuoteVersion}`;

  useEffect(() => {
    fetchFromSupabase();
    fetchQuotesList();
  }, []);

  const handleSaveDraft = () => {
    const state = useQuoterStore.getState();
    const dataToSave = {
      equipmentDB: state.equipmentDB,
      materialDB: state.materialDB,
      quoteItems: state.quoteItems,
      localMaterials: state.localMaterials,
      labor: state.labor,
      logistics: state.logistics,
      services: state.services,
      globalMargin: state.globalMargin,
      freightOrigin: state.freightOrigin,
      airRate: state.airRate,
      oceanRate: state.oceanRate,
      manualFreightTotal: state.manualFreightTotal
    };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: "application/json" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Draft_${offerNumber}.json`;
    link.click();
  };

  useEffect(() => {
    window.addEventListener('save-draft', handleSaveDraft);
    return () => window.removeEventListener('save-draft', handleSaveDraft);
  }, [offerNumber]);

  return (
    <DashboardLayout>
      <DatabasesModal />
      <CostAuditModal />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Offer Builder</h1>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                {offerNumber}
              </span>
              {quotesList?.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      loadQuoteFromSupabase(e.target.value).then(success => {
                        if (success) alert('¡Cotización cargada de la nube con éxito!');
                      });
                    }
                  }}
                  className="px-3 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-600 font-medium"
                >
                  <option value="">Load from Cloud...</option>
                  {quotesList.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.id} (V{q.version}) - {q.client_name || 'No client'} - {q.project_name || 'No project'}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-1">Configure equipment, import costs, materials and labor.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-databases-modal'))}
              className="px-3 py-2 bg-slate-100 text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm"
              title="View learned DBs"
            >
              Master DB
            </button>
            <button 
              onClick={startNewQuote}
              className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
              title="Reset configuration and increment consecutive ID"
            >
              Start Blank
            </button>
            <button 
              onClick={createVersion}
              className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors shadow-sm"
              title="Keep exact data but increment version for comparison"
            >
              + Version
            </button>
            <button 
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              Save Draft
            </button>
            <button 
              onClick={async () => {
                const res = await saveQuoteToSupabase();
                if (res.success) {
                  alert('¡Cotización guardada en Supabase con éxito!');
                } else {
                  alert(`Error al guardar en la nube: ${res.error}`);
                }
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-500/20 active:scale-95"
            >
              Save to Cloud
            </button>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-export-modal'))}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20 active:scale-95"
            >
              Export Proposal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <EquipmentForm />
            <ProjectBuilder />
          </div>

          <div className="space-y-6 lg:self-start sticky top-24">
            <QuoteSummary />
          </div>
        </div>
        
        <ExportModal />
      </div>
    </DashboardLayout>
  );
}

export default App;
