// app/firearms/[...slug]/page.tsx
import React, { Suspense } from 'react';
import ProductLoading from '@/components/ProductLoading';
import { notFound } from 'next/navigation';
import {
    getProductBySlug,
    getOffers,
    getPairedProduct,
    getPriceHistory,
    getProducts,
    getCompatibleProducts,
    isValidCaliberSlug,
    isValidBrandSlug,
} from '@/lib/data';
import ProductDetail from '@/components/ProductDetail';
import CategoryPage from '@/components/CategoryPage';
import { getPopularProductSlugs } from '@/lib/data';
import { JsonLd } from '@/components/JsonLd';
import { buildProductJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo';
import { Metadata } from 'next';

// Tiny hybrid prebuild: warm a small set of flagship firearms at build time;
// everything else renders on-demand and is then cached. Keep small to protect
// build minutes. Tune with PRERENDER_FIREARMS (0 disables prebuilding).
export async function generateStaticParams() {
    const limit = Number(process.env.PRERENDER_FIREARMS ?? 50);
    if (limit <= 0) return [];
    const slugs = await getPopularProductSlugs('FIREARM', limit);
    return slugs.map((slug) => ({ slug: [slug] }));
}

// Turn a slug ("smith-wesson") into a human label ("Smith Wesson") for SEO copy.
function slugToLabel(slug: string): string {
    return slug
        .split('-')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
}

// --- Dynamic Metadata Generator ---
export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
    const { slug: segments } = await params;

    if (segments.length === 1) {
        const slug = segments[0];

        // A. Single Product
        const product = await getProductBySlug(slug);
        if (product && product.kind === 'FIREARM') {
            const bestPrice = product.offers?.[0]?.price ? `$${product.offers[0].price}` : 'great prices';

            return {
                title: `${product.title} | AmmoMetric`,
                description: `Buy ${product.title} online. Compare inventory from top gun stores. Best price found: ${bestPrice}.`,
                openGraph: {
                    title: product.title,
                    description: `Find in-stock ${product.title}. Lowest price: ${bestPrice}.`,
                    images: product.image ? [product.image] : [],
                    type: 'article'
                }
            };
        }

        // B. Caliber landing page (e.g. /firearms/9mm)
        if (await isValidCaliberSlug(slug)) {
            const label = slugToLabel(slug);
            return {
                title: `${label} Firearms for Sale | Compare In-Stock Prices - AmmoMetric`,
                description: `Find in-stock ${label} firearms and compare live prices from top gun stores on AmmoMetric.`,
            };
        }

        // C. Brand landing page
        if (await isValidBrandSlug(slug)) {
            const label = slugToLabel(slug);
            return {
                title: `${label} Firearms | Prices & In-Stock Deals - AmmoMetric`,
                description: `Browse ${label} firearms and compare live prices across top retailers on AmmoMetric.`,
            };
        }
    }

    return {
        title: 'Firearm Search | AmmoMetric',
        description: 'Find in-stock firearms at the lowest prices.'
    };
}

export default function FirearmsSmartRoute({ params }: { params: Promise<{ slug: string[] }> }) {
    return (
        <Suspense fallback={<ProductLoading />}>
            <SmartContent params={params} />
        </Suspense>
    );
}

async function SmartContent({ params }: { params: Promise<{ slug: string[] }> }) {
    const { slug: segments } = await params;

    if (segments.length === 1) {
        const slug = segments[0];

        // 1. Try as Product (preserves existing PDPs).
        const product = await getProductBySlug(slug);
        if (product && product.kind === 'FIREARM') {
            const [offers, pairedProduct, priceHistory, compatibleProducts] = await Promise.all([
                getOffers(product.id),
                getPairedProduct(product.id),
                getPriceHistory(product.id),
                getCompatibleProducts(product.id)
            ]);
            const productWithData = { ...product, offers, priceHistory };
            const productLd = buildProductJsonLd(productWithData);
            const breadcrumbLd = buildBreadcrumbJsonLd([
                { name: 'Home', path: '/' },
                { name: 'Firearms', path: '/firearms' },
                { name: product.title, path: `/firearms/${product.slug}` },
            ]);
            return (
                <>
                    <JsonLd data={productLd ? [productLd, breadcrumbLd] : [breadcrumbLd]} />
                    <ProductDetail initialProduct={productWithData} pairedProduct={pairedProduct} compatibleProducts={compatibleProducts} />
                </>
            );
        }

        // 2. Try as a Caliber category landing page.
        if (await isValidCaliberSlug(slug)) {
            const products = await getProducts('FIREARM', 100, 0, { caliberSlug: [slug] });
            if (products.length === 0) notFound(); // Avoid indexing thin/empty pages.
            return (
                <>
                    <JsonLd data={buildBreadcrumbJsonLd([
                        { name: 'Home', path: '/' },
                        { name: 'Firearms', path: '/firearms' },
                        { name: slugToLabel(slug), path: `/firearms/${slug}` },
                    ])} />
                    <CategoryPage kind="FIREARM" initialProducts={products} filters={{ calibers: [slug] }} />
                </>
            );
        }

        // 3. Try as a Brand category landing page.
        if (await isValidBrandSlug(slug)) {
            const products = await getProducts('FIREARM', 100, 0, { brandSlug: [slug] });
            if (products.length === 0) notFound();
            return (
                <>
                    <JsonLd data={buildBreadcrumbJsonLd([
                        { name: 'Home', path: '/' },
                        { name: 'Firearms', path: '/firearms' },
                        { name: slugToLabel(slug), path: `/firearms/${slug}` },
                    ])} />
                    <CategoryPage kind="FIREARM" initialProducts={products} filters={{ brands: [slug] }} />
                </>
            );
        }
    }

    // 4. Fallback
    notFound();
}
