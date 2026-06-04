import React from 'react';
import { RiFilter3Line, RiRestartLine } from '@remixicon/react';

interface FilterOption {
  label: string;
  value: string; // Added value (slug)
  count: number;
}

interface FilterGroupProps {
  title: string;
  techLabel: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

const FilterGroup: React.FC<FilterGroupProps> = ({ title, techLabel, options, selectedValues, onToggle }) => (
  <div className="mb-8">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h3>
      <span className="text-[9px] font-mono text-slate-300 font-bold">{techLabel}</span>
    </div>
    <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar pr-2">
      {options.map((opt) => {
        const isActive = selectedValues.includes(opt.value); // Check against value (slug)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)} // Toggle value (slug)
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all border shrink-0 ${isActive
              ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
          >
            <span className="truncate pr-2 text-left">{opt.label}</span>
            <span className={`font-mono text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-300'}`}>
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

interface FilterSidebarProps {
  kind: 'FIREARM' | 'AMMO';
  facets: {
    brands: FilterOption[];
    calibers: FilterOption[];
    casings?: FilterOption[];
    actions?: FilterOption[];
    grains?: FilterOption[];
    barrelLengths?: FilterOption[];
    capacities?: FilterOption[];
    bulletTypes?: FilterOption[];
    shotSizes?: FilterOption[];
    shotMaterials?: FilterOption[];
  };
  filters: any;
  setFilters: (f: any) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ kind, facets, filters, setFilters }) => {
  const toggleFilter = (key: string, value: string) => {
    const current = filters[key] || [];
    const next = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [key]: next });
  };

  const clearAll = () => setFilters({});

  return (
    <aside className="w-full lg:w-72 shrink-0">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:sticky lg:top-8 shadow-xs lg:max-h-[85vh] lg:overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900">
            <RiFilter3Line className="size-5" />
            <span className="text-sm font-black uppercase tracking-widest">Parameters</span>
          </div>
          <button
            onClick={clearAll}
            className="text-[10px] font-black text-slate-400 hover:text-red-500 flex items-center gap-1 uppercase tracking-widest transition-colors"
          >
            <RiRestartLine className="size-3.5" /> Reset
          </button>
        </div>


        {/* Availability Toggle */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Availability</h3>
            <span className="text-[9px] font-mono text-slate-300 font-bold">[STOCK_STATUS]</span>
          </div>
          <button
            onClick={() => setFilters({ ...filters, inStock: !filters.inStock })}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all border ${filters.inStock
              ? 'bg-emerald-900/10 border-emerald-500/50 text-emerald-700 shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
          >
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${filters.inStock ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              In Stock Only
            </span>
            <span className={`font-mono text-[10px] ${filters.inStock ? 'text-emerald-600' : 'text-slate-300'}`}>
              {filters.inStock ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <FilterGroup
          title="Manufacturer"
          techLabel="[OEM_SOURCE]"
          options={facets.brands}
          selectedValues={filters.brands || []}
          onToggle={(val) => toggleFilter('brands', val)}
        />

        <FilterGroup
          title="Chambering"
          techLabel={kind === 'FIREARM' ? '[CHAMBER_SPEC]' : '[CALIBER_INDEX]'}
          options={facets.calibers}
          selectedValues={filters.calibers || []}
          onToggle={(val) => toggleFilter('calibers', val)}
        />

        {kind === 'AMMO' && facets.grains && facets.grains.length > 0 && (
          <FilterGroup
            title="Mass (Grain)"
            techLabel="[PROJ_WEIGHT]"
            options={facets.grains}
            selectedValues={filters.grains || []}
            onToggle={(val) => toggleFilter('grains', val)}
          />
        )}

        {kind === 'AMMO' && facets.casings && facets.casings.length > 0 && (
          <FilterGroup
            title="Casing Type"
            techLabel="[CASE_MAT]"
            options={facets.casings}
            selectedValues={filters.casings || []}
            onToggle={(val) => toggleFilter('casings', val)}
          />
        )}

        {kind === 'AMMO' && facets.bulletTypes && facets.bulletTypes.length > 0 && (
          <FilterGroup
            title="Bullet Type"
            techLabel="[PROJ_TYPE]"
            options={facets.bulletTypes}
            selectedValues={filters.bulletType || []}
            onToggle={(val) => toggleFilter('bulletType', val)}
          />
        )}

        {kind === 'AMMO' && facets.shotSizes && facets.shotSizes.length > 0 && (
          <FilterGroup
            title="Shot Size"
            techLabel="[SHOT_SIZE]"
            options={facets.shotSizes}
            selectedValues={filters.shotSize || []}
            onToggle={(val) => toggleFilter('shotSize', val)}
          />
        )}

        {kind === 'AMMO' && facets.shotMaterials && facets.shotMaterials.length > 0 && (
          <FilterGroup
            title="Shot Material"
            techLabel="[SHOT_MAT]"
            options={facets.shotMaterials}
            selectedValues={filters.shotMaterial || []}
            onToggle={(val) => toggleFilter('shotMaterial', val)}
          />
        )}

        {kind === 'FIREARM' && facets.barrelLengths && facets.barrelLengths.length > 0 && (
          <FilterGroup
            title="Barrel Length"
            techLabel="[BARREL_LEN]"
            options={facets.barrelLengths}
            selectedValues={filters.barrelLength || []}
            onToggle={(val) => toggleFilter('barrelLength', val)}
          />
        )}

        {kind === 'FIREARM' && facets.capacities && facets.capacities.length > 0 && (
          <FilterGroup
            title="Capacity"
            techLabel="[MAG_CAP]"
            options={facets.capacities}
            selectedValues={filters.capacity || []}
            onToggle={(val) => toggleFilter('capacity', val)}
          />
        )}

        <div className="mt-10 p-4 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
          <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">
            <span className="text-emerald-500 font-black mr-1">●</span>
            Compliance Filter: Offline
          </p>
        </div>
      </div>
    </aside>
  );
};

export default FilterSidebar;