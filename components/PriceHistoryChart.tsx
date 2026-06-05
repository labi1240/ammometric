'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { PriceHistoryPoint } from '../types';
import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"

interface PriceHistoryChartProps {
    data: PriceHistoryPoint[];
    isAmmo: boolean;
}

const valueFormatter = (number: number) =>
    `$${Intl.NumberFormat('us', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(number)}`;

const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ data, isAmmo }) => {
    const [period, setPeriod] = useState(2); // 0: 7d, 1: 30d, 2: Max
    const [selectedRetailers, setSelectedRetailers] = useState<Set<string>>(new Set());

    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const now = new Date();
        const days = period === 0 ? 7 : period === 1 ? 30 : Infinity;
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        return data.filter(p => days === Infinity || new Date(p.time) >= cutoff);
    }, [data, period]);

    const allRetailers = useMemo(() => {
        const set = new Set<string>();
        filteredData.forEach(p => set.add(p.retailerName));
        return Array.from(set).slice(0, 15);
    }, [filteredData]);

    useEffect(() => {
        if (selectedRetailers.size === 0 && allRetailers.length > 0) {
            setSelectedRetailers(new Set(allRetailers.slice(0, 8)));
        }
    }, [allRetailers]);

    const activeCategories = useMemo(() => {
        return allRetailers.filter(r => selectedRetailers.has(r));
    }, [allRetailers, selectedRetailers]);

    const toggleRetailer = (name: string) => {
        const next = new Set(selectedRetailers);
        if (next.has(name)) {
            if (next.size > 1) next.delete(name);
        } else {
            next.add(name);
        }
        setSelectedRetailers(next);
    };

    const sanitizeKey = (name: string) => `r_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const chartData = useMemo(() => {
        if (!filteredData || filteredData.length === 0) return [];
        const dateGroups: { [key: string]: any } = {};
        filteredData.forEach(p => {
            const dateObj = new Date(p.time);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            if (!dateGroups[dateStr]) {
                dateGroups[dateStr] = { date: dateStr, rawDate: dateObj.getTime() };
            }
            dateGroups[dateStr][sanitizeKey(p.retailerName)] = isAmmo ? (p.unitPrice ?? p.price) : p.price;
        });
        return Object.values(dateGroups).sort((a: any, b: any) => a.rawDate - b.rawDate);
    }, [filteredData, isAmmo]);

    const chartConfig = useMemo(() => {
        const config: ChartConfig = {};
        allRetailers.forEach((r, idx) => {
            config[sanitizeKey(r)] = {
                label: r,
                color: `var(--chart-${(idx % 10) + 1})`,
            };
        });
        return config;
    }, [allRetailers]);

    const stats = useMemo(() => {
        if (!filteredData || filteredData.length === 0) return { current: 0, change: 0 };
        const prices = filteredData.map(p => isAmmo ? (p.unitPrice ?? p.price) : p.price);
        const currentLow = Math.min(...prices);
        const firstDay = chartData[0];
        const initialPrices = firstDay ? Object.entries(firstDay).filter(([k]) => k !== 'date' && k !== 'rawDate').map(([, v]) => v as number) : [];
        const initialLow = initialPrices.length > 0 ? Math.min(...initialPrices) : currentLow;
        const change = initialLow !== 0 ? ((currentLow - initialLow) / initialLow) * 100 : 0;
        return { current: currentLow, change };
    }, [filteredData, chartData, isAmmo]);

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed">
                <p className="text-slate-400 font-black uppercase tracking-[0.4em] font-mono">[OFFLINE]</p>
                <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-widest">Awaiting_Data</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* TERMINAL HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100">
                <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] font-mono flex items-center gap-2">
                        <div className="size-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> [MARKET_VALUATION_LIVE]
                    </span>
                    <div className="flex items-baseline gap-3 mt-1.5">
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter font-mono tabular-nums leading-none">
                            {valueFormatter(stats.current)}
                        </h2>
                        <div className="flex flex-col">
                            <span className={`text-sm font-black font-mono leading-none ${stats.change > 0 ? 'text-rose-600' : stats.change < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {stats.change > 0 ? '+' : ''}{stats.change.toFixed(2)}%
                            </span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">PERIOD_DELTA</span>
                        </div>
                    </div>
                </div>

                {/* PERIOD SELECTOR */}
                <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200/60 shadow-xs">
                    {[
                        { label: '07D', val: 0 },
                        { label: '30D', val: 1 },
                        { label: 'MAX', val: 2 }
                    ].map((t) => (
                        <button
                            key={t.val}
                            onClick={() => setPeriod(t.val)}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-200 font-mono ${period === t.val
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* CHART CONTAINER - Shadcn Styled */}
            <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-6 pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3 sm:gap-0">
                        <div className="flex items-center gap-3">
                            <div className="h-0.5 w-6 bg-slate-900" />
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900 font-mono">TEMPORAL_PRICE_FLUX</CardTitle>
                        </div>
                        <CardDescription className="text-[9px] font-bold text-slate-300 font-mono uppercase tracking-[0.2em] self-start sm:self-auto ml-9 sm:ml-0">UNIT: USD/NODE</CardDescription>
                    </div>

                    {/* INTERACTIVE LEGEND - Integrated with Toggles */}
                    <div className="flex flex-wrap gap-1.5 mb-6">
                        {allRetailers.map((r, idx) => {
                            const isActive = selectedRetailers.has(r);
                            const chartColor = `var(--chart-${(idx % 5) + 1})`;

                            return (
                                <button
                                    key={r}
                                    onClick={() => toggleRetailer(r)}
                                    className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${isActive
                                        ? 'bg-slate-50 border-slate-300 text-slate-900 ring-1 ring-slate-200'
                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 opacity-60'
                                        }`}
                                >
                                    <div
                                        className="size-1.5 rounded-full"
                                        style={{ backgroundColor: isActive ? `var(--color-${sanitizeKey(r)})` : '#e2e8f0' }}
                                    />
                                    {r}
                                </button>
                            );
                        })}
                    </div>
                </CardHeader>

                <CardContent className="p-6 pt-0">
                    <ChartContainer config={chartConfig} className="h-72 w-full aspect-auto">
                        <LineChart
                            accessibilityLayer
                            data={chartData}
                            margin={{
                                left: 12,
                                right: 12,
                            }}
                        >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}
                                tickFormatter={(value) => `$${value}`}
                                domain={['auto', 'auto']}
                            />
                            <ChartTooltip
                                cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                                content={<ChartTooltipContent className="font-mono bg-white/95 backdrop-blur-sm border-slate-200 shadow-xl" />}
                            />
                            {activeCategories.map((r, idx) => {
                                const sKey = sanitizeKey(r);
                                return (
                                    <Line
                                        key={r}
                                        dataKey={sKey}
                                        type="monotone"
                                        stroke={`var(--color-${sKey})`}
                                        strokeWidth={2.5}
                                        dot={{ r: 3, fill: `var(--color-${sKey})`, strokeWidth: 0 }}
                                        activeDot={{ r: 5, strokeWidth: 0 }}
                                        connectNulls
                                        animationDuration={1000}
                                    />
                                );
                            })}
                        </LineChart>
                    </ChartContainer>
                </CardContent>

                <CardFooter className="p-6 pt-2 flex flex-col items-center">
                    <div className="flex items-center gap-2 text-sm mb-4">
                        <div className="flex items-center gap-2 leading-none font-black font-mono text-[10px] uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                            Market trending {stats.change > 0 ? 'up' : 'down'} by {Math.abs(stats.change).toFixed(1)}% <TrendingUp className="h-3 w-3" />
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 w-full opacity-40">
                        <div className="h-px w-10 bg-slate-200" />
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] font-mono whitespace-nowrap">
                            SECURE_DATA_FEED // AUTH_RETAILER_NODES // CACHE_FREQ_240S
                        </p>
                        <div className="h-px w-10 bg-slate-200" />
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default PriceHistoryChart;
