/**
 * Static site builder for the RADA AI website.
 * Wraps each fragment in src/pages/** with the shared head/header/footer,
 * and writes clean-URL output (e.g. src/pages/about.html -> /about/index.html).
 * Run: node build.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE_URL = "https://www.radaai.com"; // placeholder — update once the domain is live

const header = fs.readFileSync(path.join(ROOT, "src/partials/header.html"), "utf8");
const footer = fs.readFileSync(path.join(ROOT, "src/partials/footer.html"), "utf8");
const cookieBanner = fs.readFileSync(path.join(ROOT, "src/partials/cookie-banner.html"), "utf8");

// { srcRelPath, outPath ('' = site root), title, description }
const pages = [
  { src: "index.html", out: "", title: "RADA AI | Visibility, Control and Intelligence for Your Business", description: "RADA AI helps organizations transform how they operate and make decisions by combining AI strategy, workforce training, intelligent automation and executive management systems." },
  { src: "what-we-do.html", out: "what-we-do", title: "What We Do | RADA AI", description: "The four RADA AI service pillars: AI Strategy & Transformation, AI Training & Capability Building, AI Automation & Implementation, and Executive Intelligence Systems." },
  { src: "services/ai-strategy-transformation.html", out: "services/ai-strategy-transformation", title: "AI Strategy & Transformation | RADA AI", description: "Executive diagnostics, AI roadmap, governance, use-case prioritization and transformation design for AI-enabled organizations." },
  { src: "services/ai-training-capability-building.html", out: "services/ai-training-capability-building", title: "AI Training & Capability Building | RADA AI", description: "Leadership training, workforce AI literacy, agentic AI productivity and role-specific enablement so teams use AI safely and productively." },
  { src: "services/ai-automation-implementation.html", out: "services/ai-automation-implementation", title: "AI Automation & Implementation | RADA AI", description: "Workflow redesign, AI agents, integrations, process automation and deployment with human-in-the-loop controls." },
  { src: "services/executive-intelligence-systems.html", out: "services/executive-intelligence-systems", title: "Executive Intelligence Systems | RADA AI", description: "Dashboards, management information, alerts, decision support and cross-functional intelligence for executive teams." },
  { src: "use-cases.html", out: "use-cases", title: "Solutions & Use Cases | RADA AI", description: "Practical AI outcomes by business function — CEO and management, sales, finance, operations, credit and risk, customer service, HR and professional services." },
  { src: "insights.html", out: "insights", title: "Insights | RADA AI", description: "Practical guides and thinking on AI strategy, training, automation and executive intelligence from RADA AI." },
  { src: "insights/ai-business-diagnostic-questions-boards-should-ask.html", out: "insights/ai-business-diagnostic-questions-boards-should-ask", title: "Questions Boards Should Ask Before Approving an AI Budget | RADA AI Insights", description: "A practical checklist for boards and executive committees evaluating AI investment proposals." },
  { src: "insights/why-ai-training-should-precede-automation.html", out: "insights/why-ai-training-should-precede-automation", title: "Why AI Training Should Precede Automation | RADA AI Insights", description: "Why organizations that build AI literacy before automating workflows see safer, faster adoption." },
  { src: "insights/building-an-executive-intelligence-layer.html", out: "insights/building-an-executive-intelligence-layer", title: "Building an Executive Intelligence Layer | RADA AI Insights", description: "How management dashboards, exception reporting and decision support turn scattered data into board-ready intelligence." },
  { src: "about.html", out: "about", title: "About RADA AI | Visibility, Control, Intelligence", description: "RADA AI's mission, approach and principles as a business transformation partner combining AI strategy, training, automation and executive intelligence." },
  { src: "contact.html", out: "contact", title: "Contact RADA AI | Book an AI Business Diagnostic", description: "Book an AI Business Diagnostic or speak to RADA AI about strategy, training, automation or executive intelligence." },
  { src: "legal/privacy-policy.html", out: "legal/privacy-policy", title: "Privacy Policy | RADA AI", description: "How RADA AI collects, uses and protects personal data." },
  { src: "legal/terms.html", out: "legal/terms", title: "Terms of Use | RADA AI", description: "Terms of use for the RADA AI website." },
  { src: "legal/cookie-policy.html", out: "legal/cookie-policy", title: "Cookie Policy | RADA AI", description: "How RADA AI uses cookies and similar technologies." },
];

function canonicalPath(out) {
  return out === "" ? "/" : `/${out}/`;
}

function renderHead({ title, description, out }) {
  const canonical = `${SITE_URL}${canonicalPath(out)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="RADA AI">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
</head>`;
}

function build() {
  let count = 0;
  for (const page of pages) {
    const srcPath = path.join(ROOT, "src/pages", page.src);
    const body = fs.readFileSync(srcPath, "utf8");
    const html = `${renderHead(page)}
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
    const outDir = path.join(ROOT, page.out);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
    count++;
  }

  // sitemap.xml
  const urls = pages
    .map((p) => `  <url><loc>${SITE_URL}${canonicalPath(p.out)}</loc></url>`)
    .join("\n");
  fs.writeFileSync(
    path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    "utf8"
  );

  // robots.txt
  fs.writeFileSync(
    path.join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    "utf8"
  );

  console.log(`Built ${count} pages -> sitemap.xml, robots.txt`);
}

module.exports = { pages, ROOT };

if (require.main === module) {
  build();
}
