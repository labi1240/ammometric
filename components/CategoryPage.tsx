'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Fuse from 'fuse.js';
import { RiSearch2Line, RiLoader4Line, RiFilter3Line, RiCloseLine } from '@remixicon/react';
import { useGlobal } from './GlobalProvider';
import FilterSidebar from './FilterSidebar';
import MarketPulse from './MarketPulse';
import QueryBar from './QueryBar';
import { Product } from '../types';
import ProductCard from './ProductCard';
import AmmoCard from './AmmoCard';
import { useQueryState, parseAsString, parseAsArrayOf, parseAsStringLiteral, parseAsBoolean, parseAsFloat } from 'nuqs';
import { getProducts } from '@/lib/actions';

interface CategoryPageProps {
    initialProducts: Product[];
    kind: 'FIREARM' | 'AMMO';
    filters?: any;
}

const CategoryPage: React.FC<CategoryPageProps> = ({ initialProducts, kind, filters: initialFilters = {} }) => {
    // 1. NUQS State for URL-driven filters
    const [searchQuery, setSearchQuery] = useQueryState('q', parseAsString.withDefault(''));
    const [inStockOnly, setInStockOnly] = useQueryState('is', parseAsBoolean.withDefault(true));

    // 2. Filters State (NUQS + State)
    // We use NUQS for URL syncing but maintain local state for immediate UI feedback/composition
    // Using shallow: false to ensure robust routing and avoid path reset issues
    const [brandsFilter, setBrandsFilter] = useQueryState('brands', parseAsArrayOf(parseAsString).withDefault(initialFilters.brands || []).withOptions({ shallow: false }));
    const [calibersFilter, setCalibersFilter] = useQueryState('calibers', parseAsArrayOf(parseAsString).withDefault(initialFilters.calibers || []).withOptions({ shallow: false }));
    const [grainsFilter, setGrainsFilter] = useQueryState('grains', parseAsArrayOf(parseAsString).withDefault(initialFilters.grains || []).withOptions({ shallow: false }));
    const [casingsFilter, setCasingsFilter] = useQueryState('casings', parseAsArrayOf(parseAsString).withDefault(initialFilters.casings || []).withOptions({ shallow: false }));
    const [barrelLengthFilter, setBarrelLengthFilter] = useQueryState('barrel', parseAsArrayOf(parseAsString).withDefault(initialFilters.barrelLength || []).withOptions({ shallow: false }));
    const [capacityFilter, setCapacityFilter] = useQueryState('capacity', parseAsArrayOf(parseAsString).withDefault(initialFilters.capacity || []).withOptions({ shallow: false }));
    const [bulletTypeFilter, setBulletTypeFilter] = useQueryState('bullet', parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: false }));
    const [shotSizeFilter, setShotSizeFilter] = useQueryState('shotsize', parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: false }));
    const [shotMaterialFilter, setShotMaterialFilter] = useQueryState('shotmat', parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: false }));
    const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('').withOptions({ shallow: false }));
    const [minPrice, setMinPrice] = useQueryState('min', parseAsFloat.withOptions({ shallow: false }));
    const [maxPrice, setMaxPrice] = useQueryState('max', parseAsFloat.withOptions({ shallow: false }));


    const {
        blockedRetailers,
        compareIds,
        toggleCompare
    } = useGlobal();

    // 2. Load More State
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [offset, setOffset] = useState(initialProducts.length);
    const [hasMore, setHasMore] = useState(true);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Sync state with server-side updates
    React.useEffect(() => {
        setProducts(initialProducts);
        setOffset(initialProducts.length);
        setHasMore(initialProducts.length < 200 && initialProducts.length === 100); // Reset hasMore logic? If initial < 100, no more. If 100, maybe more.
    }, [initialProducts]);
    const [isPending, startTransition] = useTransition();

    const handleLoadMore = () => {
        if (products.length >= 200) return;

        startTransition(async () => {
            const spec: Record<string, string[]> = {};
            if (shotSizeFilter?.length) spec.shot_size = shotSizeFilter;
            if (shotMaterialFilter?.length) spec.shot_material = shotMaterialFilter;
            const currentFilters = {
                search: searchQuery || undefined,
                brandSlug: brandsFilter || undefined,
                caliberSlug: calibersFilter || undefined,
                grain: grainsFilter || undefined,
                casing: casingsFilter || undefined,
                bulletType: bulletTypeFilter || undefined,
                spec: Object.keys(spec).length ? spec : undefined,
                sort: sort || undefined,
                inStock: inStockOnly
            };

            const nextBatch = await getProducts(kind, 100, offset, currentFilters); // Fetch 100
            if (nextBatch.length === 0) {
                setHasMore(false);
            } else {
                setProducts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNewProducts = nextBatch.filter(p => !existingIds.has(p.id));
                    const combined = [...prev, ...uniqueNewProducts];
                    // Hard limit 200
                    if (combined.length >= 200) {
                        setHasMore(false);
                        return combined.slice(0, 200);
                    }
                    return combined;
                });
                setOffset(prev => prev + nextBatch.length);
            }
        });
    };

    // Construct Filters object for FilterSidebar compatibility (adapting to existing prop structure)
    const filters = {
        brands: brandsFilter,
        calibers: calibersFilter,
        casings: casingsFilter,
        inStock: inStockOnly,
        grains: grainsFilter,
        barrelLength: barrelLengthFilter,
        capacity: capacityFilter,
        bulletType: bulletTypeFilter,
        shotSize: shotSizeFilter,
        shotMaterial: shotMaterialFilter,
        minPrice,
        maxPrice
    };

    // Adapter to set filters via NUQS
    const setFilters = (newFilters: any) => {
        if (newFilters.brands !== undefined) setBrandsFilter(newFilters.brands.length ? newFilters.brands : null);
        if (newFilters.calibers !== undefined) setCalibersFilter(newFilters.calibers.length ? newFilters.calibers : null);
        if (newFilters.casings !== undefined) setCasingsFilter(newFilters.casings.length ? newFilters.casings : null);
        if (newFilters.inStock !== undefined) setInStockOnly(newFilters.inStock);
        if (newFilters.grains !== undefined) setGrainsFilter(newFilters.grains.length ? newFilters.grains : null);
        if (newFilters.barrelLength !== undefined) setBarrelLengthFilter(newFilters.barrelLength.length ? newFilters.barrelLength : null);
        if (newFilters.capacity !== undefined) setCapacityFilter(newFilters.capacity.length ? newFilters.capacity : null);
        if (newFilters.bulletType !== undefined) setBulletTypeFilter(newFilters.bulletType.length ? newFilters.bulletType : null);
        if (newFilters.shotSize !== undefined) setShotSizeFilter(newFilters.shotSize.length ? newFilters.shotSize : null);
        if (newFilters.shotMaterial !== undefined) setShotMaterialFilter(newFilters.shotMaterial.length ? newFilters.shotMaterial : null);
        if (newFilters.minPrice !== undefined) setMinPrice(newFilters.minPrice);
        if (newFilters.maxPrice !== undefined) setMaxPrice(newFilters.maxPrice);
    };


    // 3. Facets need to be computed on *ALL* potential data if possible, or usually just loaded data.
    // For now, computing on loaded `products`.
    const facets = useMemo(() => {
        const brandsMap = new Map<string, { label: string, count: number }>();
        const calibersMap = new Map<string, { label: string, count: number }>();
        const casingsMap = new Map<string, { label: string, count: number }>();
        const grainsMap = new Map<string, { label: string, count: number }>();
        const barrelLengthMap = new Map<string, { label: string, count: number }>();
        const capacityMap = new Map<string, { label: string, count: number }>();
        const bulletTypeMap = new Map<string, { label: string, count: number }>();
        const shotSizeMap = new Map<string, { label: string, count: number }>();
        const shotMaterialMap = new Map<string, { label: string, count: number }>();
        const bump = (m: Map<string, { label: string, count: number }>, key?: string | null) => {
            if (!key) return;
            const e = m.get(key) || { label: key, count: 0 };
            e.count++; m.set(key, e);
        };

        products.forEach(p => {
            if (!p.brand) return;
            // Brands: Key by slug, store Name
            const brandKey = p.brand.slug;
            const brandEntry = brandsMap.get(brandKey) || { label: p.brand.name, count: 0 };
            brandEntry.count++;
            brandsMap.set(brandKey, brandEntry);

            // Calibers: Key by slug (if available, else name), store Name
            const caliberKey = p.caliberSlug || p.caliber || 'unknown';
            const caliberLabel = p.caliber || 'Unknown';
            if (caliberKey !== 'unknown') {
                const caliberEntry = calibersMap.get(caliberKey) || { label: caliberLabel, count: 0 };
                caliberEntry.count++;
                calibersMap.set(caliberKey, caliberEntry);
            }

            // Casings: Still name-based for now (no slug in schema yet)
            if (p.casing) {
                const casingKey = p.casing; // Using name as slug for now
                const casingEntry = casingsMap.get(casingKey) || { label: p.casing, count: 0 };
                casingEntry.count++;
                casingsMap.set(casingKey, casingEntry);
            }

            // Grains (Ammo)
            if (p.grain) {
                const grainKey = p.grain.toString();
                const grainEntry = grainsMap.get(grainKey) || { label: `${p.grain} gr`, count: 0 };
                grainEntry.count++;
                grainsMap.set(grainKey, grainEntry);
            }

            // Barrel Length (Firearm)
            if (p.barrelLength) {
                const blKey = p.barrelLength;
                const blEntry = barrelLengthMap.get(blKey) || { label: p.barrelLength, count: 0 };
                blEntry.count++;
                barrelLengthMap.set(blKey, blEntry);
            }

            // Capacity (Firearm)
            if (p.capacity) {
                const capKey = p.capacity;
                const capEntry = capacityMap.get(capKey) || { label: p.capacity, count: 0 };
                capEntry.count++;
                capacityMap.set(capKey, capEntry);
            }

            // Ammo spec facets (bullet type is on p.type; shot fields live in the specs blob)
            if (kind === 'AMMO') {
                bump(bulletTypeMap, p.type);
                bump(shotSizeMap, p.specs?.shot_size);
                bump(shotMaterialMap, p.specs?.shot_material);
            }
        });

        const sortFn = (a: any, b: any) => b.count - a.count;

        return {
            brands: Array.from(brandsMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
            calibers: Array.from(calibersMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
            casings: Array.from(casingsMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
            grains: Array.from(grainsMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort((a, b) => parseInt(a.value) - parseInt(b.value)), // Numeric sort for grains
            barrelLengths: Array.from(barrelLengthMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
            capacities: Array.from(capacityMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
            bulletTypes: Array.from(bulletTypeMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
            shotSizes: Array.from(shotSizeMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
            shotMaterials: Array.from(shotMaterialMap.entries()).map(([value, { label, count }]) => ({ label, value, count })).sort(sortFn),
        };
    }, [products, kind]);

    // 4. Filtering Logic (Client-Side on loaded products)
    // 4. Filtering Logic
    // We rely on Server-Side Filtering now. 
    // We ONLY filter Blocked Retailers client-side as that is a user-specific setting not in URL/Server.
    const filteredResults = useMemo(() => {
        let result = products.map(product => {
            const validOffers = product.offers.filter(
                offer => !blockedRetailers.includes(offer.retailer.name)
            );
            return { ...product, offers: validOffers };
        }).filter(product => product.offers.length > 0);

        return result;
    }, [products, blockedRetailers]);

    const floorPrice = useMemo(() => {
        if (filteredResults.length === 0) return undefined;
        const prices = filteredResults.flatMap(p => p.offers.map(o => kind === 'AMMO' ? (o.cpr || 0) : o.price));
        if (prices.length === 0) return undefined;
        const min = Math.min(...prices);
        return kind === 'AMMO' ? `$${min.toFixed(2)}` : `$${min.toLocaleString()}`;
    }, [filteredResults, kind]);

    const liquidity = useMemo(() => {
        if (filteredResults.length === 0) return "0%";
        const inStockCount = filteredResults.filter(p => p.offers.some(o => o.inStock)).length;
        return `${((inStockCount / filteredResults.length) * 100).toFixed(1)}%`;
    }, [filteredResults]);

    const onRemoveFilter = (key: string, val: string) => {
        if (key === 'Availability') setInStockOnly(false);
        if (key === 'brands') setBrandsFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'calibers') setCalibersFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'casings') setCasingsFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'grains') setGrainsFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'barrelLength') setBarrelLengthFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'capacity') setCapacityFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'bulletType') setBulletTypeFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'shotSize') setShotSizeFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'shotMaterial') setShotMaterialFilter(prev => prev.filter(v => v !== val).length ? prev.filter(v => v !== val) : null);
        if (key === 'minPrice') setMinPrice(null);
        if (key === 'maxPrice') setMaxPrice(null);
    };

    return (
        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-10 relative">
            {/* Mobile Filter Toggle */}
            <div className="lg:hidden w-full">
                <button
                    onClick={() => setShowMobileFilters(true)}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-900 font-bold py-3 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
                >
                    <RiFilter3Line className="size-5" />
                    Filters & Parameters
                </button>
            </div>

            {/* Mobile Filter Overlay */}
            {showMobileFilters && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden" onClick={() => setShowMobileFilters(false)}></div>
            )}

            <div className={`
                fixed inset-y-0 left-0 z-50 w-80 bg-white transform transition-transform duration-300 ease-in-out lg:transform-none lg:static lg:w-auto lg:bg-transparent lg:block
                ${showMobileFilters ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-full overflow-y-auto p-6 lg:p-0">
                    <div className="flex items-center justify-between mb-6 lg:hidden">
                        <span className="text-lg font-black uppercase tracking-widest text-slate-900">Filters</span>
                        <button onClick={() => setShowMobileFilters(false)} className="p-2 text-slate-400 hover:text-slate-900">
                            <RiCloseLine className="size-6" />
                        </button>
                    </div>
                    
                    <FilterSidebar
                        kind={kind}
                        facets={facets}
                        filters={filters}
                        setFilters={setFilters}
                    />
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <header className="mb-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
                                {kind === 'FIREARM' ? 'Firearms Index' : 'Ammunition Ledger'}
                            </h1>
                            <p className="text-slate-500 font-medium mt-1">
                                Real-time technical aggregate across {facets.brands.length} manufacturers.
                            </p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <RiSearch2Line className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search caliber, SKU, brand..."
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium shadow-xs focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value || null)}
                            />
                        </div>
                    </div>

                    <MarketPulse
                        count={filteredResults.length}
                        floorPrice={floorPrice}
                        liquidity={liquidity}
                    />

                    <QueryBar
                        filters={filters}
                        onRemove={onRemoveFilter}
                        count={filteredResults.length}
                    />
                </header>

                {/* Sort control */}
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        {filteredResults.length} Results
                    </span>
                    <div className="flex items-center gap-2">
                        <label htmlFor="sort-select" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort</label>
                        <select
                            id="sort-select"
                            value={sort}
                            onChange={(e) => setSort(e.target.value || null)}
                            className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold text-slate-700 shadow-xs focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all cursor-pointer"
                        >
                            {kind === 'AMMO' ? (
                                <>
                                    <option value="">Best Value (¢/round)</option>
                                    <option value="cpr_shipped">Cheapest /Round (Shipped)</option>
                                    <option value="price_asc">Price: Low to High</option>
                                    <option value="price_desc">Price: High to Low</option>
                                    <option value="newest">Newest</option>
                                </>
                            ) : (
                                <>
                                    <option value="">Best Price</option>
                                    <option value="price_desc">Price: High to Low</option>
                                    <option value="newest">Newest</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredResults.map(p => (
                        kind === 'FIREARM'
                            ? <ProductCard
                                key={p.id}
                                firearm={p}
                                isComparing={compareIds.includes(p.id)}
                                onToggleCompare={() => toggleCompare(p.id)}
                            />
                            : <AmmoCard
                                key={p.id}
                                product={p}
                                isComparing={compareIds.includes(p.id)}
                                onToggleCompare={() => toggleCompare(p.id)}
                            />
                    ))}

                    {filteredResults.length === 0 ? (
                        <div className="text-center py-32 bg-white rounded-3xl border border-slate-200 border-dashed">
                            <div className="text-slate-400 mb-4 font-mono text-xs uppercase tracking-[0.3em]">No Assets Found In Index</div>
                            <button onClick={() => { setFilters({}); setSearchQuery(null); }} className="text-sm font-black text-slate-900 uppercase tracking-widest hover:underline">Clear Search Parameters</button>
                        </div>
                    ) : (
                        <div className="mt-8 text-center pb-12">
                            {hasMore && (
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isPending}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                                >
                                    {isPending ? <RiLoader4Line className="size-4 animate-spin" /> : null}
                                    {isPending ? 'Loading...' : 'Scroll More'}
                                </button>
                            )}
                            <div className="text-xs text-slate-400 mt-4 font-medium">
                                Showing {filteredResults.length} assets
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


export default CategoryPage;
