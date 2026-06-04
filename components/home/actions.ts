'use server';

import { getProducts, getTopBrands, getTopRetailers, getTopCalibers as getRefTopCalibers } from '@/lib/data';
import { Product as HomeProduct } from './types';
import { Product as DBProduct } from '@/types';
import { cacheLife } from 'next/cache';

export async function searchHomeProducts(query: string, kind: 'AMMO' | 'FIREARM' | 'ACCESSORY' = 'AMMO'): Promise<HomeProduct[]> {
    'use cache';
    cacheLife('minutes');
    try {
        const products = await getProducts(kind, 20, 0, { search: query });

        return products.map((p: any) => mapToHomeProduct(p));
    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    }
}

function mapToHomeProduct(p: DBProduct): HomeProduct {
    // Best Offer Logic
    const bestOffer = p.offers?.[0] || null;
    const bestPrice = bestOffer?.price || 0;

    // Calculate specific fields
    const retailerRating = p.brand?.name ? 5 : 4; // Mock rating if unavailable
    const shippingScore = bestOffer ? (bestOffer.freeShipping ? 10 : 7) : 0;
    const shippingText = bestOffer?.freeShipping ? 'FREE SHIPPING' : (bestOffer?.shippingCost ? `+ $${bestOffer.shippingCost} Ship` : 'Calculate Shipping');

    return {
        id: p.id,
        slug: p.slug,
        name: p.title,
        price: bestPrice,
        retailer: bestOffer?.retailer?.name || 'Unknown Retailer',
        retailerRating: typeof bestOffer?.retailer?.id === 'number' ? 4.8 : 0, // Mock or fetch if available
        image: p.image,
        lastUpdated: 'Just now',
        shippingScore,
        shippingText,
        isSponsored: false,
        brand: p.brand?.name || 'Unknown',
        condition: 'New', // Defaulting for now
        category: (p.kind === 'ACCESSORY' ? 'part' : p.kind.toLowerCase()) as 'ammo' | 'firearm' | 'part',

        // Ammo Specifics
        caliber: p.caliber || p.title.split(' ')[0], // Fallback
        grains: p.grain,
        cpr: bestOffer?.cpr,
        casing: p.casing as any,
        roundCount: bestOffer?.roundCount
    };
}

export async function fetchFeaturedAccessories(limit = 3): Promise<HomeProduct[]> {
    try {
        const products = await getProducts('ACCESSORY', limit, 0, { inStock: true });
        if (products.length > 0) {
            return products.map(mapToHomeProduct);
        }
        // No real accessories found
        return [];
    } catch (e) {
        console.error('Failed to fetch accessories:', e);
        return [];
    }
}

export async function fetchTopBrands() {
    const brands = await getTopBrands(12);
    return brands.map(b => ({
        name: b.name,
        domain: b.slug, // using slug as domain proxy if needed, or website
        logo: b.logo,
        count: b._count.CatalogItem
    }));
}

export async function fetchTopRetailers() {
    const retailers = await getTopRetailers(8);
    return retailers.map(r => ({
        name: r.name,
        domain: r.domain,
        logo: r.logo,
        count: r._count.Offer,
        rating: r.rating || 0
    }));
}

export async function fetchTopCalibers(type: 'handgun' | 'rifle' | 'shotgun' | 'rimfire', limit = 8) {
    try {
        const calibers = await getRefTopCalibers(type, limit);
        return calibers;
    } catch (error) {
        console.error(`Error fetching top ${type} calibers:`, error);
        return [];
    }
}

export async function fetchPreviewProducts(
    kind: 'AMMO' | 'FIREARM',
    category: 'handgun' | 'rifle' | 'shotgun' | 'rimfire'
): Promise<HomeProduct[]> {
    try {
        // 1. Get Top Calibers for this category to ensure relevance
        const topCalibers = await getRefTopCalibers(category, 5);
        const caliberSlugs = topCalibers.map(c => c.slug);

        if (caliberSlugs.length === 0) return [];

        // 2. Fetch products for these calibers
        const products = await getProducts(kind, 3, 0, {
            caliberSlug: caliberSlugs,
            inStock: true
        });

        // 3. Map to HomeProduct
        return products.map(mapToHomeProduct);
    } catch (e) {
        console.error(`Failed to fetch preview for ${kind}/${category}:`, e);
        return [];
    }
}

export async function getCachedHomepageData() {
    'use cache';
    cacheLife('hours');

    return await Promise.all([
        fetchTopBrands(),
        fetchTopRetailers(),
        fetchTopCalibers('handgun'),
        fetchTopCalibers('rifle'),
        fetchTopCalibers('rimfire'),
        fetchTopCalibers('shotgun'),
        // Fetch Featured Products
        fetchPreviewProducts('AMMO', 'handgun'),
        fetchPreviewProducts('AMMO', 'rifle'),
        fetchPreviewProducts('AMMO', 'rimfire'),
        fetchPreviewProducts('AMMO', 'shotgun'),
        fetchPreviewProducts('FIREARM', 'handgun'),
        fetchPreviewProducts('FIREARM', 'rifle'),
        fetchPreviewProducts('FIREARM', 'shotgun'),
        fetchFeaturedAccessories()
    ]);
}
