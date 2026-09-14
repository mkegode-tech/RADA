/**
 * Builds a relative-path copy of the site into docs/ for GitHub Pages.
 *
 * Why not just use build.js's output directly? Because GitHub Pages project
 * sites are served under a subpath (username.github.io/repo-name/), so the
 * root-absolute paths ("/about/", "/assets/...") that build.js correctly uses
 * for real top-level hosting would resolve to the wrong place here. This
 * script rewrites every href/src starting with "/" into a same-origin
 * relative path instead (same technique as build-artifact.js), so the site
 * works at any subpath without needing to know the repo name in advance.
 *
 * GitHub Pages setup (after this has been run and pushed):
 *   Repo Settings -> Pages -> Source: Deploy from a branch
 *   Branch: main (or whichever), folder: /docs
 *
 * Run: node build-ghpages.js
 */
const fs = require("fs");
const path = require("path");
const { pages, ROOT } = require("./build.js");

const OUT_ROOT = path.join(ROOT, "docs");

const header = fs.readFileSync(path.join(ROOT, "src/partials/header.html"), "utf8");
const footer = fs.readFileSync(path.join(ROOT, "src/partials/footer.html"), "utf8");
const cookieBanner = fs.readFileSync(path.join(ROOT, "src/partials/cookie-banner.html"), "utf8");

function renderHead({ title, description }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
</head>`;
}

// Turn a root-absolute link ("/about/", "/assets/css/style.css", "/contact/#diagnostic")
// into the correct relative path from a given page's output folder.
function toRelative(target, fromDir) {
  const hashSplit = target.split("#");
  const hash = hashSplit.length > 1 ? "#" + hashSplit.slice(1).join("#") : "";
  const [pth, query] = hashSplit[0].split("?");

  let filePath;
  if (pth === "/") filePath = "index.html";
  else if (pth.endsWith("/")) filePath = pth.slice(1) + "index.html";
  else filePath = pth.slice(1);

  let rel = path.posix.relative(fromDir === "" ? "." : fromDir, filePath);
  if (rel === "") rel = path.posix.basename(filePath);

  return rel + (query ? "?" + query : "") + hash;
}

function rewriteLinks(html, fromDir) {
  return html.replace(/(href|src)="(\/(?!\/)[^"]*)"/g, (_m, attr, target) => {
    return `${attr}="${toRelative(target, fromDir)}"`;
  });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function build() {
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  for (const page of pages) {
    const body = fs.readFileSync(path.join(ROOT, "src/pages", page.src), "utf8");
    let html = `${renderHead(page)}
<body>
${header}
<main>
${body}
</main>
${footer}
${cookieBanner}
<script src="/assets/js/main.js"></script>
</body>
</html>
`;
    html = rewriteLinks(html, page.out);
    const outDir = path.join(OUT_ROOT, page.out);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  }

  copyDir(path.join(ROOT, "assets"), path.join(OUT_ROOT, "assets"));

  // Disable Jekyll processing — this is a plain static site, not a Jekyll one.
  fs.writeFileSync(path.join(OUT_ROOT, ".nojekyll"), "", "utf8");

  console.log(`Built ${pages.length} pages -> docs/ (relative paths, ready for GitHub Pages)`);
}

build();
