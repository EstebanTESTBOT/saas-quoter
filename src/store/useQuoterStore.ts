import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EquipmentCategory, TaxRates } from '../utils/calculations';
import { supabase } from '../lib/supabase';

export interface Equipment {
  model: string;
  brand: string;
  description: string;
  cost: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  category: EquipmentCategory;
  leadTime: string;
  isLocalPurchase?: boolean;
  localFreight?: number;
  // Per-item tax overrides (if user needs to change from category defaults)
  taxOverrides?: Partial<TaxRates>;
}

export interface QuoteItem extends Equipment {
  id: string; // unique instance id
  quantity: number;
}

export interface LocalMaterial {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  isGrouped: boolean;
  leadTime: string;
}

export interface LaborTeam {
  numTechs: number;
  hours: number;
  hourlyRate: number;
}

export interface Logistics {
  perDiem: number;
  mileage: number;
  ratePerKm: number;
}

export interface Services {
  installation: number;
  startup: number;
  specialEquipment: number;
}

interface QuoterState {
  // Sequence Control
  quoteSequence: number;
  currentQuoteId: string;
  currentQuoteVersion: number;
  startNewQuote: () => void;
  createVersion: () => void;

  // Equipment Master (Learning System)
  equipmentDB: Record<string, Equipment>;
  saveToEquipmentDB: (eq: Equipment) => void;
  getEquipmentFromDB: (model: string) => Equipment | undefined;
  
  // Material Master
  materialDB: Record<string, LocalMaterial>;
  saveToMaterialDB: (mat: LocalMaterial) => void;
  
  // Loading Buffers for Database -> Form Workflow
  loadingEquipment: Equipment | null;
  setLoadingEquipment: (eq: Equipment | null) => void;
  loadingMaterial: LocalMaterial | null;
  setLoadingMaterial: (mat: LocalMaterial | null) => void;
  
  // Current Quote State
  quoteItems: QuoteItem[];
  addQuoteItem: (item: QuoteItem) => void;
  removeQuoteItem: (id: string) => void;
  updateQuoteItem: (id: string, updates: Partial<QuoteItem>) => void;
  
  // Project Builder State
  localMaterials: LocalMaterial[];
  addLocalMaterial: (material: LocalMaterial) => void;
  removeLocalMaterial: (id: string) => void;
  updateLocalMaterial: (id: string, updates: Partial<LocalMaterial>) => void;
  
  labor: LaborTeam;
  updateLabor: (updates: Partial<LaborTeam>) => void;
  
  logistics: Logistics;
  updateLogistics: (updates: Partial<Logistics>) => void;
  
  services: Services;
  updateServices: (updates: Partial<Services>) => void;
  
  // Global Settings
  globalMargin: number;
  setGlobalMargin: (margin: number) => void;
  
  freightType: 'AIR' | 'OCEAN';
  setFreightType: (type: 'AIR' | 'OCEAN') => void;
  freightOrigin: 'CHINA' | 'MIAMI';
  setFreightOrigin: (origin: 'CHINA' | 'MIAMI') => void;
  airRate: number;
  setAirRate: (rate: number) => void;
  oceanRate: number;
  setOceanRate: (rate: number) => void;
  
  manualFreightTotal: number | null; // Optional manual override
  setManualFreightTotal: (total: number | null) => void;

  // Commercial Notes & Offer Info
  clientName: string;
  setClientName: (name: string) => void;
  projectName: string;
  setProjectName: (name: string) => void;
  commercialNotes: string;
  setCommercialNotes: (notes: string) => void;
  offerNotes: string;
  setOfferNotes: (notes: string) => void;

  // Supabase sync methods
  fetchFromSupabase: () => Promise<void>;
  saveQuoteToSupabase: () => Promise<{ success: boolean; error?: string }>;
  fetchQuotesList: () => Promise<void>;
  loadQuoteFromSupabase: (id: string) => Promise<boolean>;
  quotesList: Array<{ id: string; version: number; client_name: string; project_name: string; created_at: string }>;

  // Authentication
  isLoggedIn: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

export const useQuoterStore = create<QuoterState>()(
  persist(
    (set, get) => ({
      quoteSequence: 1,
      currentQuoteId: `APE-${new Date().getFullYear()}-001`,
      currentQuoteVersion: 1,
      
      startNewQuote: () => set((state) => {
        const nextSeq = (state.quoteSequence || 1) + 1;
        return {
          quoteSequence: nextSeq,
          currentQuoteId: `APE-${new Date().getFullYear()}-${String(nextSeq).padStart(3, '0')}`,
          currentQuoteVersion: 1,
          quoteItems: [],
          localMaterials: [],
          labor: { numTechs: 1, hours: 0, hourlyRate: 0 },
          logistics: { perDiem: 0, mileage: 0, ratePerKm: 0 },
          services: { installation: 0, startup: 0, specialEquipment: 0 },
          manualFreightTotal: null,
          clientName: '',
          projectName: '',
          commercialNotes: '',
          offerNotes: '',
        };
      }),
      
      createVersion: () => set((state) => ({
        currentQuoteVersion: (state.currentQuoteVersion || 1) + 1
      })),

      equipmentDB: {},
      saveToEquipmentDB: (eq) => {
        set((state) => ({
          equipmentDB: {
            ...state.equipmentDB,
            [eq.model.toUpperCase()]: eq
          }
        }));
        supabase.from('equipment_db').upsert({
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
        }).then(({ error }) => {
          if (error) console.error('Error upserting equipment to Supabase:', error);
        });
      },
      getEquipmentFromDB: (model) => {
        return get().equipmentDB[model.toUpperCase()];
      },
      
      materialDB: {},
      saveToMaterialDB: (mat) => {
        set((state) => ({
          materialDB: {
            ...state.materialDB,
            [mat.name.toUpperCase()]: mat
          }
        }));
        supabase.from('material_db').upsert({
          name: mat.name,
          unit: mat.unit,
          unit_price: mat.unitPrice,
          is_grouped: mat.isGrouped || false,
          lead_time: mat.leadTime
        }, { onConflict: 'name' }).then(({ error }) => {
          if (error) console.error('Error upserting material to Supabase:', error);
        });
      },

      loadingEquipment: null,
      setLoadingEquipment: (eq) => set({ loadingEquipment: eq }),
      loadingMaterial: null,
      setLoadingMaterial: (mat) => set({ loadingMaterial: mat }),
      
      quoteItems: [],
      addQuoteItem: (item) => set((state) => ({ quoteItems: [...state.quoteItems, item] })),
      removeQuoteItem: (id) => set((state) => ({ quoteItems: state.quoteItems.filter(i => i.id !== id) })),
      updateQuoteItem: (id, updates) => set((state) => ({
        quoteItems: state.quoteItems.map(i => i.id === id ? { ...i, ...updates } : i)
      })),
      
      localMaterials: [],
      addLocalMaterial: (material) => set((state) => ({ localMaterials: [...state.localMaterials, material] })),
      removeLocalMaterial: (id) => set((state) => ({ localMaterials: state.localMaterials.filter(i => i.id !== id) })),
      updateLocalMaterial: (id, updates) => set((state) => ({
        localMaterials: state.localMaterials.map(i => i.id === id ? { ...i, ...updates } : i)
      })),
      
      labor: { numTechs: 1, hours: 0, hourlyRate: 0 },
      updateLabor: (updates) => set((state) => ({ labor: { ...state.labor, ...updates } })),
      
      logistics: { perDiem: 0, mileage: 0, ratePerKm: 0 },
      updateLogistics: (updates) => set((state) => ({ logistics: { ...state.logistics, ...updates } })),
      
      services: { installation: 0, startup: 0, specialEquipment: 0 },
      updateServices: (updates) => set((state) => ({ services: { ...state.services, ...updates } })),
      
      globalMargin: 30, // Default 30%
      setGlobalMargin: (margin) => set({ globalMargin: margin }),
      
      freightType: 'AIR',
      setFreightType: (type) => set({ freightType: type }),
      
      freightOrigin: 'CHINA',
      setFreightOrigin: (origin) => set({ freightOrigin: origin }),
      
      airRate: 8.5,
      setAirRate: (rate) => set({ airRate: rate }),
      
      oceanRate: 150,
      setOceanRate: (rate) => set({ oceanRate: rate }),
      
      manualFreightTotal: null,
      setManualFreightTotal: (total) => set({ manualFreightTotal: total }),

      clientName: '',
      setClientName: (name) => set({ clientName: name }),
      projectName: '',
      setProjectName: (name) => set({ projectName: name }),
      commercialNotes: '',
      setCommercialNotes: (notes) => set({ commercialNotes: notes }),
      offerNotes: '',
      setOfferNotes: (notes) => set({ offerNotes: notes }),

      quotesList: [],

      fetchFromSupabase: async () => {
        try {
          const { data: eqData, error: eqErr } = await supabase.from('equipment_db').select('*');
          if (eqErr) throw eqErr;
          
          const newEqDB: Record<string, Equipment> = {};
          eqData?.forEach((row: any) => {
            newEqDB[row.model.toUpperCase()] = {
              model: row.model,
              brand: row.brand,
              description: row.description,
              cost: Number(row.cost),
              weight: Number(row.weight),
              length: Number(row.length),
              width: Number(row.width),
              height: Number(row.height),
              category: row.category,
              leadTime: row.lead_time,
              isLocalPurchase: row.is_local_purchase,
              localFreight: Number(row.local_freight),
              taxOverrides: row.tax_overrides
            };
          });

          const { data: matData, error: matErr } = await supabase.from('material_db').select('*');
          if (matErr) throw matErr;

          const newMatDB: Record<string, LocalMaterial> = {};
          matData?.forEach((row: any) => {
            newMatDB[row.name.toUpperCase()] = {
              id: row.id,
              name: row.name,
              unit: row.unit,
              quantity: 0,
              unitPrice: Number(row.unit_price),
              isGrouped: row.is_grouped,
              leadTime: row.lead_time
            };
          });

          set({ equipmentDB: newEqDB, materialDB: newMatDB });
          console.log('Supabase: Catálogos cargados con éxito.');
        } catch (err) {
          console.error('Error fetching data from Supabase:', err);
        }
      },

      saveQuoteToSupabase: async () => {
        const state = get();
        try {
          const { error } = await supabase.from('quotes').upsert({
            id: state.currentQuoteId,
            version: state.currentQuoteVersion,
            client_name: state.clientName,
            project_name: state.projectName,
            global_margin: state.globalMargin,
            freight_type: state.freightType,
            freight_origin: state.freightOrigin,
            air_rate: state.airRate,
            ocean_rate: state.oceanRate,
            manual_freight_total: state.manualFreightTotal,
            quote_items: state.quoteItems,
            local_materials: state.localMaterials,
            labor: state.labor,
            logistics: state.logistics,
            services: state.services,
            commercial_notes: state.commercialNotes,
            offer_notes: state.offerNotes,
            updated_at: new Date().toISOString()
          });
          
          if (error) throw error;
          
          await state.fetchQuotesList();
          return { success: true };
        } catch (err: any) {
          console.error('Error saving quote to Supabase:', err);
          return { success: false, error: err.message };
        }
      },

      fetchQuotesList: async () => {
        try {
          const { data, error } = await supabase
            .from('quotes')
            .select('id, version, client_name, project_name, created_at')
            .order('created_at', { ascending: false });
          if (error) throw error;
          set({ quotesList: data || [] });
        } catch (err) {
          console.error('Error fetching quotes list:', err);
        }
      },

      loadQuoteFromSupabase: async (id: string) => {
        try {
          const { data, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', id)
            .single();
          if (error) throw error;
          if (data) {
            set({
              currentQuoteId: data.id,
              currentQuoteVersion: data.version,
              clientName: data.client_name || '',
              projectName: data.project_name || '',
              globalMargin: Number(data.global_margin),
              freightType: data.freight_type,
              freightOrigin: data.freight_origin,
              airRate: Number(data.air_rate),
              oceanRate: Number(data.ocean_rate),
              manualFreightTotal: data.manual_freight_total ? Number(data.manual_freight_total) : null,
              quoteItems: data.quote_items || [],
              localMaterials: data.local_materials || [],
              labor: data.labor || { numTechs: 1, hours: 0, hourlyRate: 0 },
              logistics: data.logistics || { perDiem: 0, mileage: 0, ratePerKm: 0 },
              services: data.services || { installation: 0, startup: 0, specialEquipment: 0 },
              commercialNotes: data.commercial_notes || '',
              offerNotes: data.offer_notes || '',
            });
            return true;
          }
          return false;
        } catch (err) {
          console.error('Error loading quote from Supabase:', err);
          return false;
        }
      },

      isLoggedIn: false,
      login: (user: string, pass: string) => {
        const expectedUser = import.meta.env.VITE_APP_USERNAME || 'admin';
        const expectedPass = import.meta.env.VITE_APP_PASSWORD || 'simec2026';
        if (user === expectedUser && pass === expectedPass) {
          set({ isLoggedIn: true });
          return true;
        }
        return false;
      },
      logout: () => set({ isLoggedIn: false }),
    }),
    {
      name: 'saas-quoter-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2 && persistedState) {
          // Migrate old category names to new ones
          const categoryMap: Record<string, string> = {
            'Batteries': 'Baterias_Plomo',
            'batteries': 'Baterias_Plomo',
          };
          if (persistedState.quoteItems) {
            persistedState.quoteItems = persistedState.quoteItems.map((item: any) => ({
              ...item,
              category: categoryMap[item.category] || item.category || 'Other',
            }));
          }
          if (persistedState.equipmentDB) {
            for (const key of Object.keys(persistedState.equipmentDB)) {
              const eq = persistedState.equipmentDB[key];
              if (eq && categoryMap[eq.category]) {
                eq.category = categoryMap[eq.category];
              }
            }
          }
          // Ensure new fields exist
          if (!persistedState.clientName) persistedState.clientName = '';
          if (!persistedState.projectName) persistedState.projectName = '';
          if (!persistedState.commercialNotes) persistedState.commercialNotes = '';
          if (!persistedState.offerNotes) persistedState.offerNotes = '';
        }
        return persistedState;
      },
    }
  )
);
