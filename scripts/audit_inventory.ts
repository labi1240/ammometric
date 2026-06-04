import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Starting Inventory Audit...\n');

    // 1. Audit Ammo
    console.log('--- AMMO INVENTORY ---');
    const ammoCounts = await prisma.ammoSpecs.groupBy({
        by: ['caliberId'],
        _count: {
            itemId: true,
        },
        orderBy: {
            _count: {
                itemId: 'desc',
            }
        }
    });

    // Fetch caliber details for ammo
    for (const group of ammoCounts) {
        const caliber = group.caliberId == null ? null : await prisma.caliber.findUnique({
            where: { id: group.caliberId }
        });
        console.log(`Caliber: ${caliber?.name || 'Unknown'} (ID: ${group.caliberId}) - Count: ${group._count.itemId}`);
    }

    if (ammoCounts.length === 0) {
        console.log('No ammo products found linked to specs.');
    }

    // 2. Audit Firearms
    console.log('\n--- FIREARM INVENTORY ---');
    // Firearms are a bit tied via FirearmChamber join table usually, but let's check FirearmSpecs
    // Since FirearmSpecs -> FirearmChamber -> Caliber

    // We want to count distinct FirearmSpecs items per caliber.
    // We can query all FirearmChambers, select caliberId, and count distinct firearmSpecsId ideally.
    // Prisma groupBy on FirearmChamber:
    const firearmCounts = await prisma.firearmChamber.groupBy({
        by: ['caliberId'],
        _count: {
            firearmSpecsId: true // This counts Chambers. If a gun has 1 caliber, it's 1:1.
        },
        orderBy: {
            _count: {
                firearmSpecsId: 'desc'
            }
        }
    });

    for (const group of firearmCounts) {
        const caliber = group.caliberId == null ? null : await prisma.caliber.findUnique({
            where: { id: group.caliberId }
        });
        console.log(`Caliber: ${caliber?.name || 'Unknown'} (ID: ${group.caliberId}) - Count: ${group._count.firearmSpecsId}`);
    }

    if (firearmCounts.length === 0) {
        console.log('No firearm products found linked to chambers.');
    }

    // 3. Orhpans check
    const totalItems = await prisma.catalogItem.count();
    const ammoItems = await prisma.ammoSpecs.count();
    const gunItems = await prisma.firearmSpecs.count();

    console.log('\n--- SUMMARY ---');
    console.log(`Total Catalog Items: ${totalItems}`);
    console.log(`Total Ammo Specs: ${ammoItems}`);
    console.log(`Total Firearm Specs: ${gunItems}`);
    console.log(`Orphans/Others: ${totalItems - ammoItems - gunItems}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
