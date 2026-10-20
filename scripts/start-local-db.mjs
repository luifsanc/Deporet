// Optional local PostgreSQL launcher for machines without Docker. All data stays in .local/pgdata.
import {readFileSync, existsSync, mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {default:EmbeddedPostgres} = await import(pathToFileURL(path.join(root,'.local/node_modules/embedded-postgres/dist/index.js')).href);
const env = Object.fromEntries(readFileSync(path.join(root,'.env'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(x=>/^[A-Z_]+=/.test(x)).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const databaseDir=path.join(root,'.local/pgdata');
mkdirSync(path.join(root,'.local'),{recursive:true});
const pg = new EmbeddedPostgres({databaseDir,user:'depored',password:env.POSTGRES_PASSWORD,port:55432,persistent:true,authMethod:'scram-sha-256',
  postgresFlags:['-h','127.0.0.1'],initdbFlags:['--encoding=UTF8','--locale=C'],onLog:()=>{},onError:()=>{}});
if(!existsSync(path.join(databaseDir,'PG_VERSION'))) await pg.initialise();
await pg.start();
const client=pg.getPgClient();await client.connect();
if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='depored'")).rowCount)await pg.createDatabase('depored');
await client.end();
console.log('PostgreSQL local disponible en 127.0.0.1:55432. Datos persistentes en .local/pgdata.');
let closing=false;
async function close(){if(closing)return;closing=true;await pg.stop();process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
setInterval(()=>{},60000);

