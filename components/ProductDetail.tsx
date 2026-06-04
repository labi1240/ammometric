'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGlobal } from './GlobalProvider';
import { Product, Offer } from '../types';
import {
  RiCrosshair2Line,
  RiScales3Line,
  RiWindyLine,
  RiShieldCheckLine,
  RiPulseLine,
  RiSettings4Line,
  RiFlashlightLine,
  RiArrowRightLine,
  RiInformationLine,
  RiDonutChartLine,
  RiFileList3Line,
  RiDatabase2Line,
  RiDashboard3Line,
  RiRuler2Line,
  RiStackLine,
  RiExternalLinkLine,
  RiHistoryLine,
  RiArrowRightUpLine,
  RiTimerLine,
  RiCheckboxCircleFill
} from '@remixicon/react';
import dynamic from 'next/dynamic';

// Heavy, below-the-fold widgets — code-split so recharts and the pairing UI
// don't ship in the initial PDP bundle. Both render only after scroll.
const OptimizedBallisticPairing = dynamic(() => import('./OptimizedBallisticPairing'), {
  loading: () => <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />,
});
const PriceHistoryChart = dynamic(() => import('./PriceHistoryChart'), {
  loading: () => <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />,
});

// --- Ballistics Simulation Engine (Ammo Only) ---

interface BallisticsResult {
  range: number;
  drop: number;
  velocity: number;
  energy: number;
  time: number;
}

const calculateBallistics = (
  muzzleVelocity: number,
  bc: number,
  zeroRange: number,
  sightHeight: number,
  grain: number,
  maxRange: number = 600,
  step: number = 50
): BallisticsResult[] => {
  const results: BallisticsResult[] = [];
  const g = 32.174;
  const getEnergy = (v: number) => Math.round((grain * v * v) / 450240);
  const k = 0.00002 / bc;

  for (let r = 0; r <= maxRange; r += step) {
    const rangeFeet = r * 3;
    const time = rangeFeet / (muzzleVelocity * 0.9);
    const velocity = muzzleVelocity / (1 + k * rangeFeet * muzzleVelocity);
    const tZero = (zeroRange * 3) / (muzzleVelocity * 0.9);
    const dropAtZeroRaw = 0.5 * g * Math.pow(tZero, 2) * 12;
    const angleAdj = (dropAtZeroRaw + sightHeight) / (zeroRange * 3);
    const gravityDrop = 0.5 * g * Math.pow(time, 2) * 12;
    const drop = -sightHeight + (angleAdj * rangeFeet * 12) - gravityDrop;

    results.push({
      range: r,
      drop: Number(drop.toFixed(1)),
      velocity: Math.round(velocity),
      energy: getEnergy(velocity),
      time: Number(time.toFixed(3))
    });
  }
  return results;
};

// --- Scientific Charts ---

const ScientificChart: React.FC<{
  data: BallisticsResult[],
  type: 'trajectory' | 'energy',
  zero?: number
}> = ({ data, type, zero }) => {
  const width = 800;
  const height = 400;
  const padding = { top: 40, right: 40, bottom: 60, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const isTraj = type === 'trajectory';
  const lineColor = isTraj ? '#2563eb' : '#ea580c';

  const minVal = Math.min(...data.map(d => isTraj ? d.drop : d.energy));
  const maxVal = Math.max(...data.map(d => isTraj ? d.drop : d.energy), 0);
  const valRange = isTraj ? Math.max(Math.abs(minVal), Math.abs(maxVal), 50) : maxVal * 1.1;

  const yScale = (val: number) => isTraj
    ? padding.top + (chartHeight / 2) - (val / valRange) * (chartHeight / 2)
    : padding.top + chartHeight - (val / valRange) * chartHeight;

  const xScale = (range: number) => padding.left + (range / data[data.length - 1].range) * chartWidth;

  const points = data.map(d => `${xScale(d.range)},${yScale(isTraj ? d.drop : d.energy)}`).join(' ');

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible select-none bg-white font-sans">
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const val = isTraj ? (p - 0.5) * -2 * valRange : valRange * p;
          const y = yScale(val);
          return (
            <React.Fragment key={p}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padding.left - 12} y={y} textAnchor="end" alignmentBaseline="middle" className="text-[10px] fill-slate-400 font-mono font-medium tabular-nums">{Math.round(val)}</text>
            </React.Fragment>
          );
        })}
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x={width / 2} y={height - 15} textAnchor="middle" className="text-[10px] fill-slate-500 font-black uppercase tracking-widest">Target Distance (Yards)</text>
      </svg>
    </div>
  );
};

// --- Reusable UI Elements ---

const TechInput: React.FC<{
  label: string,
  value: number | string,
  onChange: (val: string) => void,
  icon?: React.ElementType
}> = ({ label, value, onChange, icon: Icon }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
    <div className="relative group">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 font-mono shadow-xs focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all outline-none"
      />
      {Icon && <Icon className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />}
    </div>
  </div>
);

import Link from 'next/link';

// ... (existing imports)

const SpecBadge: React.FC<{ label: string; value: string | number; icon: React.ElementType; href?: string }> = ({ label, value, icon: Icon, href }) => {
  const content = (
    <span className={`inline-flex items-center gap-x-2.5 rounded-lg bg-white px-3.5 py-2.5 text-sm ring-1 ring-inset ring-slate-200 shadow-xs ${href ? 'hover:ring-slate-400 hover:bg-slate-50 transition-all cursor-pointer' : ''}`}>
      <Icon className="size-4 shrink-0 text-slate-400" aria-hidden={true} />
      <span className="font-bold text-slate-900">{label}</span>
      <span className="h-4 w-px bg-slate-200" />
      <span className="text-slate-500 font-medium">{value}</span>
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
};

// --- Detail Component ---

const ProductDetail: React.FC<{ initialProduct?: Product, pairedProduct?: Product | null }> = ({ initialProduct, pairedProduct }) => {
  const { compareIds, toggleCompare } = useGlobal();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = initialProduct;

  const [suiteTab, setSuiteTab] = useState<'specs' | 'market' | 'ballistics'>('specs');
  const [velocity, setVelocity] = useState<number>(product?.velocity || 1150);
  const [bc, setBc] = useState<number>(product?.casing ? 0.2 : 0.15); // Simple heuristic
  const [zero, setZero] = useState<number>(50);
  const [sightHeight, setSightHeight] = useState<number>(1.5);
  const [ballisticsView, setBallisticsView] = useState<'traj' | 'energy' | 'card'>('card');

  const simData = useMemo(() => {
    // If we have pre-computed data and the user hasn't modified settings from their defaults (which matches the backend), use it.
    // This offloads the initial heavy calculation to the server-side fetched JSON.
    if (product?.ballisticsData && velocity === product.velocity && bc === (product.casing ? 0.2 : 0.15) && zero === 50 && sightHeight === 1.5) {
      return product.ballisticsData as BallisticsResult[];
    }
    return calculateBallistics(velocity, bc, zero, sightHeight, product?.grain || 115);
  }, [velocity, bc, zero, sightHeight, product?.grain, product?.ballisticsData]);

  const sortedOffers = useMemo(() => {
    if (!product?.offers) return [];
    const isAmmo = product.kind === 'AMMO';
    return [...product.offers].sort((a, b) => {
      // 1. Stock Status
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

      // 2. Ammo: Sort by CPR
      if (isAmmo) {
        // Handle Missing CPR - Fallback to price
        if (!a.cpr && !b.cpr) return a.price - b.price;
        if (!a.cpr) return 1;
        if (!b.cpr) return -1;

        // Handle Suspiciously Low CPR (e.g. data errors < 0.01 like $0.001)
        // We push them to the bottom so they don't become the "Hero" price unless they are the only option
        const aLow = a.cpr < 0.01;
        const bLow = b.cpr < 0.01;
        if (aLow !== bLow) return aLow ? 1 : -1;

        return a.cpr - b.cpr;
      }

      // 3. Firearm/Other: Sort by Price
      return a.price - b.price;
    });
  }, [product]);

  const bestOffer = sortedOffers.length > 0 ? sortedOffers[0] : null;

  // Helper for CPR formatting
  const formatCpr = (val?: number) => {
    if (val === undefined || val === null) return 'N/A';
    if (val < 0.01) return val.toFixed(4); // Show detailed precision for potential errors or micro-ammo
    if (val < 0.10) return val.toFixed(3); // Show 3 decimals for typical rimfire range
    return val.toFixed(2);
  };

  // const pairedProduct = null;
  // useMemo(() => {
  //   if (!product) return null;
  //   return MOCK_PRODUCTS.find(p => p.id !== product.id && p.caliber === product.caliber && p.kind !== product.kind);
  // }, [product]);

  const updatedTime = useMemo(() => {
    if (!product?.id) return 30;
    const hash = product.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 86) + 5; // 5 to 90 minutes
  }, [product?.id]);

  if (!product || !bestOffer) return <div className="p-12 text-center text-slate-500">Product not found.</div>;

  const isAmmo = product.kind === 'AMMO';

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="flex mb-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] gap-2 items-center">
          <Link href="/" className="cursor-pointer hover:text-slate-900 transition-colors">Dashboard</Link>
          <RiArrowRightLine className="size-3" />
          <Link href={isAmmo ? '/ammo' : '/'} className="cursor-pointer hover:text-slate-900 uppercase transition-colors">
            {isAmmo ? 'Ammunition' : 'Firearms'}
          </Link>
          <RiArrowRightLine className="size-3" />
          <span className="text-slate-900 truncate max-w-[200px]">{product.title}</span>
        </nav>

        {/* Hero Product Section */}
        <div className="bg-white rounded-2xl shadow-xs ring-1 ring-slate-900/5 overflow-hidden mb-12">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-2/5 bg-slate-50/50 p-12 flex items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 relative group">
              <img src={product.image} alt={product.title} className="max-h-80 object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-[9px] font-mono text-slate-400 bg-white/80 backdrop-blur-sm px-2 py-1 rounded border border-slate-100 uppercase tracking-widest">
                <RiTimerLine className="size-3" /> [Latency: {updatedTime}m]
              </div>
            </div>
            <div className="p-6 lg:p-14 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4 sm:gap-0">
                <Link
                  href={isAmmo ? `/ammo/${product.brand.slug}` : `/firearms/${product.brand.slug}`}
                  className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  {product.brand.name}
                </Link>
                <div className="self-start sm:self-auto flex items-center gap-2 text-[9px] sm:text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-emerald-100 uppercase tracking-widest">
                  <RiPulseLine className="size-3.5 sm:size-4 animate-pulse" /> Market Active
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 mb-6 sm:mb-10 tracking-tighter leading-tight sm:leading-none">{product.title}</h1>

              <div className="flex flex-wrap gap-3 sm:gap-4 mb-8 sm:mb-12">
                <SpecBadge
                  label="Caliber"
                  value={product.caliber || 'N/A'}
                  icon={RiCrosshair2Line}
                  href={product.caliberSlug ? (isAmmo ? `/ammo/${product.caliberSlug}` : `/firearms/${product.caliberSlug}`) : (product.caliber ? (isAmmo ? `/ammo?q=${encodeURIComponent(product.caliber)}` : `/firearms?q=${encodeURIComponent(product.caliber)}`) : undefined)}
                />
                {isAmmo ? (
                  <>
                    {/* Conditional Mass / Gauge Badge */}
                    {product.grain ? (
                      <SpecBadge
                        label="Mass"
                        value={`${product.grain} GR`}
                        icon={RiScales3Line}
                        href={product.grain ? `/ammo/${product.grain}gr` : undefined}
                      />
                    ) : product.gauge ? (
                      <SpecBadge
                        label="Gauge"
                        value={product.gauge}
                        icon={RiScales3Line}
                        href={undefined} // No gauge filter yet
                      />
                    ) : null}

                    <SpecBadge
                      label="Shell"
                      value={product.casing || 'Brass'}
                      icon={RiShieldCheckLine}
                      href={product.casing ? `/ammo?casings=${product.casing}` : undefined}
                    />
                  </>
                ) : (
                  <>
                    <SpecBadge
                      label="Capacity"
                      value={product.capacity || 'N/A'}
                      icon={RiStackLine}
                      href={product.capacity ? `/firearms?capacity=${encodeURIComponent(product.capacity)}` : undefined}
                    />
                    <SpecBadge
                      label="Barrel"
                      value={product.barrelLength || 'N/A'}
                      icon={RiRuler2Line}
                      href={product.barrelLength ? `/firearms?barrel=${encodeURIComponent(product.barrelLength)}` : undefined}
                    />
                  </>
                )}
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center justify-between pt-8 sm:pt-12 border-t border-slate-100 gap-8 lg:gap-0">
                <div>
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 font-mono">
                    {isAmmo ? '[COST_PER_ROUND]' : '[BASE_VALUATION]'}
                  </p>
                  <div className="flex items-baseline gap-2 sm:gap-3">
                    <span className={`text-4xl sm:text-5xl lg:text-6xl font-black font-mono tracking-tighter ${isAmmo ? 'text-emerald-700' : 'text-slate-900'}`}>
                      ${isAmmo ? formatCpr(bestOffer.cpr) : bestOffer.price.toLocaleString()}
                    </span>
                    {isAmmo && <span className="text-lg sm:text-2xl font-bold text-slate-400 font-mono">/RD</span>}

                    <div className="flex items-center gap-1 text-[9px] sm:text-[11px] font-black text-emerald-600 uppercase tracking-widest font-mono self-end pb-1 sm:pb-2">
                      <RiArrowRightUpLine className="size-3 sm:size-4 -rotate-45" /> (▼ 4.2% vs MSRP)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => document.getElementById('market-liquidity')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full lg:w-auto bg-slate-900 text-white px-6 py-4 sm:px-10 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] sm:text-[11px] shadow-2xl hover:bg-slate-800 transition-all hover:-translate-y-1"
                >
                  Execute Purchase
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Market Liquidity Table */}
        <div id="market-liquidity" className="bg-white rounded-2xl sm:rounded-3xl shadow-xs border border-slate-200 overflow-hidden mb-8 sm:mb-12">
          <div className="px-6 py-4 sm:px-10 sm:py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-0">
            <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] text-slate-900 flex flex-wrap items-center gap-2">
              Current Market Liquidity <span className="text-[9px] font-mono text-slate-400 normal-case tracking-normal">(Sync: {updatedTime}m ago)</span>
            </h3>
            <span className="self-start sm:self-auto text-[9px] sm:text-[10px] font-bold text-slate-400 bg-white px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border border-slate-200 uppercase tracking-widest">{sortedOffers.length} Nodes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="px-4 py-4 sm:px-10 sm:py-6 text-left font-black uppercase tracking-widest text-slate-400 text-[9px] sm:text-[10px]">Source Retailer</th>
                  <th className="hidden sm:table-cell px-4 py-4 sm:px-10 sm:py-6 text-center font-black uppercase tracking-widest text-slate-400 text-[9px] sm:text-[10px]">Status</th>
                  {isAmmo && <th className="hidden md:table-cell px-4 py-4 sm:px-10 sm:py-6 text-right font-black uppercase tracking-widest text-slate-400 text-[9px] sm:text-[10px]">CPR</th>}
                  <th className="px-4 py-4 sm:px-10 sm:py-6 text-right font-black uppercase tracking-widest text-slate-400 text-[9px] sm:text-[10px]">Price</th>
                  <th className="px-4 py-4 sm:px-10 sm:py-6 text-right font-black uppercase tracking-widest text-slate-400 text-[9px] sm:text-[10px]">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {sortedOffers.map((offer, i) => (
                  <tr key={offer.id} className={`group transition-all ${i === 0 ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-4 py-6 sm:px-10 sm:py-8">
                      <div className="flex items-center gap-3 sm:gap-5">
                        <div className="size-8 sm:size-12 shrink-0 bg-white rounded-lg sm:rounded-xl flex items-center justify-center font-black text-slate-400 text-xs sm:text-sm shadow-xs ring-1 ring-slate-100 relative">
                          {offer.retailer.name.charAt(0)}
                          <RiCheckboxCircleFill className="absolute -top-1 -right-1 size-3 sm:size-4 text-emerald-600 fill-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="block font-black text-slate-900 tracking-tight text-sm sm:text-lg truncate max-w-[120px] sm:max-w-none">{offer.retailer.name}</span>
                            <span title="Verified Node" className="shrink-0">
                              <RiCheckboxCircleFill className="size-3 sm:size-4 text-emerald-500" />
                            </span>
                          </div>
                          {i === 0 && (
                            <span className="text-[8px] sm:text-[9px] font-black text-emerald-700 uppercase tracking-widest block mt-0.5">Market Leading Value</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-6 sm:px-10 sm:py-8 text-center">
                      <span className={`inline-flex items-center gap-2 text-[9px] sm:text-[10px] font-black px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border uppercase tracking-widest shadow-xs ${offer.inStock ? 'text-emerald-700 bg-emerald-100/50 border-emerald-200' : 'text-slate-400 bg-slate-100 border-slate-200'}`}>
                        <div className={`size-1.5 rounded-full ${offer.inStock ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} /> {offer.inStock ? 'Active' : 'Exhausted'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-6 sm:px-10 sm:py-8 text-center">
                      <div className="text-[9px] sm:text-[10px] uppercase tracking-tight font-bold font-mono mt-1">
                        {offer.freeShipping ? (
                          <span
                            className="text-emerald-500 cursor-help decoration-dotted underline-offset-2"
                            title={offer.shippingNote || "Free Shipping Verified"}
                          >
                            [FREE_SHIP]
                          </span>
                        ) : offer.shippingCost > 0 ? (
                          <span
                            className="text-slate-400 cursor-help decoration-dotted underline-offset-2"
                            title={offer.shippingNote || "Check retailer site for details"}
                          >
                            [+ ${offer.shippingCost} LOGISTICS]
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {isAmmo && (
                      <td className={`hidden md:table-cell px-4 py-6 sm:px-10 sm:py-8 text-right font-mono text-lg sm:text-xl ${i === 0 ? 'font-black text-emerald-700' : 'font-bold text-slate-600'}`}>
                        ${formatCpr(offer.cpr)}
                      </td>
                    )}
                    <td className="px-4 py-6 sm:px-10 sm:py-8 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-mono text-base sm:text-lg ${i === 0 && !isAmmo ? 'font-black text-emerald-700' : 'font-bold text-slate-900'}`}>
                          ${offer.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        {isAmmo && (
                          <span className="text-[8px] sm:text-[10px] font-mono text-slate-400 font-black uppercase tracking-widest mt-1">
                            [BOX: {offer.roundCount || 50}]
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-6 sm:px-10 sm:py-8 text-right">
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-6 sm:py-3.5 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg ${i === 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/10' : 'bg-slate-100 text-slate-900 hover:bg-slate-900 hover:text-white shadow-slate-900/5'}`}
                      >
                        <span className="hidden sm:inline">Visit Store</span>
                        <span className="sm:hidden">Visit</span>
                        <RiExternalLinkLine className="size-3 sm:size-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Optimized Ballistic Pairing Strip */}
        <OptimizedBallisticPairing pairedProduct={pairedProduct!} />

        {/* Technical Suite Tabs */}
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-lg ring-1 ring-slate-900/5 overflow-hidden">
          <div className="flex border-b border-slate-200 px-4 sm:px-12 bg-slate-50/30 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSuiteTab('specs')}
              className={`py-4 px-4 sm:py-8 sm:px-10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] transition-all border-b-4 relative whitespace-nowrap ${suiteTab === 'specs' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <div className="flex items-center gap-2 sm:gap-3"><RiInformationLine className="size-4 sm:size-5" /> Product Profile</div>
            </button>
            <button
              onClick={() => setSuiteTab('market')}
              className={`py-4 px-4 sm:py-8 sm:px-10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] transition-all border-b-4 relative whitespace-nowrap ${suiteTab === 'market' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <div className="flex items-center gap-2 sm:gap-3"><RiDonutChartLine className="size-4 sm:size-5" /> Market Analytics</div>
            </button>
            {isAmmo && (
              <button
                onClick={() => setSuiteTab('ballistics')}
                className={`py-4 px-4 sm:py-8 sm:px-10 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.25em] transition-all border-b-4 relative whitespace-nowrap ${suiteTab === 'ballistics' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <div className="flex items-center gap-2 sm:gap-3"><RiPulseLine className="size-4 sm:size-5" /> Ballistics Engine</div>
              </button>
            )}
          </div>

          <div className="p-6 sm:p-12 lg:p-20">
            {suiteTab === 'specs' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6 sm:mb-10 flex items-center gap-3 sm:gap-4 tracking-tighter">
                    <RiFileList3Line className="size-6 sm:size-8 text-slate-300" /> Engineering Profile
                  </h3>
                  <p className="text-slate-600 leading-[1.8] font-medium text-lg sm:text-xl mb-8 sm:mb-14">
                    {isAmmo
                      ? `This technical load from ${product.brand.name} is engineered for maximum trajectory consistency. 
                             Propellant charge volumetric precision is monitored at a sub-milligram level to ensure a standard deviation (SD) of <12 FPS.`
                      : `The ${product.title} chassis represents a significant advancement in ergonomic mechanical engineering. 
                             Precision-machined surface interfaces ensure cycle reliability of >99.98% across varying environmental stressors.`
                    }
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-8 lg:gap-y-12">
                    {isAmmo ? [
                      { label: 'Manufacturer', val: product.brand.name },
                      { label: 'Asset Class', val: product.caliber },
                      { label: 'Unit Weight', val: `${product.grain} GR` },
                      { label: 'Muzzle Velocity', val: `${product.velocity} FPS` },
                      { label: 'Casing Interface', val: product.casing || 'Brass' },
                      { label: 'Box Index', val: '50 Unit Node' },
                    ].map(item => (
                      <div key={item.label} className="border-b border-slate-100 pb-4 sm:pb-6">
                        <dt className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 sm:mb-2 font-mono">{item.label}</dt>
                        <dd className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-mono">{item.val}</dd>
                      </div>
                    )) : [
                      { label: 'Manufacturer', val: product.brand.name },
                      { label: 'Caliber Index', val: product.caliber },
                      { label: 'Payload Capacity', val: product.capacity || 'N/A' },
                      { label: 'Barrel Length', val: product.barrelLength || 'N/A' },
                      { label: 'Mechanical Action', val: 'Semi-Automatic' },
                      { label: 'Safety Suite', val: 'Integrated Manual' },
                    ].map(item => (
                      <div key={item.label} className="border-b border-slate-100 pb-4 sm:pb-6">
                        <dt className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 sm:mb-2 font-mono">{item.label}</dt>
                        <dd className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-mono">{item.val}</dd>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl sm:rounded-[3rem] p-8 sm:p-16 border border-slate-200 shadow-inner flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <div>
                    <h4 className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] mb-8 sm:mb-12 flex items-center gap-3 sm:gap-4">
                      <RiDatabase2Line className="size-5 sm:size-6 text-slate-300" /> Technical Assessment Notes
                    </h4>
                    <ul className="space-y-6 sm:space-y-10 text-sm sm:text-base font-medium text-slate-600">
                      <li className="flex gap-4 sm:gap-6">
                        <div className="size-2 sm:size-2.5 rounded-full bg-slate-900 mt-2 sm:mt-2.5 shrink-0" />
                        <p>Manufacturing tolerances verified via optical micrometer to ±0.0001".</p>
                      </li>
                      <li className="flex gap-4 sm:gap-6">
                        <div className="size-2 sm:size-2.5 rounded-full bg-slate-900 mt-2 sm:mt-2.5 shrink-0" />
                        <p>Pressure curves validated against laboratory benchmarks for optimal dwell-time.</p>
                      </li>
                      <li className="flex gap-4 sm:gap-6">
                        <div className="size-2 sm:size-2.5 rounded-full bg-slate-900 mt-2 sm:mt-2.5 shrink-0" />
                        <p>Surface coating tested for corrosion resistance in accelerated environmental chambers.</p>
                      </li>
                    </ul>
                  </div>
                  <div className="mt-12 sm:mt-20 pt-6 sm:pt-10 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-mono gap-4 sm:gap-0">
                    <span>REPORT_ID: {product.id.slice(0, 10)}</span>
                    <span>[SYSTEM_STABLE]</span>
                  </div>
                </div>
              </div>
            )}

            {suiteTab === 'market' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12 mb-12 sm:mb-20">
                  <div className="bg-white p-6 sm:p-12 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-xs ring-1 ring-slate-900/5">
                    <span className="text-[9px] sm:text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] font-mono">[90D_BENCHMARK]</span>
                    <div className="text-3xl sm:text-5xl font-black text-slate-900 font-mono mt-3 sm:mt-4 tracking-tighter">
                      {isAmmo ? `$${formatCpr(bestOffer.cpr)}` : `$${bestOffer.price.toLocaleString()}`}
                    </div>
                    <div className="mt-3 sm:mt-5 text-[9px] sm:text-[11px] font-bold text-emerald-600 flex items-center gap-2 uppercase tracking-[0.2em]">
                      <RiArrowRightUpLine className="size-4 sm:size-5 -rotate-45" /> Asset Value: Stable
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 sm:p-12 rounded-2xl sm:rounded-[3rem] border border-slate-200 ring-1 ring-slate-900/5 shadow-inner">
                    <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 font-mono mb-3 sm:mb-4 block">
                      {product.grain ? 'UNIT WEIGHT' : 'BORE DIAMETER'}
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tighter">
                      {product.grain ? `${product.grain} GR` : (product.gauge || product.caliber || 'N/A')}
                    </div>
                  </div>
                  <div className="bg-white p-6 sm:p-12 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-xs ring-1 ring-slate-900/5">
                    <span className="text-[9px] sm:text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] font-mono">[MARKET_DEPTH]</span>
                    <div className="text-3xl sm:text-5xl font-black text-slate-900 font-mono mt-3 sm:mt-4 tracking-tighter">{product.offers.length} Nodes</div>
                    <div className="mt-3 sm:mt-5 text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Global Index Tracked</div>
                  </div>
                  <div className="bg-white p-6 sm:p-12 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-xs ring-1 ring-slate-900/5">
                    <span className="text-[9px] sm:text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] font-mono">[VOLATILITY_INDEX]</span>
                    <div className="text-3xl sm:text-5xl font-black text-emerald-600 font-mono mt-3 sm:mt-4 tracking-tighter">Low</div>
                    <div className="mt-3 sm:mt-5 text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Category: {product.kind}</div>
                  </div>
                </div>
                <div className="bg-slate-50/50 p-6 sm:p-16 rounded-2xl sm:rounded-[4rem] border border-slate-200 min-h-[400px] sm:min-h-[560px] flex flex-col relative overflow-hidden shadow-inner">
                  <h3 className="text-[10px] sm:text-[12px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 sm:mb-12 font-mono">TRANSACTION_FLOW_VISUALIZATION</h3>
                  <div className="flex-1 w-full overflow-x-auto">
                    <PriceHistoryChart data={product.priceHistory || []} isAmmo={isAmmo} />
                    <div className="mt-8 text-center">
                      <p className="text-[10px] sm:text-xs text-slate-400 font-medium max-w-[320px] mx-auto leading-relaxed italic">
                        Financial aggregates are compiled from verified retailer endpoints every 240 seconds. Historical trends represent daily minimum valuations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isAmmo && suiteTab === 'ballistics' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-4 space-y-8 sm:space-y-16">
                  <div>
                    <h4 className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] mb-8 sm:mb-12 flex items-center gap-3 sm:gap-4 font-mono">
                      <RiSettings4Line className="size-6 sm:size-7 text-slate-300" /> [PHYSICS_CONTROLS]
                    </h4>
                    <div className="space-y-6 sm:space-y-10">
                      <TechInput label="Muzzle Velocity (FPS)" value={velocity} onChange={(v) => setVelocity(Number(v))} icon={RiFlashlightLine} />
                      <TechInput label="Ballistic Coeff (G1)" value={bc} onChange={(v) => setBc(Number(v))} icon={RiWindyLine} />
                      <div className="grid grid-cols-2 gap-4 sm:gap-8">
                        <TechInput label="Zero Range" value={zero} onChange={(v) => setZero(Number(v))} />
                        <TechInput label="Sight Height" value={sightHeight} onChange={(v) => setSightHeight(Number(v))} />
                      </div>
                    </div>
                  </div>
                  <div className="pt-8 sm:pt-12 border-t border-slate-200">
                    <button className="w-full bg-slate-900 text-white py-4 sm:py-6 rounded-2xl sm:rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] sm:text-[11px] shadow-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-slate-900/10 font-mono">
                      RECOMPUTE_MODEL
                    </button>
                  </div>
                  <div className="bg-slate-50 p-6 sm:p-12 rounded-2xl sm:rounded-[3rem] border border-slate-200 ring-1 ring-slate-900/5 shadow-inner">
                    <div className="flex items-center gap-3 mb-4 sm:mb-6 text-slate-500">
                      <RiDashboard3Line className="size-5 sm:size-6" />
                      <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest font-mono">SIM_CONSTRAINTS</span>
                    </div>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 leading-relaxed italic">
                      Derived using G1 drag curves in sea-level ISA conditions. Actual trajectory results will vary with altitude, barometric pressure, and humidity.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-8 flex flex-col gap-8 sm:gap-12">
                  <div className="flex bg-slate-100 p-1 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200 self-start shadow-inner ring-1 ring-slate-900/5 overflow-x-auto max-w-full">
                    <button
                      onClick={() => setBallisticsView('card')}
                      className={`px-6 py-3 sm:px-10 sm:py-4 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] transition-all font-mono whitespace-nowrap ${ballisticsView === 'card' ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      RANGE_CARD
                    </button>
                    <button
                      onClick={() => setBallisticsView('traj')}
                      className={`px-6 py-3 sm:px-10 sm:py-4 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] transition-all font-mono whitespace-nowrap ${ballisticsView === 'traj' ? 'bg-white text-blue-700 shadow-md ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      TRAJECTORY
                    </button>
                    <button
                      onClick={() => setBallisticsView('energy')}
                      className={`px-6 py-3 sm:px-10 sm:py-4 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] transition-all font-mono whitespace-nowrap ${ballisticsView === 'energy' ? 'bg-white text-orange-700 shadow-md ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      ENERGY_FLUX
                    </button>
                  </div>

                  <div className="flex-1 min-h-[400px] sm:min-h-[640px]">
                    {ballisticsView === 'card' ? (
                      <div className="bg-white rounded-2xl sm:rounded-[3rem] border border-slate-200 overflow-hidden shadow-xs ring-1 ring-slate-900/5">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse font-mono text-xs">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="px-4 py-4 sm:px-10 sm:py-7 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-900 border-r border-slate-200 whitespace-nowrap">Range (Yds)</th>
                                <th className="px-4 py-4 sm:px-10 sm:py-7 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-900 border-r border-slate-200 whitespace-nowrap">Drop (In)</th>
                                <th className="px-4 py-4 sm:px-10 sm:py-7 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-900 border-r border-slate-200 whitespace-nowrap">Vel (FPS)</th>
                                <th className="px-4 py-4 sm:px-10 sm:py-7 font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-900 whitespace-nowrap">Eng (Ft-Lb)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {simData.map((row, i) => (
                                <tr key={i} className={`group ${i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'} hover:bg-slate-100 transition-colors`}>
                                  <td className="px-4 py-4 sm:px-10 sm:py-6 font-bold text-slate-900 border-r border-slate-100 tabular-nums text-xs sm:text-sm">
                                    {row.range}
                                    {row.range === zero && <span className="ml-2 sm:ml-5 inline-block px-2 py-0.5 sm:px-3 sm:py-1 bg-slate-900 text-white text-[8px] sm:text-[9px] rounded uppercase font-black tracking-[0.2em] shadow-xs">Zero</span>}
                                  </td>
                                  <td className={`px-4 py-4 sm:px-10 sm:py-6 font-black border-r border-slate-100 tabular-nums text-xs sm:text-sm ${row.drop < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                    {row.drop > 0 ? '+' : ''}{row.drop.toFixed(1)}"
                                  </td>
                                  <td className="px-4 py-4 sm:px-10 sm:py-6 text-slate-600 border-r border-slate-100 tabular-nums font-bold text-xs sm:text-sm">{row.velocity.toLocaleString()}</td>
                                  <td className="px-4 py-4 sm:px-10 sm:py-6 text-slate-600 tabular-nums font-bold text-xs sm:text-sm">{row.energy.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                          <ScientificChart data={simData} type={ballisticsView === 'traj' ? 'trajectory' : 'energy'} zero={zero} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;