# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AmmoMetric is a real-time ammunition and firearms price comparison platform built with Next.js 16 (App Router), TypeScript, PostgreSQL, and Prisma ORM.

## Commands

```bash
bun run dev        # Start development server
bun run build      # Production build
bun run start      # Start production server
bun run lint       # Run ESLint
```

Prisma client is auto-generated on `bun install` via postinstall hook. Sitemaps are auto-generated on build via postbuild hook.

## Architecture

### Data Flow

```

App Pages (Server Components)
    ↓
/lib/actions.ts (Server actions - client component API)
    ↓
/lib/data.ts (Core data fetching with caching)
    ↓
Prisma ORM → PostgreSQL

```

### Caching Strategy (Next.js 16 Cache Components)
- **Long cache (weeks):** Product specs, images, descriptions (`getProductBySlug()`, `getProduct()`)
- **Short cache (hours):** Live offers, pricing, stock (`getOffers()`, `getPriceHistory()`)
- **Brief cache (minutes):** Search results (`getProducts()`)

Cache tags enable selective revalidation (e.g., `cacheTag('offers-{itemId}')`).

### Key Files
- **lib/data.ts** - Core data fetching functions with `"use cache"` directives
- **lib/actions.ts** - Server action wrappers for client components
- **lib/prisma.ts** - Prisma client singleton
- **components/GlobalProvider.tsx** - Client context (blockedRetailers, compareIds, filters)

### Route Structure
- `/ammo/[...slug]/` - Dynamic catch-all for ammo products and categories
- `/firearms/[...slug]/` - Dynamic catch-all for firearms
- `/compare/` - Product comparison tool
- `/preferences/` - User settings

### Component Patterns
- Server Components for data fetching (no `'use client'` directive)
- Client Components (`'use client'`) for interactivity (filters, compare tray, search)
- Feature components in `/components/` (ProductDetail, CategoryPage, FilterSidebar)
- UI primitives in `/components/ui/` (Shadcn/UI style)

### Database Models (Prisma)
Key models: `CatalogItem` (products), `AmmoSpecs`, `FirearmSpecs`, `Offer` (pricing), `Retailer`, `Caliber`, `Brand`, `User`, `Alert`

Enums: `CatalogKind` (AMMO | FIREARM | ACCESSORY), `CaliberType` (PISTOL | RIFLE | SHOTGUN | RIMFIRE)

### Client State
- **GlobalProvider** - React Context for app-wide state
- **Nuqs** - URL-synced state for search params (`?q=`, `?brands=`, `?calibers=`)

## Key Patterns

- Dynamic metadata via `generateMetadata()` in page files
- Parallel data fetching with `Promise.all()` in `getCachedHomepageData()`
- Raw SQL for complex queries (`prisma.$queryRaw` in `getPriceHistory()`)
- Image fallbacks via `ImageWithFallback` component
- Barcode scanning with React ZXing
- Ballistics calculations in `ProductDetail.tsx`

## Next.js 16 Patterns

1. **Async Request APIs (Breaking)** - `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` must be awaited. Synchronous access is removed.
   ```tsx
   // Correct
   const { slug } = await params
   const cookieStore = await cookies()
   ```

2. **Turbopack by Default** - Turbopack is now the default bundler. Remove `--turbopack` flags from scripts. Use `--webpack` flag only if you need Webpack.

3. **middleware → proxy** - Rename `middleware.ts` to `proxy.ts` and the exported function from `middleware` to `proxy`. The `edge` runtime is not supported in proxy; use `nodejs` runtime.

4. **Stable Cache APIs** - `cacheLife` and `cacheTag` no longer need the `unstable_` prefix. Update imports:
   ```ts
   import { cacheLife, cacheTag } from 'next/cache'
   ```

5. **Parallel Routes Require default.js** - All parallel route slots (`@modal`, `@sidebar`, etc.) must have explicit `default.js` files or builds will fail. Return `null` or call `notFound()`.

## Tech Stack Reference
- Next.js 16, React 19, TypeScript 5.8
- Prisma 7 with PostgreSQL
- TanStack React Table, Fuse.js (search), Recharts (charts)
- Tailwind CSS 4, Tremor (analytics UI)
