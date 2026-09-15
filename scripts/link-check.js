/**
 * Static link/asset checker for the built site (root-level output, matching
 * what real hosting + GitHub Pages actually serve). Walks every page.html,
 * extracts href/src, and verifies the target exists on disk. Catches broken
 * internal links, missing images, and — critically — case-mismatches that
 * work on Windows (case-insensitive filesystem) but 404 on GitHub Pages'
 * Linux servers (case-sensitive).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function findHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "src" || entry.name === "node_modules" || entry.name === ".git" || entry.name === "docs" || entry.name === "artifact-dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, out);
    else if (entry.name === "index.html") out.push(full);
  }
  return out;
}

function existsCaseSensitive(absPath) {
  const dir = path.dirname(absPath);
  const base = path.basename(absPath);
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir);
  return entries.includes(base);
}

const pages = findHtmlFiles(ROOT);
let totalLinks = 0;
let issues = [];

for (const pageFile of pages) {
  const html = fs.readFileSync(pageFile, "utf8");
  const pageUrl = "/" + path.relative(ROOT, path.dirname(pageFile)).split(path.sep).join("/") + "/";
  const matches = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  for (const raw of matches) {
    totalLinks++;
    if (raw.startsWith("http") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("#")) continue;
    const [pathAndQuery] = raw.split("#");
    const [pathPart] = pathAndQuery.split("?");
    if (!pathPart) continue;

    let targetPath;
    if (pathPart.endsWith("/")) targetPath = path.join(ROOT, pathPart, "index.html");
    else targetPath = path.join(ROOT, pathPart);

    if (!fs.existsSync(targetPath)) {
      issues.push(`[MISSING] ${pageUrl} -> "${raw}" (resolved: ${path.relative(ROOT, targetPath)})`);
    } else if (!existsCaseSensitive(targetPath)) {
      issues.push(`[CASE MISMATCH] ${pageUrl} -> "${raw}" — works on Windows, will 404 on GitHub Pages`);
    }
  }
}

console.log(`Checked ${pages.length} pages, ${totalLinks} href/src attributes.`);
if (issues.length === 0) {
  console.log("No broken links or case-mismatches found.");
} else {
  console.log(`${issues.length} issue(s):`);
  issues.forEach((i) => console.log(" - " + i));
}
