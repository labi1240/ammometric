import prisma from '../lib/prisma'
function host(u?: string){ try{const x=new URL(u!);return x.hostname+x.pathname}catch{return u} }
async function main() {
  console.log('THIS repo .env -> Neon host:', host(process.env.DATABASE_URL))
  const tables = await prisma.$queryRawUnsafe<any[]>(
    `SELECT table_schema, table_name FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2`)
  console.log('Total tables:', tables.length)
  console.log(tables.map(t=>`${t.table_schema}.${t.table_name}`).join(', ') || '(none)')
}
main().catch(e=>{console.error('ERR:', e?.message||e);process.exit(1)}).finally(()=>process.exit(0))
