import Link from 'next/link';
import { RiFocus2Line, RiTwitterFill, RiFacebookFill, RiInstagramFill, RiGithubFill } from '@remixicon/react';
import { Copyright } from './Copyright';

// Slugs must match the canonical Caliber.slug (seo_name from master_config.json).
const TOP_CALIBERS = [
    { name: '9mm Luger', slug: '9mm-luger' },
    { name: '.223 Remington', slug: '223-remington' },
    { name: '.45 ACP', slug: '45acp' },
    { name: '.308 Winchester', slug: '308-winchester' },
    { name: '.40 S&W', slug: '40sw' },
    { name: '.38 Special', slug: '38-special' },
    { name: '7.62x39mm', slug: '7.62x39mm' },
    { name: '12 Gauge', slug: '12-gauge' },
];

const TOP_BRANDS = [
    { name: 'Federal', slug: 'federal' },
    { name: 'Winchester', slug: 'winchester' },
    { name: 'CCI', slug: 'cci' },
    { name: 'Remington', slug: 'remington' },
    { name: 'Hornady', slug: 'hornady' },
    { name: 'Sig Sauer', slug: 'sig-sauer' },
];

export function Footer() {
    return (
        <footer className="bg-slate-900 text-slate-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
                    {/* Brand Section */}
                    <div className="space-y-6">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="size-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
                                <RiFocus2Line className="size-6 text-white" />
                            </div>
                            <span className="text-2xl font-black tracking-tighter text-white">
                                AMMO<span className="text-brand-500">TERMINAL</span>
                            </span>
                        </Link>
                        <p className="text-sm leading-relaxed text-slate-400 max-w-xs">
                            AmmoTerminal is the premier real-time aggregator for ammunition and firearms pricing. We help you find the best deals from across the web, updated every minute.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-brand-500 transition-colors"><RiTwitterFill className="size-5" /></a>
                            <a href="#" className="hover:text-brand-500 transition-colors"><RiFacebookFill className="size-5" /></a>
                            <a href="#" className="hover:text-brand-500 transition-colors"><RiInstagramFill className="size-5" /></a>
                            <a href="#" className="hover:text-brand-500 transition-colors"><RiGithubFill className="size-5" /></a>
                        </div>
                    </div>

                    {/* Quick Navigation */}
                    <div>
                        <h3 className="text-white font-bold text-lg mb-6">Navigation</h3>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="/" className="hover:text-brand-500 transition-colors">Home</Link></li>
                            <li><Link href="/ammo" className="hover:text-brand-500 transition-colors">Ammunition</Link></li>
                            <li><Link href="/firearms" className="hover:text-brand-500 transition-colors">Firearms</Link></li>
                            <li><Link href="/compare" className="hover:text-brand-500 transition-colors">Compare Tool</Link></li>
                        </ul>
                    </div>

                    {/* Top Calibers */}
                    <div>
                        <h3 className="text-white font-bold text-lg mb-6">Top Ammunition</h3>
                        <ul className="grid grid-cols-2 gap-4 text-sm">
                            {TOP_CALIBERS.map((cal) => (
                                <li key={cal.slug}>
                                    <Link
                                        href={`/ammo?calibers=${cal.slug}`}
                                        className="hover:text-brand-500 transition-colors border-b border-transparent hover:border-brand-500/30"
                                    >
                                        {cal.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Brands Section */}
                    <div>
                        <h3 className="text-white font-bold text-lg mb-6">Featured Brands</h3>
                        <ul className="grid grid-cols-2 gap-4 text-sm">
                            {TOP_BRANDS.map((brand) => (
                                <li key={brand.slug}>
                                    <Link
                                        href={`/ammo?brands=${brand.slug}`}
                                        className="hover:text-brand-500 transition-colors border-b border-transparent hover:border-brand-500/30"
                                    >
                                        {brand.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-xs text-slate-500">
                        &copy; <Copyright /> AmmoTerminal. All rights reserved.
                    </p>
                    <div className="flex gap-8 text-xs text-slate-500">
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                        <div className="flex items-center gap-2">
                            <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-slate-400">Live In-Stock Tracking</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
