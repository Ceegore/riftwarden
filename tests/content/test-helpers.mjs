import fs from "node:fs/promises"; import os from "node:os"; import path from "node:path"; import { fileURLToPath } from "node:url";
export const starterRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
export async function tempCopy(){const dir=await fs.mkdtemp(path.join(os.tmpdir(),"riftwarden-p09-test-"));await fs.cp(path.join(starterRoot,"content","source"),path.join(dir,"content","source"),{recursive:true});await fs.cp(path.join(starterRoot,"content","locales"),path.join(dir,"content","locales"),{recursive:true});return dir;}
export async function readJson(root,rel){return JSON.parse(await fs.readFile(path.join(root,rel),"utf8"));}
export async function writeJson(root,rel,value){await fs.writeFile(path.join(root,rel),`${JSON.stringify(value,null,2)}\n`);}
export async function expectCode(promise,code){await promise.then(()=>{throw new Error(`Expected ${code}`)},(error)=>{if(error.code!==code&&!String(error.message).includes(code))throw error;});}
