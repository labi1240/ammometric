import { Product } from '@/types';

// Canonical site origin used for absolute URLs in structured data.
// (Independent of Next's metadataBase so JSON-LD is always absolute.)
export const SITE_URL = (process.env.SITE_URL || 'https://ammometric.com').replace(/\/$/, '');

/** Resolve a possibly-relative image/path to an absolute URL. */
export function absUrl(path?: string | null): string {
    if (!path) return `${SITE_URL}/no_image.png`;
    if (/^https?:\/\//i.test(path)) return path;
    return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

const KIND_PATH: Record<string, string> = { AMMO: 'ammo', FIREARM: 'firearms', ACCESSORY: 'ammo' };

/**
 * Product + AggregateOffer JSON-LD. Powers price-range / in-stock rich results
 * for price-comparison listings. Returns null when there are no offers (nothing
 * meaningful to mark up).
 */
export function buildProductJsonLd(product: Product): Record<string, unknown> | null {
    const offers = product.offers || [];
    if (offers.length === 0) return null;

    const prices = offers.map((o) => o.price).filter((p) => typeof p === 'number' && p > 0);
    if (prices.length === 0) return null;

    const lowPrice = Math.min(...prices);
    const highPrice = Math.max(...prices);
    const anyInStock = offers.some((o) => o.inStock);
    const path = KIND_PATH[product.kind] || 'ammo';
    const url = `${SITE_URL}/${path}/${product.slug}`;

    const descriptorBits = [product.caliber, product.grain ? `${product.grain}gr` : null, product.type]
        .filter(Boolean)
        .join(' ');
    const description = `Compare prices for ${product.title}${descriptorBits ? ` (${descriptorBits})` : ''} from ${offers.length} retailer${offers.length === 1 ? '' : 's'} on AmmoMetric.`;

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        image: absUrl(product.image),
        description,
        sku: product.id,
        ...(product.brand?.name && product.brand.name !== 'Mixed Brand'
            ? { brand: { '@type': 'Brand', name: product.brand.name } }
            : {}),
        offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'USD',
            lowPrice: lowPrice.toFixed(2),
            highPrice: highPrice.toFixed(2),
            offerCount: offers.length,
            availability: anyInStock
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            offers: offers.map((o) => ({
                '@type': 'Offer',
                priceCurrency: 'USD',
                price: o.price.toFixed(2),
                availability: o.inStock
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                url: o.url,
                ...(o.retailer?.name
                    ? { seller: { '@type': 'Organization', name: o.retailer.name } }
                    : {}),
            })),
        },
    };
}

/** BreadcrumbList JSON-LD from [{name, path}] crumbs (paths relative to origin). */
export function buildBreadcrumbJsonLd(crumbs: { name: string; path: string }[]): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: `${SITE_URL}${c.path}`,
        })),
    };
}

/** Organization JSON-LD for the homepage / brand entity. */
export function buildOrganizationJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'AmmoMetric',
        url: SITE_URL,
        description:
            'Real-time ammunition and firearms price comparison across 100+ vetted retailers.',
    };
}

/** WebSite + SearchAction JSON-LD → enables the Google sitelinks search box. */
export function buildWebsiteJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'AmmoMetric',
        url: SITE_URL,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
}
