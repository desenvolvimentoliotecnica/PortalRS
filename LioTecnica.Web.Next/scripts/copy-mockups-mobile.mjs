/**
 * Copia os mockups mobile do repositório para public/mockups-mobile/
 * (incluídos no export estático do Next em /app/mockups-mobile/).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(nextRoot, "..");
const source = path.join(repoRoot, "__analise__", "mockups-mvc", "Mockup Mobile");
const target = path.join(nextRoot, "public", "mockups-mobile");

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

if (!fs.existsSync(source)) {
  console.warn(`[copy-mockups-mobile] Origem não encontrada: ${source}`);
  process.exit(0);
}

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true, force: true });
}

copyRecursive(source, target);
console.log(`[copy-mockups-mobile] OK: ${target}`);
