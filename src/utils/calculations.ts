// ─── TARIFF RATES MAP (SAC - Costa Rica) ──────────────────────────────────────
// Base rates per equipment category. These are editable per-item in the UI.

export type EquipmentCategory = 
  | 'UPS'
  | 'Baterias_Litio'
  | 'Baterias_Plomo'
  | 'Aire_Precision'
  | 'Generador'
  | 'MicroDataCenter'
  | 'Other';

export interface TaxRates {
  dai: number;
  selectivo: number;
  ley6946: number;
  iva: number;
}

export interface TariffInfo {
  label: string;
  sac: string;
  rates: TaxRates;
}

export const TARIFF_MAP: Record<EquipmentCategory, TariffInfo> = {
  UPS: {
    label: 'UPS (Alimentación Ininterrumpida)',
    sac: '8504.40.10',
    rates: { dai: 1, selectivo: 0, ley6946: 1, iva: 13 },
  },
  Baterias_Litio: {
    label: 'Baterías de Litio',
    sac: '8507.60.00',
    rates: { dai: 5, selectivo: 0, ley6946: 1, iva: 13 },
  },
  Baterias_Plomo: {
    label: 'Baterías Plomo Ácido (VRLA)',
    sac: '8507.20.00',
    rates: { dai: 30, selectivo: 0, ley6946: 1, iva: 13 },
  },
  Aire_Precision: {
    label: 'Aire de Precisión',
    sac: '8415.82.00',
    rates: { dai: 15, selectivo: 29.95, ley6946: 1, iva: 13 },
  },
  Generador: {
    label: 'Generador Eléctrico',
    sac: '8502.13.00',
    rates: { dai: 15, selectivo: 14, ley6946: 1, iva: 13 },
  },
  MicroDataCenter: {
    label: 'Micro DataCenter',
    sac: '8471.49.00',
    rates: { dai: 0, selectivo: 0, ley6946: 1, iva: 13 },
  },
  Other: {
    label: 'Otro Equipo',
    sac: '—',
    rates: { dai: 1, selectivo: 0, ley6946: 1, iva: 13 },
  },
};

export const CATEGORY_OPTIONS: { value: EquipmentCategory; label: string }[] = [
  { value: 'UPS', label: 'UPS' },
  { value: 'Baterias_Litio', label: 'Baterías Litio' },
  { value: 'Baterias_Plomo', label: 'Baterías Plomo (VRLA)' },
  { value: 'Aire_Precision', label: 'Aire de Precisión' },
  { value: 'Generador', label: 'Generador' },
  { value: 'MicroDataCenter', label: 'Micro DataCenter' },
  { value: 'Other', label: 'Otro' },
];

/** Get base tax rates for a category. Returns a copy that can be overridden. */
export const getTaxRatesForCategory = (
  category: EquipmentCategory,
  overrides?: Partial<TaxRates>
): TaxRates => {
  const base = { ...TARIFF_MAP[category]?.rates ?? TARIFF_MAP.Other.rates };
  if (overrides) {
    if (overrides.dai !== undefined) base.dai = overrides.dai;
    if (overrides.selectivo !== undefined) base.selectivo = overrides.selectivo;
    if (overrides.ley6946 !== undefined) base.ley6946 = overrides.ley6946;
    if (overrides.iva !== undefined) base.iva = overrides.iva;
  }
  return base;
};

/** Get the SAC code label for a category */
export const getSACCode = (category: EquipmentCategory): string => {
  return TARIFF_MAP[category]?.sac ?? '—';
};

// ─── FREIGHT CALCULATIONS ─────────────────────────────────────────────────────

export const calculateChargeableWeight = (
  realWeight: number,
  length: number,
  width: number,
  height: number,
  type: 'AIR' | 'OCEAN' = 'AIR'
): number => {
  if (type === 'OCEAN') {
    const cbm = (length * width * height) / 1000000;
    const metricTons = realWeight / 1000;
    return Math.max(cbm, metricTons); // Returns Revenue Tons / CBM
  }
  const volumetricWeight = (length * width * height) / 6000;
  return Math.max(realWeight, volumetricWeight); // Returns Kg
};

export const calculateFreight = (
  chargeableWeight: number,
  baseRatePerKg: number
): number => {
  return chargeableWeight * baseRatePerKg;
};

// ─── TAX CALCULATIONS (Cascada tributaria CR) ─────────────────────────────────
// DAI, Selectivo, Ley 6946 are percentages (e.g. 1 means 1%, 10 means 10%)
export const calculateTaxes = (
  cifValue: number,
  daiPercent: number,
  selectivoPercent: number,
  ley6946Percent: number,
  ivaPercent: number = 13
) => {
  const dai = cifValue * (daiPercent / 100);
  
  // Selectivo is calculated over CIF + DAI (cascada)
  const baseSelectivo = cifValue + dai;
  const selectivo = baseSelectivo * (selectivoPercent / 100);
  
  const ley6946 = cifValue * (ley6946Percent / 100);

  const baseIva = cifValue + dai + selectivo + ley6946;
  const iva = baseIva * (ivaPercent / 100);

  return {
    dai,
    selectivo,
    ley6946,
    iva,
    totalTaxes: dai + selectivo + ley6946 + iva,
    baseIva,
  };
};

// ─── SALE PRICE ───────────────────────────────────────────────────────────────
export const calculateSalePrice = (
  totalCost: number,
  marginPercent: number
): number => {
  // If margin is 20%, calculation is Cost / (1 - 0.20)
  if (marginPercent >= 100) return totalCost; // prevent divide by zero or negative
  return totalCost / (1 - marginPercent / 100);
};
