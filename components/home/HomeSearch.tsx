'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ScanBarcode, ArrowRight, TrendingUp } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

// react-zxing is heavy and only needed once the user opens the scanner.
// Code-split it out of the homepage's initial bundle.
const BarcodeScanner = dynamic(
    () => import('./BarcodeScanner').then((m) => m.BarcodeScanner),
    { ssr: false },
);

const TRENDING_SEARCHES = [
    { term: '9mm', category: 'Handgun Ammo', path: 'ammo' },
    { term: '5.56 NATO', category: 'Rifle Ammo', path: 'ammo' },
    { term: 'Glock 19 Gen 5', category: 'Firearm', path: 'firearms' },
    { term: 'CCI Mini-Mag', category: 'Rimfire', path: 'ammo' },
];

const FIREARM_BRANDS = [
    'glock', 'sig', 'sauer', 'ruger', 'smith', 'wesson', 'colt', 'cz', 'walther', 'hk', 'heckler', 'koch', 'beretta',
    'taurus', 'canik', 'springfield', 'fn', 'daniel', 'bcm', 'aero', 'remington', 'mossberg', 'benelli', 'keltec',
    'savage', 'henry', 'marlin', 'winchester', 'browning', 'kimber'
];

const FIREARM_TYPES = ['rifle', 'shotgun', 'pistol', 'handgun', 'revolver', 'ar-15', 'ak-47', 'carbine'];

function detectCategory(term: string): 'ammo' | 'firearms' {
    const t = term.toLowerCase();
    if (FIREARM_BRANDS.some(b => t.includes(b))) return 'firearms';
    if (FIREARM_TYPES.some(type => t.includes(type))) return 'firearms';
    return 'ammo';
}

export function HomeSearch() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (term: string, categoryOverride?: 'ammo' | 'firearms') => {
        if (term.trim()) {
            const category = categoryOverride || detectCategory(term);
            const params = new URLSearchParams();
            params.set('q', term);
            router.push(`/${category}?${params.toString()}`);
            setIsSearchFocused(false);
        }
    };

    const handleScan = (code: string) => {
        setSearchTerm(code);
        setIsScannerOpen(false);
        handleSearch(code);
    };

    return (
        <div ref={searchContainerRef} className="relative max-w-2xl mx-auto z-20">
            {isScannerOpen && (
                <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />
            )}

            <div className={`
        relative flex items-center bg-white rounded-2xl shadow-2xl transition-all duration-300
        ${isSearchFocused ? 'ring-2 ring-brand-500/50 shadow-brand-500/10' : 'border border-slate-200'}
      `}>
                <div className="pl-5 pr-3">
                    <Search className={`h-6 w-6 transition-colors ${isSearchFocused ? 'text-brand-600' : 'text-slate-400'}`} />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
                    className="flex-1 bg-transparent border-none text-lg text-slate-900 placeholder-slate-400 focus:ring-0 focus:outline-none px-2 py-4 h-14"
                    placeholder="Search 9mm, Glock 19, or 'Federal HST'..."
                />

                {/* Action Buttons Group */}
                <div className="flex items-center gap-2 pr-2">
                    {/* Barcode Scanner Button */}
                    <button
                        onClick={() => setIsScannerOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all group/scan"
                        title="Scan Barcode"
                    >
                        <ScanBarcode className="h-5 w-5 group-hover/scan:text-slate-900" />
                        <span className="text-xs font-bold hidden sm:inline group-hover/scan:text-slate-900">Scan</span>
                    </button>

                    <button
                        onClick={() => handleSearch(searchTerm)}
                        className="bg-brand-600 hover:bg-brand-700 text-white p-3 rounded-xl transition-all shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40 hover:scale-105 active:scale-95"
                    >
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Dynamic Suggestions Dropdown */}
            {isSearchFocused && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3" /> Trending Now
                        </span>
                    </div>

                    <ul className="py-1">
                        {TRENDING_SEARCHES.map((item, idx) => (
                            <li key={idx}>
                                <button
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group transition-colors"
                                    onClick={() => {
                                        setSearchTerm(item.term);
                                        handleSearch(item.term, item.path as 'ammo' | 'firearms');
                                    }}
                                >
                                    <span className="text-slate-700 font-medium group-hover:text-brand-700">{item.term}</span>
                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                        {item.category}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
