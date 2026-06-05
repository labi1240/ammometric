// Real-world caliber cross-compatibility.
//
// Keys/values are canonical Caliber.slug values (master_config seo_name).
// CHAMBER_FIRES maps a FIREARM chamber to the OTHER cartridges it can safely
// fire (beyond its own). This is directional: a .357 Magnum revolver fires
// .38 Special, but a .38 Special revolver must NOT fire .357 Magnum.
//
// (True same-cartridge aliases like .308/7.62x51 are already merged to one
// canonical slug upstream, so they don't need entries here.)
const CHAMBER_FIRES: Record<string, string[]> = {
    '357-magnum': ['38-special'],
    '327-federal-magnum': ['32hr-mag', '32sw-long'],
    '32hr-mag': ['32sw-long'],
    '5.56x45mm-nato': ['223-remington'],
    '44-magnum': ['44-special'],
    '454-casull': ['45-colt'],
    '460sw-magnum': ['454-casull', '45-colt'],
    '500sw-magnum': ['500sw-special'],
};

// Reverse: ammo caliber -> firearm chambers that can also fire it.
const FIRED_BY: Record<string, string[]> = (() => {
    const m: Record<string, string[]> = {};
    for (const [chamber, ammos] of Object.entries(CHAMBER_FIRES)) {
        for (const a of ammos) (m[a] ||= []).push(chamber);
    }
    return m;
})();

/** Ammo calibers a firearm (given its chamber slugs) can fire. */
export function compatibleAmmoCalibers(chamberSlugs: string[]): string[] {
    const out = new Set<string>();
    for (const c of chamberSlugs) {
        if (!c) continue;
        out.add(c);
        for (const extra of CHAMBER_FIRES[c] || []) out.add(extra);
    }
    return Array.from(out);
}

/** Firearm chambers that can fire a given ammo caliber. */
export function compatibleGunCalibers(ammoSlug: string): string[] {
    if (!ammoSlug) return [];
    return [ammoSlug, ...(FIRED_BY[ammoSlug] || [])];
}
