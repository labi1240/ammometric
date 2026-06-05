import { Suspense } from 'react';
import CategoryPage from '@/components/CategoryPage';
import { getProducts } from '@/lib/data';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AmmoMetric | Shop Firearms - Handguns, Rifles, Shotguns & More',
    description: 'Find in-stock firearms from top retailers. Compare prices on pistols, rifles, shotguns, and more. Real-time inventory from 100+ stores.',
    keywords: ['firearms', 'guns', 'pistols', 'rifles', 'shotguns', 'buy guns online', 'gun deals', 'in-stock firearms'],
    openGraph: {
        title: 'AmmoMetric | Shop Firearm Deals',
        description: 'Compare prices from 100+ vetted retailers instantly. Find the best deals on firearms now.',
        type: 'website',
    }
};

async function FirearmList({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;

    // Parse filters
    const search = typeof params.q === 'string' ? params.q : undefined;
    const brandSlug = params.brands ? (Array.isArray(params.brands) ? params.brands : [params.brands]) : undefined;
    const caliberSlug = params.calibers ? (Array.isArray(params.calibers) ? params.calibers : [params.calibers]) : undefined;
    const retailers = params.retailers ? (Array.isArray(params.retailers) ? params.retailers : [params.retailers]) : undefined;

    // Default InStock to TRUE unless explicitly 'false'
    const inStockParam = params.is;
    const inStock = inStockParam === undefined ? true : inStockParam === 'true';

    const sort = typeof params.sort === 'string' ? params.sort : undefined;

    const products = await getProducts('FIREARM', 100, 0, {
        search,
        brandSlug,
        caliberSlug,
        inStock,
        retailers,
        sort,
    });

    return <CategoryPage kind="FIREARM" initialProducts={products} />;
}

export default function FirearmsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading Firearms...</div>}>
            <FirearmList searchParams={searchParams} />
        </Suspense>
    );
}
