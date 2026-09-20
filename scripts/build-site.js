#!/usr/bin/env node
//
// Generates a real HTML page for every blog post and every reflection, plus
// the pre-rendered index cards, the sitemap and the RSS feeds.
//
// The listing pages and post.html render in the browser, which means crawlers
// and social scrapers would otherwise get an empty <h1>, no per-post meta tags
// and no links to follow. Everything this script writes carries the title,
// description, canonical, Open Graph tags, JSON-LD and the article text in the
// markup, so the site is readable without JavaScript.
//
// Run after adding or editing anything under blog/posts or reflections/entries:
//   npm run build

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://ssilwal.com.np';

// The two writing sections. They share the page shell and differ in what the
// pages carry: posts get tags, syntax highlighting and math; reflections are
// plain prose and skip all three.
const SECTIONS = [
  {
    dir: 'blog',
    label: 'Blog',
    sourceDir: 'posts',
    dataFile: 'posts.json',
    css: 'blog.css',
    listId: 'post-list',
    cardClass: 'post-card',
    backLabel: 'Back to blog',
    tags: true,
    richText: true,
    script: 'blog.js',
    feedPath: 'feed.xml',
    feedTitle: "Sashank Silwal's Blog",
    feedDescription:
      'Blog posts on machine learning, computer science, and software engineering by Sashank Silwal.',
    indexPriority: '0.9',
    indexChangefreq: 'weekly',
    itemPriority: '0.7'
  },
  {
    dir: 'reflections',
    label: 'Reflections',
    sourceDir: 'entries',
    dataFile: 'reflections.json',
    css: 'reflections.css',
    listId: 'reflection-list',
    cardClass: 'reflection-card',
    backLabel: 'Back to reflections',
    tags: false,
    richText: false,
    script: null,
    feedPath: 'reflections/feed.xml',
    feedTitle: 'Sashank Silwal — Reflections',
    feedDescription:
      'Short personal essays by Sashank Silwal on choices, work, and figuring things out.',
    indexPriority: '0.8',
    indexChangefreq: 'monthly',
    itemPriority: '0.6'
  }
];

// Mirrors formatDate() in blog.js
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function rfc822(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toUTCString().replace('GMT', '+0000');
}

// Math is left as-is in the markup; KaTeX renders it client side. Hiding it
// from Marked keeps the delimiters intact through markdown parsing.
function protectMath(md) {
  const blocks = [];
  let out = md.replace(/\$\$([\s\S]*?)\$\$/g, m => {
    blocks.push(m);
    return '%%MATH_BLOCK_' + (blocks.length - 1) + '%%';
  });
  out = out.replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, m => {
    blocks.push(m);
    return '%%MATH_BLOCK_' + (blocks.length - 1) + '%%';
  });
  return { text: out, blocks };
}

function restoreMath(html, blocks) {
  return html.replace(/%%MATH_BLOCK_(\d+)%%/g, (_, i) => blocks[Number(i)]);
}

function renderMarkdown(md, section) {
  // Same rewrite blog.js applies: image paths are relative to the source dir
  const fixed = md.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/|\/)(.*?)\)/g,
    `![$1](${section.sourceDir}/$2)`
  );
  const { text, blocks } = protectMath(fixed);
  const html = restoreMath(marked.parse(text), blocks);
  return html.replace(/<img /g, '<img loading="lazy" decoding="async" ');
}

function nav(activeDir) {
  const links = [
    ['/', 'Home', ''],
    ['/experience/', 'Experience', 'experience'],
    ['/blog/', 'Blog', 'blog'],
    ['/reflections/', 'Reflections', 'reflections']
  ];
  return links
    .map(
      ([href, label, dir]) =>
        `            <a href="${href}" class="nav-link${dir === activeDir ? ' active' : ''}">${label}</a>`
    )
    .join('\n');
}

const FOOTER = `    <footer class="footer-content">
        <a href="https://github.com/sashanksilwal" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
        <i class="fa-brands fa-github"></i>
        </a>
        <a href="https://www.linkedin.com/in/sashank-silwal/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
        <i class="fa-brands fa-linkedin"></i>
        </a>
        <a href="https://x.com/sashank_silwal" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
        <i class="fa-brands fa-x-twitter"></i>
        </a>
    </footer>`;

// Highlight.js and KaTeX, only for pages that can contain code or math.
const RICH_ASSETS = `    <!-- Highlight.js -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" id="hljs-light">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" id="hljs-dark" disabled>
    <script>
    (function() {
      var isDark = document.documentElement.classList.contains('dark-theme');
      var lightSheet = document.getElementById('hljs-light');
      var darkSheet = document.getElementById('hljs-dark');
      if (lightSheet && darkSheet) {
        lightSheet.disabled = isDark;
        darkSheet.disabled = !isDark;
      }
    })();
    </script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <!-- KaTeX -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"></script>
`;

function page(section, meta, url, imageUrl, body) {
  const desc = escapeHtml(meta.description);
  const title = escapeHtml(meta.title);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    author: { '@type': 'Person', name: 'Sashank Silwal' },
    url,
    ...(imageUrl ? { image: imageUrl } : {})
  };

  const social = imageUrl
    ? `    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:alt" content="${escapeHtml(meta.imageAlt || meta.title)}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:card" content="summary_large_image">`
    : `    <meta name="twitter:card" content="summary">`;

  const tagPills = section.tags
    ? `\n            <div id="post-tags" class="post-tags">${(meta.tags || [])
        .map(t => `<span class="tag">${escapeHtml(t)}</span>`)
        .join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script>
    (function() {
      try {
        var saved = localStorage.getItem('darkTheme');
        if (saved === null || saved === 'true') document.documentElement.classList.add('dark-theme');
      } catch (e) {
        document.documentElement.classList.add('dark-theme');
      }
    })();
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Sashank Silwal</title>
    <meta name="description" content="${desc}">
    <link rel="canonical" href="${url}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="article">
    <meta property="article:published_time" content="${meta.date}">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
${social}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(section.feedTitle)}" href="${SITE}/${section.feedPath}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"></noscript>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/css/post.css">
    <link rel="stylesheet" href="${section.css}">
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-TEPTW01GNL"></script>
    <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-TEPTW01GNL');
    </script>
    <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"></noscript>
${section.richText ? RICH_ASSETS : ''}</head>
<body>

    <div class="main-content">
    <nav class="site-nav">
        <div class="nav-links">
${nav(section.dir)}
        </div>
        <button id="themeToggle" aria-label="Toggle dark theme"><i class="fas fa-moon"></i></button>
    </nav>

    <main>
    <article id="post-container">
        <div id="post-header">
            <a href="/${section.dir}/" class="back-link"><i class="fas fa-arrow-left"></i> ${section.backLabel}</a>
            <h1 id="post-title">${title}</h1>
            <time id="post-date" class="post-meta-date" datetime="${meta.date}">${formatDate(meta.date)}</time>${tagPills}
        </div>
        <div id="post-content" class="post-body" data-prerendered="true">
${body}
        </div>
    </article>
    </main>

${FOOTER}
    </div>

    <script src="/js/script.js"></script>
${section.script ? `    <script src="${section.script}"></script>\n` : ''}
</body>
</html>
`;
}

function card(section, entry) {
  if (!section.tags) {
    return `      <a href="${entry.slug}.html" class="reflection-card">
        <h2 class="reflection-card-title">${escapeHtml(entry.title)}</h2>
        <time class="reflection-card-date" datetime="${entry.date}">${formatDate(entry.date)}</time>
        <p class="reflection-card-description">${escapeHtml(entry.description)}</p>
      </a>`;
  }

  const tags = (entry.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const category = entry.category
    ? `<span class="tag tag-category">${escapeHtml(entry.category)}</span>`
    : '';
  return `      <a href="${entry.slug}.html" class="post-card" data-category="${escapeHtml(entry.category || '')}" data-tags="${escapeHtml((entry.tags || []).join(','))}">
        <h2 class="post-card-title">${escapeHtml(entry.title)}</h2>
        <div class="post-card-date">${formatDate(entry.date)}</div>
        <p class="post-card-description">${escapeHtml(entry.description)}</p>
        <div class="post-card-tags">${category}${tags}</div>
      </a>`;
}

// The index builds its card list in the browser, so crawlers see an empty
// container and can't follow links to anything. Write the same markup into
// the HTML; blog.js still takes over for filtering once it loads.
function writeIndexCards(section, published) {
  const indexPath = path.join(ROOT, section.dir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const cards = published.map(p => card(section, p)).join('\n');
  const pattern = new RegExp(
    `<div id="${section.listId}">[\\s\\S]*?</div>(?=\\s*(?:</main>|<!--|<div|<footer|<script))`
  );

  if (!pattern.test(html)) {
    console.warn(`warning: could not find <div id="${section.listId}"> in ${section.dir}/index.html`);
    return 0;
  }

  // Replace the whole container so re-running never nests or duplicates.
  fs.writeFileSync(indexPath, html.replace(pattern, `<div id="${section.listId}">\n${cards}\n    </div>`));
  return published.length;
}

function writeFeed(section, published) {
  const items = published
    .map(
      m => `    <item>
      <title>${escapeXml(m.title)}</title>
      <link>${SITE}/${section.dir}/${m.slug}.html</link>
      <guid>${SITE}/${section.dir}/${m.slug}.html</guid>
      <pubDate>${rfc822(m.date)}</pubDate>
      <description>${escapeXml(m.description)}</description>
    </item>`
    )
    .join('\n\n');

  fs.writeFileSync(
    path.join(ROOT, section.feedPath),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(section.feedTitle)}</title>
    <link>${SITE}/${section.dir}/</link>
    <description>${escapeXml(section.feedDescription)}</description>
    <language>en-us</language>
    <atom:link href="${SITE}/${section.feedPath}" rel="self" type="application/rss+xml"/>

${items}

  </channel>
</rss>
`
  );
}

// Pages no section owns, kept in the sitemap alongside the generated ones.
const STATIC_PAGES = [
  { loc: `${SITE}/`, changefreq: 'monthly', priority: '1.0' },
  { loc: `${SITE}/experience/`, changefreq: 'monthly', priority: '0.8' }
];

function writeSitemap(sectionResults) {
  const urls = [
    ...STATIC_PAGES.map(
      p => `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    )
  ];

  for (const { section, published } of sectionResults) {
    urls.push(
      `  <url>\n    <loc>${SITE}/${section.dir}/</loc>\n    <changefreq>${section.indexChangefreq}</changefreq>\n    <priority>${section.indexPriority}</priority>\n  </url>`
    );
    for (const m of published) {
      urls.push(
        `  <url>\n    <loc>${SITE}/${section.dir}/${m.slug}.html</loc>\n    <lastmod>${m.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${section.itemPriority}</priority>\n  </url>`
      );
    }
  }

  fs.writeFileSync(
    path.join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  );
}

function buildSection(section) {
  const dir = path.join(ROOT, section.dir);
  const entries = JSON.parse(fs.readFileSync(path.join(dir, section.dataFile), 'utf8'));
  const published = [];
  const skipped = [];

  for (const meta of entries) {
    const mdPath = path.join(dir, section.sourceDir, meta.slug + '.md');
    if (!fs.existsSync(mdPath)) {
      skipped.push(meta.slug);
      continue;
    }

    const url = `${SITE}/${section.dir}/${meta.slug}.html`;
    const imageUrl = meta.image ? `${SITE}/${section.dir}/${section.sourceDir}/${meta.image}` : null;
    const body = renderMarkdown(fs.readFileSync(mdPath, 'utf8'), section);

    fs.writeFileSync(path.join(dir, meta.slug + '.html'), page(section, meta, url, imageUrl, body));
    published.push(meta);
  }

  // Newest first, so the feed reads correctly and the sitemap stays stable.
  published.sort((a, b) => new Date(b.date) - new Date(a.date));

  writeFeed(section, published);
  const carded = writeIndexCards(section, published);

  console.log(`${section.dir}: ${published.length} pages, ${carded} cards, feed at /${section.feedPath}`);
  if (skipped.length) {
    console.log(`${section.dir}: skipped (no markdown file): ${skipped.join(', ')}`);
  }

  return { section, published };
}

const results = SECTIONS.map(buildSection);
writeSitemap(results);

const total = results.reduce((n, r) => n + r.published.length, 0);
console.log(`sitemap: ${STATIC_PAGES.length + SECTIONS.length + total} URLs`);
