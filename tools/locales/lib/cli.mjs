import path from 'node:path';

export function parseArgs(argv) {
  const result = { root:process.cwd(), mode:'development', out:null, dryRun:false, map:null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') result.root = path.resolve(argv[++i]);
    else if (arg === '--mode') result.mode = argv[++i];
    else if (arg === '--out') result.out = path.resolve(argv[++i]);
    else if (arg === '--map') result.map = path.resolve(argv[++i]);
    else if (arg === '--dry-run') result.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['development','release'].includes(result.mode)) throw new Error(`Invalid --mode: ${result.mode}`);
  return result;
}
