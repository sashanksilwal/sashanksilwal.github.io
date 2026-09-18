#!/usr/bin/env node
//
// Generates a real HTML page per blog post.
//
// post.html renders posts in the browser, which means crawlers and social
// scrapers get an empty <h1> and no per-post meta tags. These generated pages
// carry the title, description, canonical, Open Graph tags, JSON-LD and the
// article text in the markup, so the post is readable without JavaScript.
//
// Run after adding or editing a post:  npm run build:blog

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const BLOG = path.join(ROOT, 'blog');
const SITE = 'https://ssilwal.com.np';

const posts = JSON.parse(fs.readFileSync(path.join(BLOG, 'posts.json'), 'utf8'));

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

function renderMarkdown(md) {
  // Same rewrite blog.js applies: image paths are relative to posts/
  const fixed = md.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/|\/)(.*?)\)/g,
    '![$1](posts/$2)'
  );
  const { text, blocks } = protectMath(fixed);
  return restoreMath(marked.parse(text), blocks);
}

function head(meta, url, imageUrl, body) {
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
    <link rel="alternate" type="application/rss+xml" title="Sashank Silwal's Blog" href="${SITE}/feed.xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"></noscript>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="blog.css">
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
    <!-- Highlight.js -->
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
</head>
<body>

    <div class="main-content">
    <nav class="site-nav">
        <div class="nav-links">
            <a href="/" class="nav-link">Home</a>
            <a href="/experience/" class="nav-link">Experience</a>
            <a href="/blog/" class="nav-link active">Blog</a>
        </div>
        <button id="themeToggle" aria-label="Toggle dark theme"><i class="fas fa-moon"></i></button>
    </nav>

    <main>
    <article id="post-container">
        <div id="post-header">
            <a href="/blog/" class="back-link"><i class="fas fa-arrow-left"></i> Back to blog</a>
            <h1 id="post-title">${title}</h1>
            <time id="post-date" class="post-meta-date" datetime="${meta.date}">${formatDate(meta.date)}</time>
            <div id="post-tags" class="post-tags">${(meta.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        </div>
        <div id="post-content" class="post-body" data-prerendered="true">
${body}
        </div>
    </article>
    </main>

    <footer class="footer-content">
        <a href="https://github.com/sashanksilwal" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
        <i class="fa-brands fa-github"></i>
        </a>
        <a href="https://www.linkedin.com/in/sashank-silwal/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
        <i class="fa-brands fa-linkedin"></i>
        </a>
        <a href="https://x.com/sashank_silwal" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
        <i class="fa-brands fa-x-twitter"></i>
        </a>
    </footer>
    </div>

    <script src="/js/script.js"></script>
    <script src="blog.js"></script>

</body>
</html>
`;
}

// Pages the blog build doesn't own, kept in the sitemap alongside the posts.
const STATIC_PAGES = [
  { loc: `${SITE}/`, changefreq: 'monthly', priority: '1.0' },
  { loc: `${SITE}/experience/`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${SITE}/blog/`, changefreq: 'weekly', priority: '0.9' }
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function rfc822(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toUTCString().replace('GMT', '+0000');
}

function writeSitemap(published) {
  const urls = [
    ...STATIC_PAGES.map(
      p => `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    ),
    ...published.map(
      m => `  <url>\n    <loc>${SITE}/blog/${m.slug}.html</loc>\n    <lastmod>${m.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
    )
  ];
  fs.writeFileSync(
    path.join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  );
}

function writeFeed(published) {
  const items = published
    .map(
      m => `    <item>
      <title>${escapeXml(m.title)}</title>
      <link>${SITE}/blog/${m.slug}.html</link>
      <guid>${SITE}/blog/${m.slug}.html</guid>
      <pubDate>${rfc822(m.date)}</pubDate>
      <description>${escapeXml(m.description)}</description>
    </item>`
    )
    .join('\n\n');

  fs.writeFileSync(
    path.join(ROOT, 'feed.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sashank Silwal's Blog</title>
    <link>${SITE}/blog/</link>
    <description>Blog posts on machine learning, computer science, and software engineering by Sashank Silwal.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>

${items}

  </channel>
</rss>
`
  );
}

// The index builds its card list in the browser, so crawlers see an empty
// container and can't follow links to any post. Write the same markup
// renderPostList() produces into the HTML; blog.js still takes over for
// filtering once it loads.
function writeIndexCards(published) {
  const indexPath = path.join(BLOG, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  const cards = published
    .map(p => {
      const tags = (p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
      const category = p.category
        ? `<span class="tag tag-category">${escapeHtml(p.category)}</span>`
        : '';
      return `      <a href="${p.slug}.html" class="post-card" data-category="${escapeHtml(p.category || '')}" data-tags="${escapeHtml((p.tags || []).join(','))}">
        <h2 class="post-card-title">${escapeHtml(p.title)}</h2>
        <div class="post-card-date">${formatDate(p.date)}</div>
        <p class="post-card-description">${escapeHtml(p.description)}</p>
        <div class="post-card-tags">${category}${tags}</div>
      </a>`;
    })
    .join('\n');

  // Replace the whole container so re-running never nests or duplicates.
  const replaced = html.replace(
    /<div id="post-list">[\s\S]*?<\/div>(?=\s*(?:<\/main>|<!--|<div|<footer|<script))/,
    `<div id="post-list">\n${cards}\n    </div>`
  );

  if (replaced === html) {
    console.warn('warning: could not find <div id="post-list"> in blog/index.html');
    return 0;
  }

  fs.writeFileSync(indexPath, replaced);
  return published.length;
}

const published = [];
const skipped = [];

for (const meta of posts) {
  const mdPath = path.join(BLOG, 'posts', meta.slug + '.md');
  if (!fs.existsSync(mdPath)) {
    skipped.push(meta.slug);
    continue;
  }

  const url = `${SITE}/blog/${meta.slug}.html`;
  const imageUrl = meta.image ? `${SITE}/blog/posts/${meta.image}` : null;
  const body = renderMarkdown(fs.readFileSync(mdPath, 'utf8'));

  fs.writeFileSync(path.join(BLOG, meta.slug + '.html'), head(meta, url, imageUrl, body));
  published.push(meta);
}

// Newest first, so the feed reads correctly and the sitemap stays stable.
published.sort((a, b) => new Date(b.date) - new Date(a.date));

writeSitemap(published);
writeFeed(published);
const carded = writeIndexCards(published);

console.log(`built ${published.length} post pages`);
console.log(`sitemap: ${STATIC_PAGES.length + published.length} URLs, feed: ${published.length} items`);
console.log(`index: ${carded} post cards pre-rendered`);
if (skipped.length) {
  console.log(`skipped (no markdown file): ${skipped.join(', ')}`);
}
