import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Bm25Index, chunkMarkdown } from "@lumen/retrieval";

export function loadPolicyIndex(): Bm25Index {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = [path.resolve(here, "../policies"), path.resolve(here, "../../policies")].find((candidate) =>
    fs.existsSync(candidate),
  );
  if (!dir) throw new Error("Policy documents were not found.");
  const chunks = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .flatMap((file) => chunkMarkdown(file.replace(/\.md$/, ""), fs.readFileSync(path.join(dir, file), "utf8")));
  return new Bm25Index(chunks);
}
