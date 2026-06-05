// app/ammo/[...slug]/page.tsx
import React, { Suspense } from 'react';
import ProductLoading from '@/components/ProductLoading';
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
import { notFound } from 'next/navigation'

// Tiny hybrid prebuild: warm only a small set of flagship products at build
// time for instant LCP. Everything else (and all category pages) renders
// on-demand and is then cached. Keep this small to protect build minutes.
// Tune with PRERENDER_AMMO (0 disables prebuilding entirely).
export async function generateStaticParams() {
    const limit = Number(process.env.PRERENDER_AMMO ?? 50);
    if (limit <= 0) return [];
    const slugs = await getPopularProductSlugs('AMMO', limit);
    return slugs.map((slug) => ({ slug: [slug] }));
}

// Turn a slug ("9mm-luger") into a human label ("9mm Luger") for SEO copy.
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

        // A. Single Product Page
        const product = await getProductBySlug(slug);
        if (product && product.kind === 'AMMO') {
            const bestPrice = product.offers?.[0]?.price ? `$${product.offers[0].price}` : 'low prices';
            const offerCount = product.offers?.length || 0;

            return {
                title: `${product.title} | AmmoMetric`,
                description: `Compare prices for ${product.title}. We found ${offerCount} deals starting at ${bestPrice}. In-stock and ready to ship.`,
                openGraph: {
                    title: product.title,
                    description: `Compare prices from top retailers. Best deal: ${bestPrice}.`,
                    images: product.image ? [product.image] : [],
                    type: 'article'
                }
            };
        }

        // B. Caliber landing page (high-value SEO head term)
        if (await isValidCaliberSlug(slug)) {
            const label = slugToLabel(slug);
            return {
                title: `${label} Ammo for Sale | Compare In-Stock Prices - AmmoMetric`,
                description: `Find the cheapest in-stock ${label} ammunition. Compare live prices from 100+ vetted retailers and find the best deal on AmmoMetric.`,
            };
        }

        // C. Brand landing page
        if (await isValidBrandSlug(slug)) {
            const label = slugToLabel(slug);
            return {
                title: `${label} Ammunition | Prices & In-Stock Deals - AmmoMetric`,
                description: `Browse ${label} ammunition and compare live prices across 100+ retailers. Find in-stock ${label} deals on AmmoMetric.`,
            };
        }
    }

    return {
        title: 'Ammunition Search | AmmoMetric',
        description: 'Find in-stock ammunition at the lowest prices.'
    };
}

export default function AmmoSmartRoute({ params }: { params: Promise<{ slug: string[] }> }) {
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
        if (product && product.kind === 'AMMO') {
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
                { name: 'Ammunition', path: '/ammo' },
                { name: product.title, path: `/ammo/${product.slug}` },
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
            const products = await getProducts('AMMO', 100, 0, { caliberSlug: [slug] });
            if (products.length === 0) notFound(); // Avoid indexing thin/empty pages.
            return (
                <>
                    <JsonLd data={buildBreadcrumbJsonLd([
                        { name: 'Home', path: '/' },
                        { name: 'Ammunition', path: '/ammo' },
                        { name: slugToLabel(slug), path: `/ammo/${slug}` },
                    ])} />
                    <CategoryPage kind="AMMO" initialProducts={products} filters={{ calibers: [slug] }} />
                </>
            );
        }

        // 3. Try as a Brand category landing page.
        if (await isValidBrandSlug(slug)) {
            const products = await getProducts('AMMO', 100, 0, { brandSlug: [slug] });
            if (products.length === 0) notFound();
            return (
                <>
                    <JsonLd data={buildBreadcrumbJsonLd([
                        { name: 'Home', path: '/' },
                        { name: 'Ammunition', path: '/ammo' },
                        { name: slugToLabel(slug), path: `/ammo/${slug}` },
                    ])} />
                    <CategoryPage kind="AMMO" initialProducts={products} filters={{ brands: [slug] }} />
                </>
            );
        }
    }

    // 4. Fallback
    notFound();
}
