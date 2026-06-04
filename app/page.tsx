import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// Imports from actions (moved logic here)
import { getCachedHomepageData, searchHomeProducts } from '@/components/home/actions';

// Components
import { HomeView } from '@/components/home/HomeView';
import { FilterSidebar } from '@/components/home/FilterSidebar';
import { ProductList } from '@/components/home/ProductList';
import { HomeSearch } from '@/components/home/HomeSearch';
import { JsonLd } from '@/components/JsonLd';
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from '@/lib/seo';

export const metadata: Metadata = {
    title: 'AmmoMetric | Find In-Stock Guns & Ammo Instantly',
    description: 'The ultimate aggregator for ammunition and firearms. Compare live inventory from 100+ vetted retailers. Scan barcodes or search to find the best deals on AmmoMetric.',
    // Keywords derived from your original code
    keywords: ['AmmoMetric', 'ammo', 'guns', 'firearms', 'price comparison', 'in-stock ammo', '9mm ammo', '5.56 ammo', 'bulk ammo'], 
    openGraph: {
        title: 'AmmoMetric | Real-time Gun & Ammo Search',
        description: 'Compare prices from 100+ retailers instantly.',
        siteName: 'AmmoMetric',
        type: 'website',
    }
};

// Loading Component
function HomeSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-12 w-48 bg-slate-200 rounded mb-4"></div>
                <div className="h-4 w-64 bg-slate-200 rounded"></div>
            </div>
        </div>
    );
}

async function HomeContent(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    const searchParams = await props.searchParams;
    const query = searchParams.q;

    // View State: Search Results
    if (query) {
        const products = await searchHomeProducts(query, 'AMMO');

        return (
            <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand selection:text-white">
                <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                        <React.Suspense>
                            <HomeSearch />
                        </React.Suspense>
                    </div>
                </div>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumbs */}
                    <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
                        <Link href="/" className="hover:text-brand cursor-pointer font-medium">Home</Link>
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-slate-900 font-semibold">Results for "{query}"</span>
                    </div>

                    {/* Navigation Tabs (Static for now, but could be links) */}
                    <div className="flex items-center gap-8 mb-8 border-b border-slate-200 overflow-x-auto">
                        <Link href={`/?q=${query}&tab=ammo`} className="pb-4 text-sm font-bold border-b-2 border-brand text-brand transition-colors whitespace-nowrap">
                            Ammunition
                        </Link>
                        <Link href={`/?q=${query}&tab=firearms`} className="pb-4 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 whitespace-nowrap">
                            Firearms
                        </Link>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8">
                        <FilterSidebar />
                        <ProductList products={products} />
                    </div>
                </main>
            </div>
        );
    }

    // View State: Home Dashboard (Cached)
    // Parallel Data Fetching via Cached Function
    const [
        topBrands,
        topRetailers,
        topHandgunCalibers,
        topRifleCalibers,
        topRimfireCalibers,
        topShotgunCalibers,
        featuredHandgunAmmo,
        featuredRifleAmmo,
        featuredRimfireAmmo,
        featuredShotgunAmmo,
        featuredHandgunFirearms,
        featuredRifleFirearms,
        featuredShotgunFirearms,
        featuredAccessories
    ] = await getCachedHomepageData().catch(e => {
        console.error('Build-time data fetch failed:', e);
        return [[], [], [], [], [], [], [], [], [], [], [], [], [], []];
    });

    return (
        <HomeView
            topBrands={topBrands}
            topRetailers={topRetailers}
            topHandgunCalibers={topHandgunCalibers}
            topRifleCalibers={topRifleCalibers}
            topRimfireCalibers={topRimfireCalibers}
            topShotgunCalibers={topShotgunCalibers}
            featuredHandgunAmmo={featuredHandgunAmmo}
            featuredRifleAmmo={featuredRifleAmmo}
            featuredRimfireAmmo={featuredRimfireAmmo}
            featuredShotgunAmmo={featuredShotgunAmmo}
            featuredHandgunFirearms={featuredHandgunFirearms}
            featuredRifleFirearms={featuredRifleFirearms}
            featuredShotgunFirearms={featuredShotgunFirearms}
            featuredAccessories={featuredAccessories}
        />
    );
}

export default function HomePage(props: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
    return (
        <>
            <JsonLd data={[buildOrganizationJsonLd(), buildWebsiteJsonLd()]} />
            <React.Suspense fallback={<HomeSkeleton />}>
                <HomeContent searchParams={props.searchParams} />
            </React.Suspense>
        </>
    );
}
