import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import tls from 'node:tls'
import { VPS_DB_CA } from './db-ca'

const rawUrl = process.env.DATABASE_URL

if (!rawUrl) {
    throw new Error(`DATABASE_URL is not set in environment. NODE_ENV: ${process.env.NODE_ENV}`);
}

// node-postgres parses `?sslmode=...` from the connection string and lets it
// OVERRIDE any explicit `ssl` config passed to the Pool. Strip it so our TLS
// settings below always win (and stay consistent regardless of the URL).
const url = new URL(rawUrl)
const dbHost = url.hostname
url.searchParams.delete('sslmode')
const connectionString = url.toString()

// Full chain verification (sslmode=verify-full equivalent):
//  - Trust the pinned VPS self-signed cert PLUS the system root CAs, so this
//    works against the VPS now and a real-cert host (e.g. Neon) on rollback.
//  - The PgBouncer cert is issued for an IP. node-postgres can't run the
//    default identity check for IP hosts (SNI can't carry an IP), so verify
//    identity explicitly against the actual connection host.
const ssl = {
    ca: [VPS_DB_CA, ...tls.rootCertificates],
    checkServerIdentity: (_host: string, cert: tls.PeerCertificate) =>
        tls.checkServerIdentity(dbHost, cert),
}

const prismaClientSingleton = () => {
    const pool = new Pool({ connectionString, max: 1, ssl })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter })
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
