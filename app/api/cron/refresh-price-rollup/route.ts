import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Refreshes the offer_price_daily materialized view (see prisma/sql/price_history.sql).
// Triggered by Vercel Cron (schedule in vercel.json). Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set.

// Route handlers are dynamic by default under cacheComponents — no `dynamic`
// segment config needed (and it's incompatible with cacheComponents).
export const maxDuration = 60;

export async function GET(request: Request) {
    const auth = request.headers.get('authorization');
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // The offer_price_daily rollup MV was dropped to save storage (it was
        // larger than the OfferHistory it summarized). getPriceHistory() now reads
        // OfferHistory live (cached hourly). If the MV is reintroduced — re-run
        // prisma/sql/price_history.sql — this cron resumes refreshing it.
        const present = await prisma.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM pg_matviews WHERE matviewname = 'offer_price_daily'
        `;
        if (!present[0] || present[0].count === 0) {
            return NextResponse.json({ ok: true, skipped: 'offer_price_daily not present' });
        }

        // CONCURRENTLY needs the view to have been populated at least once; fall
        // back to a blocking refresh the first time (or after a full rebuild).
        try {
            await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY offer_price_daily');
        } catch {
            await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW offer_price_daily');
        }
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'unknown error';
        console.error('refresh-price-rollup failed:', message);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
