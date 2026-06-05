import prisma from '@/lib/prisma';
import { Product, Offer, Brand, Retailer, PriceHistoryPoint } from '../types';
import { Prisma } from '@prisma/client';
import { cacheLife, cacheTag } from 'next/cache';
import { compatibleAmmoCalibers, compatibleGunCalibers } from './caliber-compat';

// Shared include for fully-mapped product cards/lists.
const PRODUCT_INCLUDE = {
    Brand: true,
    Offer: { include: { Retailer: true }, orderBy: { price: 'asc' as const }, take: 1 },
    FirearmSpecs: { include: { FirearmChamber: { include: { Caliber: true } } } },
    AmmoSpecs: { include: { Caliber: true } },
} satisfies Prisma.CatalogItemInclude;

// ==========================================
// 1. STATIC DATA (Long Cache)
// Specs, Images, Descriptions rarely change.
// ==========================================

export async function getRetailers() {
    "use cache";
    cacheLife("days");

    const retailers = await prisma.retailer.findMany({
        orderBy: { name: 'asc' },
    });
    return retailers;
}

// Matches your "Engineering Profile" - Static Data
export async function getProductBySlug(slug: string): Promise<Product | null> {
    "use cache";
    cacheLife("weeks"); // ✅ Specs/Images cached for weeks

    const item = await prisma.catalogItem.findUnique({
        where: { slug },
        include: {
            Brand: true,
            // ❌ OFFERS REMOVED: Fetched separately via getOffers()
            FirearmSpecs: {
                include: {
                    FirearmChamber: { include: { Caliber: true } }
                }
            },
            AmmoSpecs: {
                include: { Caliber: true }
            }
        }
    });

    if (!item) return null;
    return mapToProduct(item);
}

// Same logic for ID-based fetch - keep it static
export async function getProduct(id: string): Promise<Product | null> {
    "use cache";
    cacheLife("weeks");

    const item = await prisma.catalogItem.findUnique({
        where: { id },
        include: {
            Brand: true,
            // ❌ OFFERS REMOVED
            FirearmSpecs: {
                include: {
                    FirearmChamber: { include: { Caliber: true } }
                }
            },
            AmmoSpecs: {
                include: { Caliber: true }
            }
        }
    });

    if (!item) return null;
    return mapToProduct(item);
}

// ==========================================
// 2. DYNAMIC DATA (Short Cache)
// Prices, Stock Status, Charts update frequently.
// ==========================================

// Matches your "Market Liquidity" - Dynamic Prices
export async function getOffers(itemId: string): Promise<Offer[]> {
    "use cache";
    cacheLife("hours"); // ✅ Updates daily/hourly
    cacheTag(`offers-${itemId}`);

    const offers = await prisma.offer.findMany({
        where: { itemId },
        include: { Retailer: true },
        orderBy: { price: 'asc' }
    });

    return offers.map((offer) => ({
        id: offer.id,
        itemId: offer.itemId,
        retailerId: offer.retailerId,
        url: offer.url,
        inStock: offer.inStock || false,
        price: offer.price,
        shippingCost: offer.shippingCost || 0,
        total: offer.total || offer.price,
        shippingNote: offer.shippingNote,
        freeShipping: offer.freeShipping || false,
        retailer: {
            id: offer.Retailer.id,
            name: offer.Retailer.name,
            domain: offer.Retailer.domain,
            logo: offer.Retailer.logo
        },
        roundCount: offer.unitsCount || undefined,
        cpr: offer.cpr || undefined
    }));
}

// Matches your "Price Flux" Chart
export async function getPriceHistory(itemId: string): Promise<PriceHistoryPoint[]> {
    "use cache";
    cacheLife("hours");

    try {
        // Fast path: read the precomputed daily rollup (offer_price_daily),
        // refreshed by the /api/cron/refresh-price-rollup cron. See
        // prisma/sql/price_history.sql.
        const history = await prisma.$queryRaw<any[]>`
            SELECT day, retailer_name as "retailerName", min_price, min_unit_price
            FROM offer_price_daily
            WHERE item_id = ${itemId}
            ORDER BY day ASC
        `;

        return history.map(point => ({
            time: point.day.toISOString(),
            price: Number(point.min_price),
            unitPrice: point.min_unit_price ? Number(point.min_unit_price) : undefined,
            retailerName: point.retailerName
        }));
    } catch (e) {
        // Fallback: if the materialized view isn't created yet, compute live.
        console.error('price rollup unavailable, falling back to live query:', e);
        try {
            const history = await prisma.$queryRaw<any[]>`
                SELECT
                    date_trunc('day', oh.time) as day,
                    r.name as "retailerName",
                    MIN(oh.price) as min_price,
                    MIN(oh."unitPrice") as min_unit_price
                FROM "OfferHistory" oh
                JOIN "Offer" o ON oh."offerId" = o.id
                JOIN "Retailer" r ON o."retailerId" = r.id
                WHERE o."itemId" = ${itemId}
                GROUP BY day, r.name
                ORDER BY day ASC
            `;

            return history.map(point => ({
                time: point.day.toISOString(),
                price: Number(point.min_price),
                unitPrice: point.min_unit_price ? Number(point.min_unit_price) : undefined,
                retailerName: point.retailerName
            }));
        } catch (fallbackErr) {
            console.error('Error fetching price history:', fallbackErr);
            return [];
        }
    }
}

// ==========================================
// 3. CATALOG & SEARCH (Medium Cache)
// ==========================================

export async function getProducts(
    kind: 'FIREARM' | 'AMMO' | 'ACCESSORY',
    limit = 100,
    skip = 0,
    filters?: {
        search?: string;
        brandSlug?: string[];
        caliberSlug?: string[];
        grain?: string[];
        inStock?: boolean;
        retailers?: string[];
        // Typed ammo spec columns
        bulletType?: string[];
        casing?: string[];
        // Typed firearm spec columns
        action?: string[];
        capacity?: string[];
        // Arbitrary JSONB spec fields (e.g. { shot_size: [...], shot_material: [...] })
        spec?: Record<string, string[]>;
        // Result ordering (see SORT_ORDERS below). Defaults to best CPR then price.
        sort?: string;
    }
): Promise<Product[]> {
    "use cache";
    cacheLife("minutes"); // Brief cache for search results

    const where: Prisma.CatalogItemWhereInput = {
        kind: kind,
    };

    // 1. Text Search
    if (filters?.search) {
        const search = filters.search.trim();
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { Brand: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }
    }

    // 2. Filters
    if (filters?.brandSlug && filters.brandSlug.length > 0) {
        where.Brand = { slug: { in: filters.brandSlug } };
    }

    const offerCriteria: Prisma.OfferWhereInput = {};

    if (filters?.inStock) {
        offerCriteria.inStock = true;
    }

    if (filters?.retailers && filters.retailers.length > 0) {
        offerCriteria.Retailer = { name: { in: filters.retailers } };
    }

    if (Object.keys(offerCriteria).length > 0) {
        where.Offer = { some: offerCriteria };
    } else {
        where.offerCount = { gt: 0 };
    }

    // Spec filters: typed columns + JSONB path filters, per kind.
    if (kind === 'FIREARM') {
        const fsWhere: Prisma.FirearmSpecsWhereInput = {};
        if (filters?.caliberSlug?.length) {
            fsWhere.FirearmChamber = { some: { Caliber: { slug: { in: filters.caliberSlug } } } };
        }
        if (filters?.action?.length) fsWhere.actionType = { in: filters.action };
        if (filters?.capacity?.length) fsWhere.capacity = { in: filters.capacity };
        if (Object.keys(fsWhere).length > 0) where.FirearmSpecs = fsWhere;
    } else {
        const asWhere: Prisma.AmmoSpecsWhereInput = {};
        if (filters?.caliberSlug?.length) asWhere.Caliber = { slug: { in: filters.caliberSlug } };
        if (filters?.grain?.length) {
            const validGrains = filters.grain.map(g => parseInt(g)).filter(n => !isNaN(n));
            if (validGrains.length > 0) asWhere.grain = { in: validGrains };
        }
        if (filters?.bulletType?.length) asWhere.bulletType = { in: filters.bulletType };
        if (filters?.casing?.length) asWhere.casing = { in: filters.casing };
        // JSONB spec fields (shot_size, shot_material, ...): AND across fields, OR within a field.
        if (filters?.spec) {
            const andConds = Object.entries(filters.spec)
                .filter(([, vals]) => vals && vals.length > 0)
                .map(([key, vals]) => ({
                    OR: vals.map((v) => ({ specs: { path: [key], equals: v } })),
                }));
            if (andConds.length > 0) asWhere.AND = andConds as Prisma.AmmoSpecsWhereInput[];
        }
        if (Object.keys(asWhere).length > 0) where.AmmoSpecs = asWhere;
    }

    // Sort options. Postgres ASC defaults to NULLS LAST (unknowns sink), which
    // is what we want for cheapest-first; force NULLS LAST on DESC too.
    const SORT_ORDERS: Record<string, Prisma.CatalogItemOrderByWithRelationInput[]> = {
        cpr: [{ bestCpr: { sort: 'asc', nulls: 'last' } }, { bestPrice: 'asc' }],
        cpr_shipped: [{ bestCprShipped: { sort: 'asc', nulls: 'last' } }, { bestPrice: 'asc' }],
        price_asc: [{ bestPrice: { sort: 'asc', nulls: 'last' } }],
        price_desc: [{ bestPrice: { sort: 'desc', nulls: 'last' } }],
        newest: [{ createdAt: { sort: 'desc', nulls: 'last' } }],
        popular: [{ upvotes: { sort: 'desc', nulls: 'last' } }, { bestCpr: 'asc' }],
    };
    const orderBy = SORT_ORDERS[filters?.sort ?? ''] ?? [{ bestCpr: 'asc' }, { bestPrice: 'asc' }];

    const items = await prisma.catalogItem.findMany({
        where,
        take: limit,
        skip: skip,
        include: {
            Brand: true,
            Offer: {
                include: { Retailer: true },
                orderBy: { price: 'asc' }
            },
            FirearmSpecs: {
                include: {
                    FirearmChamber: { include: { Caliber: true } }
                }
            },
            AmmoSpecs: {
                include: { Caliber: true }
            },
            AccessorySpecs: true
        },
        orderBy
    });

    return items.map(mapToProduct);
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
    if (!ids || ids.length === 0) return [];

    const items = await prisma.catalogItem.findMany({
        where: { id: { in: ids } },
        include: {
            Brand: true,
            Offer: {
                include: { Retailer: true },
                orderBy: { price: 'asc' }
            },
            FirearmSpecs: {
                include: {
                    FirearmChamber: { include: { Caliber: true } }
                }
            },
            AmmoSpecs: {
                include: { Caliber: true }
            }
        }
    });

    return items.map(mapToProduct);
}

// 4. CROSS-SELLS (Medium Cache)
// Kept logic as-is: fetches one best offer for the card display
export async function getPairedProduct(itemId: string): Promise<Product | null> {
    "use cache";
    cacheLife("hours");

    const item = await prisma.catalogItem.findUnique({
        where: { id: itemId },
        include: {
            FirearmSpecs: {
                include: {
                    FirearmChamber: { include: { Caliber: true } }
                }
            },
            AmmoSpecs: {
                include: { Caliber: true }
            }
        }
    });

    if (!item) return null;

    let caliberId: number | undefined;

    if (item.kind === 'FIREARM' && item.FirearmSpecs?.FirearmChamber?.[0]) {
        caliberId = item.FirearmSpecs.FirearmChamber[0].caliberId;
    } else if (item.kind === 'AMMO' && item.AmmoSpecs) {
        caliberId = item.AmmoSpecs.caliberId ?? undefined;
    }

    if (!caliberId) return null;

    const targetKind = item.kind === 'FIREARM' ? 'AMMO' : 'FIREARM';

    let pairedItem = await prisma.catalogItem.findFirst({
        where: {
            kind: targetKind,
            OR: [
                { AmmoSpecs: { caliberId: caliberId } },
                { FirearmSpecs: { FirearmChamber: { some: { caliberId: caliberId } } } }
            ],
            offerCount: { gt: 0 }
        },
        orderBy: [
            { bestPrice: 'asc' },
            { upvotes: 'desc' }
        ],
        include: {
            Brand: true,
            Offer: {
                include: { Retailer: true },
                orderBy: { price: 'asc' },
                take: 1
            },
            FirearmSpecs: {
                include: {
                    FirearmChamber: { include: { Caliber: true } }
                }
            },
            AmmoSpecs: {
                include: { Caliber: true }
            }
        }
    });

    // Fallback logic for combo calibers
    if (!pairedItem && caliberId) {
        const caliber = await prisma.caliber.findUnique({ where: { id: caliberId } });
        if (caliber && caliber.name) {
            const parts: string[] = caliber.name.split(/[,/]/).map(s => s.trim()).filter(Boolean);
            if (parts.length > 1) {
                const constituentCalibers = await prisma.caliber.findMany({
                    where: { name: { in: parts, mode: 'insensitive' } }
                });
                const constituentIds = constituentCalibers.map((c) => c.id);

                if (constituentIds.length > 0) {
                    pairedItem = await prisma.catalogItem.findFirst({
                        where: {
                            kind: targetKind,
                            OR: [
                                { AmmoSpecs: { caliberId: { in: constituentIds } } },
                                { FirearmSpecs: { FirearmChamber: { some: { caliberId: { in: constituentIds } } } } }
                            ],
                            offerCount: { gt: 0 }
                        },
                        orderBy: [
                            { bestPrice: 'asc' },
                            { upvotes: 'desc' }
                        ],
                        include: {
                            Brand: true,
                            Offer: {
                                include: { Retailer: true },
                                orderBy: { price: 'asc' },
                                take: 1
                            },
                            FirearmSpecs: {
                                include: {
                                    FirearmChamber: { include: { Caliber: true } }
                                }
                            },
                            AmmoSpecs: {
                                include: { Caliber: true }
                            }
                        }
                    });
                }
            }
        }
    }

    if (!pairedItem) return null;
    return mapToProduct(pairedItem);
}

// 4b. CROSS-KIND COMPATIBILITY (caliber-based)
// For an AMMO item → compatible firearms; for a FIREARM → compatible ammo.
// Uses canonical caliber + a curated cross-compatibility map (.357/.38, etc.).
export async function getCompatibleProducts(itemId: string, limit = 8): Promise<Product[]> {
    "use cache";
    cacheLife("hours");
    cacheTag(`compat-${itemId}`);

    const item = await prisma.catalogItem.findUnique({
        where: { id: itemId },
        include: {
            AmmoSpecs: { include: { Caliber: true } },
            FirearmSpecs: { include: { FirearmChamber: { include: { Caliber: true } } } },
        },
    });
    if (!item) return [];

    if (item.kind === 'AMMO') {
        const slug = item.AmmoSpecs?.Caliber?.slug;
        if (!slug) return [];
        const gunCalibers = compatibleGunCalibers(slug);
        const guns = await prisma.catalogItem.findMany({
            where: {
                kind: 'FIREARM',
                offerCount: { gt: 0 },
                FirearmSpecs: { FirearmChamber: { some: { Caliber: { slug: { in: gunCalibers } } } } },
            },
            orderBy: [{ upvotes: { sort: 'desc', nulls: 'last' } }, { bestPrice: 'asc' }],
            take: limit,
            include: PRODUCT_INCLUDE,
        });
        return guns.map(mapToProduct);
    }

    if (item.kind === 'FIREARM') {
        const chamberSlugs = (item.FirearmSpecs?.FirearmChamber || [])
            .map((c) => c.Caliber?.slug)
            .filter((s): s is string => !!s);
        if (chamberSlugs.length === 0) return [];
        const ammoCalibers = compatibleAmmoCalibers(chamberSlugs);
        const ammo = await prisma.catalogItem.findMany({
            where: {
                kind: 'AMMO',
                offerCount: { gt: 0 },
                AmmoSpecs: { Caliber: { slug: { in: ammoCalibers } } },
            },
            orderBy: [{ bestCpr: { sort: 'asc', nulls: 'last' } }, { bestPrice: 'asc' }],
            take: limit,
            include: PRODUCT_INCLUDE,
        });
        return ammo.map(mapToProduct);
    }

    return [];
}

// 5. HELPER MAPPERS
function mapToProduct(item: any): Product {
    const brand: Brand = {
        id: item.Brand?.id || 0,
        name: item.Brand?.name || 'Mixed Brand',
        slug: item.Brand?.slug || '',
        logo: item.Brand?.logo || null
    };

    const offers: Offer[] = (item.Offer || []).map((offer: any) => ({
        id: offer.id,
        itemId: offer.itemId,
        retailerId: offer.retailerId,
        url: offer.url,
        inStock: offer.inStock || false,
        price: offer.price,
        shippingCost: offer.shippingCost || 0,
        total: offer.total || offer.price,
        shippingNote: offer.shippingNote,
        freeShipping: offer.freeShipping || false,
        retailer: {
            id: offer.Retailer?.id || 0,
            name: offer.Retailer?.name || 'Mixed Retailer',
            domain: offer.Retailer?.domain || '',
            logo: offer.Retailer?.logo || null
        },
        roundCount: offer.unitsCount || undefined,
        cpr: offer.cpr || undefined
    }));

    const product: Product = {
        id: item.id,
        slug: item.slug,
        kind: item.kind,
        title: item.title,
        image: item.image || '/placeholder.jpg',
        brand: brand,
        offers: offers,
        // Full captured spec sheet (JSONB) for whichever kind applies.
        specs: item.AmmoSpecs?.specs || item.FirearmSpecs?.specs || item.AccessorySpecs?.specs || undefined,
        priceHistory: []
    };

    if (item.kind === 'FIREARM' && item.FirearmSpecs) {
        const specs = item.FirearmSpecs;
        const caliber = specs.FirearmChamber?.[0]?.Caliber;

        product.caliber = caliber?.name || 'Unknown';
        product.caliberSlug = caliber?.slug;
        product.capacity = specs.capacity || undefined;
        product.barrelLength = specs.barrelLengthIn ? `${specs.barrelLengthIn}"` : undefined;
    } else if (item.kind === 'AMMO' && item.AmmoSpecs) {
        const specs = item.AmmoSpecs;

        product.grain = specs.grain || undefined;
        product.gauge = specs.gauge || undefined;
        product.casing = specs.casing || undefined;
        product.velocity = specs.velocity || undefined;
        product.type = specs.bulletType || undefined;
        product.ballisticsData = specs.ballisticsData || undefined;
        product.caliber = specs.Caliber?.name || undefined;
        product.caliberSlug = specs.Caliber?.slug;
    }

    return product;
}

// 6. VALIDATION & TOP LISTS (Static / Long Cache)

export async function isValidCaliberSlug(slug: string): Promise<boolean> {
    "use cache";
    cacheLife("days");
    const count = await prisma.caliber.count({ where: { slug } });
    return count > 0;
}

export async function isValidBrandSlug(slug: string): Promise<boolean> {
    "use cache";
    cacheLife("days");
    const count = await prisma.brand.count({ where: { slug } });
    return count > 0;
}

export async function getTopBrands(limit = 8) {
    "use cache";
    cacheLife("days");
    try {
        const brands = await prisma.brand.findMany({
            take: limit,
            orderBy: { CatalogItem: { _count: 'desc' } },
            include: { _count: { select: { CatalogItem: true } } }
        });
        return brands;
    } catch (e) {
        console.error('Error fetching top brands:', e);
        return [];
    }
}

export async function getTopRetailers(limit = 6) {
    "use cache";
    cacheLife("days");
    try {
        const retailers = await prisma.retailer.findMany({
            take: limit,
            orderBy: { Offer: { _count: 'desc' } },
            include: { _count: { select: { Offer: true } } }
        });
        return retailers;
    } catch (e) {
        console.error('Error fetching top retailers:', e);
        return [];
    }
}

export async function getTopCalibers(
    type: 'handgun' | 'rifle' | 'shotgun' | 'rimfire',
    limit = 8
): Promise<{ name: string; slug: string; count: number }[]> {
    "use cache";
    cacheLife("days");

    const calibers = await prisma.caliber.findMany({
        where: {
            type: type,
            AmmoSpecs: { some: {} }
        },
        include: {
            _count: { select: { AmmoSpecs: true } }
        },
        orderBy: {
            AmmoSpecs: { _count: 'desc' }
        },
        take: limit
    });

    return calibers.map(c => ({
        name: c.name,
        slug: c.slug,
        count: c._count.AmmoSpecs
    }));
}

export async function getPopularProductSlugs(
    kind: 'FIREARM' | 'AMMO',
    limit = 100
): Promise<string[]> {
    "use cache";
    cacheLife("days");

    try {
        const products = await prisma.catalogItem.findMany({
            where: {
                kind: kind,
                offerCount: { gt: 0 } // Only index products with offers
            },
            select: { slug: true },
            orderBy: [
                { bestPrice: 'asc' } // Simple proxy for popularity if views aren't tracked
            ],
            take: limit
        });

        return products.map(p => p.slug);
    } catch (e) {
        console.error(`Error fetching popular ${kind} slugs:`, e);
        return [];
    }
}