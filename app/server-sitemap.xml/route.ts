import { getServerSideSitemap, ISitemapField } from 'next-sitemap'
import prisma from '@/lib/prisma'
import { cacheLife } from 'next/cache'

const baseUrl = process.env.SITE_URL || 'https://www.ammometric.com'

// Encode each path segment safely (handles "&", spaces, etc. in slugs).
const safeSlug = (slug: string) =>
    slug.split('/').map((s) => encodeURIComponent(s)).join('/')

// Build the full field list once and cache it for a day. The previous version
// ran a 45k-row query (plus brands + calibers) on EVERY request to the sitemap,
// which is a real cost + timeout risk on each crawl. The data changes slowly,
// so a daily cache is plenty fresh.
async function getSitemapFields(): Promise<ISitemapField[]> {
    'use cache'
    cacheLife('days')

    const [products, ammoBrands, firearmBrands, ammoCalibers, firearmCalibers] =
        await Promise.all([
            // Products (Google limit is 50k/file; leave room for the rest).
            prisma.catalogItem.findMany({
                where: { offerCount: { gt: 0 } },
                select: { slug: true, kind: true, updatedAt: true },
                take: 45000,
            }),
            // Brands that actually have in-catalog AMMO / FIREARM products.
            prisma.brand.findMany({
                where: { CatalogItem: { some: { kind: 'AMMO', offerCount: { gt: 0 } } } },
                select: { slug: true },
            }),
            prisma.brand.findMany({
                where: { CatalogItem: { some: { kind: 'FIREARM', offerCount: { gt: 0 } } } },
                select: { slug: true },
            }),
            // Calibers that actually have ammo / firearm products.
            prisma.caliber.findMany({
                where: { AmmoSpecs: { some: { CatalogItem: { offerCount: { gt: 0 } } } } },
                select: { slug: true },
            }),
            prisma.caliber.findMany({
                where: { FirearmChamber: { some: { FirearmSpecs: { CatalogItem: { offerCount: { gt: 0 } } } } } },
                select: { slug: true },
            }),
        ])

    const fields: ISitemapField[] = []

    // Product detail pages.
    for (const p of products) {
        if (!p.slug) continue
        fields.push({
            loc: `${baseUrl}/${p.kind === 'AMMO' ? 'ammo' : 'firearms'}/${safeSlug(p.slug)}`,
            lastmod: p.updatedAt?.toISOString(),
            changefreq: 'daily',
            priority: 0.7,
        })
    }

    // Category landing pages — only emit the kind that has products, so we
    // never feed Google a URL that 404s (or renders thin/empty).
    const pushCategory = (path: 'ammo' | 'firearms', slug: string, priority: number) =>
        fields.push({
            loc: `${baseUrl}/${path}/${safeSlug(slug)}`,
            changefreq: 'weekly',
            priority,
        })

    for (const c of ammoCalibers) if (c.slug) pushCategory('ammo', c.slug, 0.6)
    for (const c of firearmCalibers) if (c.slug) pushCategory('firearms', c.slug, 0.6)
    for (const b of ammoBrands) if (b.slug) pushCategory('ammo', b.slug, 0.5)
    for (const b of firearmBrands) if (b.slug) pushCategory('firearms', b.slug, 0.5)

    return fields
}

export async function GET() {
    return getServerSideSitemap(await getSitemapFields())
}
