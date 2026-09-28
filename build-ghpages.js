/**
 * Builds a relative-path copy of the site into docs/ — the publish folder for
 * Cloudflare Pages (see DEPLOYMENT.md) and, if ever needed, GitHub Pages.
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
 * Cloudflare Pages setup: build command "node build-ghpages.js", output directory "docs".
 *
 * Run: node build-ghpages.js
 */
const fs = require("fs");
const path = require("path");
const { pages, ROOT, renderHead, writeSeoFiles } = require("./build.js");

const OUT_ROOT = path.join(ROOT, "docs");

const header = fs.readFileSync(path.join(ROOT, "src/partials/header.html"), "utf8");
const footer = fs.readFileSync(path.join(ROOT, "src/partials/footer.html"), "utf8");
const cookieBanner = fs.readFileSync(path.join(ROOT, "src/partials/cookie-banner.html"), "utf8");

// Same <head> as build.js (canonical, Open Graph, etc.). Its absolute https:// URLs are
// left alone by rewriteLinks(); only root-relative href/src values are made relative.
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

  // 404.html at the publish root — Cloudflare Pages and GitHub Pages both auto-serve this for
  // unmatched routes. Not part of `pages`/the sitemap.
  const notFoundBody = fs.readFileSync(path.join(ROOT, "src/pages/404.html"), "utf8");
  let notFoundHtml = `${renderHead({ title: "Page Not Found | RADA AI", description: "The page you're looking for may have moved or no longer exists." })}
<body>
${header}
<main>
${notFoundBody}
</main>
${footer}
${cookieBanner}
<script src="/assets/js/main.js"></script>
</body>
</html>
`;
  notFoundHtml = rewriteLinks(notFoundHtml, "");
  fs.writeFileSync(path.join(OUT_ROOT, "404.html"), notFoundHtml, "utf8");

  copyDir(path.join(ROOT, "assets"), path.join(OUT_ROOT, "assets"));

  writeSeoFiles(OUT_ROOT);

  // Cloudflare Pages security headers (ignored by other hosts).
  fs.copyFileSync(path.join(ROOT, "_headers"), path.join(OUT_ROOT, "_headers"));

  // Disable Jekyll processing — this is a plain static site, not a Jekyll one.
  fs.writeFileSync(path.join(OUT_ROOT, ".nojekyll"), "", "utf8");

  console.log(`Built ${pages.length} pages -> docs/ (relative paths, ready for Cloudflare Pages)`);
}

build();
