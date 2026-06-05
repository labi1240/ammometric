import { Suspense } from 'react';
import CategoryPage from '@/components/CategoryPage';
import { getProducts } from '@/lib/data';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AmmoMetric | Shop In-Stock Ammunition - Compare Prices & Deals',
    description: 'Search and compare prices on thousands of in-stock ammunition options. Find 9mm, 5.56, .223, and more from trusted retailers at the best prices.',
    keywords: ['ammo', 'ammunition', 'bulk ammo', '9mm ammo', '5.56 ammo', 'cheap ammo', 'in-stock ammo', 'ammo deals'],
    openGraph: {
        title: 'AmmoMetric | Shop Ammunition Deals',
        description: 'Compare prices from 100+ vetted retailers instantly. Find the best deals on ammo now.',
        type: 'website',
    }
};
async function AmmoList({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;

    // Parse filters
    const search = typeof params.q === 'string' ? params.q : undefined;
    const brandSlug = params.brands ? (Array.isArray(params.brands) ? params.brands : [params.brands]) : undefined;
    const caliberSlug = params.calibers ? (Array.isArray(params.calibers) ? params.calibers : [params.calibers]) : undefined;
    const grain = params.grains ? (Array.isArray(params.grains) ? params.grains : [params.grains]) : undefined;
    const retailers = params.retailers ? (Array.isArray(params.retailers) ? params.retailers : [params.retailers]) : undefined;

    // Default InStock to TRUE unless explicitly 'false'
    const inStockParam = params.is;
    const inStock = inStockParam === undefined ? true : inStockParam === 'true';

    const toArr = (v: string | string[] | undefined) => v ? (Array.isArray(v) ? v : [v]) : undefined;
    const casing = toArr(params.casings);
    const bulletType = toArr(params.bullet);
    const spec: Record<string, string[]> = {};
    const shotSize = toArr(params.shotsize);
    const shotMaterial = toArr(params.shotmat);
    if (shotSize) spec.shot_size = shotSize;
    if (shotMaterial) spec.shot_material = shotMaterial;

    const sort = typeof params.sort === 'string' ? params.sort : undefined;

    const products = await getProducts('AMMO', 100, 0, {
        search,
        brandSlug,
        caliberSlug,
        grain,
        inStock,
        retailers,
        casing,
        bulletType,
        spec: Object.keys(spec).length ? spec : undefined,
        sort,
    });

    return <CategoryPage kind="AMMO" initialProducts={products} />;
}

export default function AmmoPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading Ammo...</div>}>
            <AmmoList searchParams={searchParams} />
        </Suspense>
    );
}
