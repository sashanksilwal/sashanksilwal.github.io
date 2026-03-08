// === BLOG JS ===

// Sync highlight.js theme with site theme
function syncHljsTheme() {
  const isDark = document.body.classList.contains('dark-theme');
  const lightSheet = document.getElementById('hljs-light');
  const darkSheet = document.getElementById('hljs-dark');
  if (lightSheet && darkSheet) {
    lightSheet.disabled = isDark;
    darkSheet.disabled = !isDark;
  }
}

// Format date nicely
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Render tag pills
function renderTags(tags) {
  return tags.map(t => `<span class="tag">${t}</span>`).join('');
}

// Protect math from Marked's parser, then restore after
function protectMath(mdText) {
  const mathBlocks = [];
  // Protect display math ($$...$$) first
  let protected_ = mdText.replace(/\$\$([\s\S]*?)\$\$/g, function(match) {
    mathBlocks.push(match);
    return '%%MATH_BLOCK_' + (mathBlocks.length - 1) + '%%';
  });
  // Protect inline math ($...$) — avoid matching $$
  protected_ = protected_.replace(/\$([^\$\n]+?)\$/g, function(match) {
    mathBlocks.push(match);
    return '%%MATH_BLOCK_' + (mathBlocks.length - 1) + '%%';
  });
  return { text: protected_, blocks: mathBlocks };
}

function restoreMath(html, mathBlocks) {
  return html.replace(/%%MATH_BLOCK_(\d+)%%/g, function(match, idx) {
    return mathBlocks[parseInt(idx)];
  });
}

// === POST LISTING PAGE ===
let allPosts = [];
let activeFilters = { category: null, tag: null };

function renderPostList(posts) {
  const container = document.getElementById('post-list');
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = '<p class="empty-state">No posts match the selected filters.</p>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <a href="post.html?post=${post.slug}" class="post-card" data-category="${post.category || ''}" data-tags="${(post.tags || []).join(',')}">
      <h2 class="post-card-title">${post.title}</h2>
      <div class="post-card-date">${formatDate(post.date)}</div>
      <p class="post-card-description">${post.description}</p>
      <div class="post-card-tags">
        ${post.category ? `<span class="tag tag-category">${post.category}</span>` : ''}
        ${renderTags(post.tags)}
      </div>
    </a>
  `).join('');
}

function getFilteredPosts() {
  return allPosts.filter(post => {
    if (activeFilters.category && (post.category || '') !== activeFilters.category) return false;
    if (activeFilters.tag && !(post.tags || []).includes(activeFilters.tag)) return false;
    return true;
  });
}

function applyFilters() {
  renderPostList(getFilteredPosts());
  showReadIndicators();

  // Update active states on filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const type = btn.dataset.filterType;
    const value = btn.dataset.filterValue;
    if (type === 'category') {
      btn.classList.toggle('active', activeFilters.category === value);
    } else if (type === 'tag') {
      btn.classList.toggle('active', activeFilters.tag === value);
    } else if (type === 'all') {
      btn.classList.toggle('active', !activeFilters.category && !activeFilters.tag);
    }
  });
}

function buildFilterBar(posts) {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;

  // Collect unique categories and tags
  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))];
  const tags = [...new Set(posts.flatMap(p => p.tags || []))].sort();

  let html = '<button class="filter-btn active" data-filter-type="all">All</button>';

  categories.forEach(cat => {
    html += `<button class="filter-btn filter-btn-category" data-filter-type="category" data-filter-value="${cat}">${cat}</button>`;
  });

  tags.forEach(tag => {
    html += `<button class="filter-btn filter-btn-tag" data-filter-type="tag" data-filter-value="${tag}">${tag}</button>`;
  });

  bar.innerHTML = html;

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    const type = btn.dataset.filterType;
    const value = btn.dataset.filterValue;

    if (type === 'all') {
      activeFilters.category = null;
      activeFilters.tag = null;
    } else if (type === 'category') {
      activeFilters.category = activeFilters.category === value ? null : value;
    } else if (type === 'tag') {
      activeFilters.tag = activeFilters.tag === value ? null : value;
    }

    applyFilters();
  });
}

async function loadPostList() {
  const container = document.getElementById('post-list');
  if (!container) return;

  try {
    const res = await fetch('posts.json');
    allPosts = await res.json();

    // Sort newest first
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (allPosts.length === 0) {
      container.innerHTML = '<p class="empty-state">No posts yet. Check back soon!</p>';
      return;
    }

    buildFilterBar(allPosts);
    renderPostList(allPosts);
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Could not load posts.</p>';
  }
}

// Helper: find or create a meta/link tag and set its value
function setMeta(attr, key, value) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function injectJsonLd(data) {
  let script = document.querySelector('script[type="application/ld+json"]');
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

// === SINGLE POST PAGE ===
async function loadPost() {
  const container = document.getElementById('post-content');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('post');

  if (!slug) {
    container.innerHTML = '<p class="empty-state">Post not found.</p>';
    return;
  }

  try {
    // Fetch post metadata
    const metaRes = await fetch('posts.json');
    const posts = await metaRes.json();
    const meta = posts.find(p => p.slug === slug);

    if (meta) {
      document.getElementById('post-title').textContent = meta.title;
      document.getElementById('post-date').textContent = formatDate(meta.date);
      document.getElementById('post-tags').innerHTML = renderTags(meta.tags);
      document.title = `${meta.title} | Sashank Silwal`;

      // Dynamic SEO meta tags
      const postUrl = 'https://ssilwal.com.np/blog/post.html?post=' + slug;

      setMeta('name', 'description', meta.description);
      setMeta('property', 'og:title', meta.title);
      setMeta('property', 'og:description', meta.description);
      setMeta('property', 'og:url', postUrl);
      setMeta('property', 'og:type', 'article');
      setMeta('name', 'twitter:card', 'summary');
      setMeta('name', 'twitter:title', meta.title);
      setMeta('name', 'twitter:description', meta.description);

      setCanonical(postUrl);

      injectJsonLd({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: meta.title,
        description: meta.description,
        datePublished: meta.date,
        author: {
          '@type': 'Person',
          name: 'Sashank Silwal'
        },
        url: postUrl
      });
    }

    // Fetch markdown
    const mdRes = await fetch(`posts/${slug}.md`);
    if (!mdRes.ok) throw new Error('Post not found');
    const mdText = await mdRes.text();

    // Protect math blocks from Marked's parser
    const { text: safeMd, blocks: mathBlocks } = protectMath(mdText);

    // Configure marked with highlight.js
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      }
    });

    // Parse markdown, then restore math delimiters
    const html = restoreMath(marked.parse(safeMd), mathBlocks);
    container.innerHTML = html;

    // Render KaTeX math
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }

    // Sync highlight.js theme
    syncHljsTheme();

  } catch (err) {
    container.innerHTML = '<p class="empty-state">Could not load this post.</p>';
  }
}

// Watch for theme changes to sync hljs
const observer = new MutationObserver(syncHljsTheme);
observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

// === READING PROGRESS ===
function getReadProgress() {
  try {
    return JSON.parse(localStorage.getItem('readProgress') || '{}');
  } catch { return {}; }
}

function saveScrollProgress(slug) {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) return;
  const percent = Math.min(Math.round((window.scrollY / docHeight) * 100), 100);
  const progress = getReadProgress();
  // Only save if further than before
  if (percent > (progress[slug] || 0)) {
    progress[slug] = percent;
    localStorage.setItem('readProgress', JSON.stringify(progress));
  }
}

function trackScrollProgress(slug) {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        saveScrollProgress(slug);
        ticking = false;
      });
      ticking = true;
    }
  });
}

function resumePosition(slug) {
  const progress = getReadProgress();
  const percent = progress[slug];
  if (!percent || percent >= 100 || percent < 5) return;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const targetY = Math.round((percent / 100) * docHeight);

  const banner = document.createElement('div');
  banner.className = 'resume-banner';
  banner.innerHTML = `You were ${percent}% through this post. <button class="resume-btn">Resume</button>`;
  document.querySelector('.main-content').prepend(banner);

  banner.querySelector('.resume-btn').addEventListener('click', () => {
    window.scrollTo({ top: targetY, behavior: 'smooth' });
    banner.remove();
  });

  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
}

function showReadIndicators() {
  const progress = getReadProgress();
  document.querySelectorAll('.post-card').forEach(card => {
    const href = card.getAttribute('href') || '';
    const match = href.match(/post=([^&]+)/);
    if (!match) return;
    const slug = match[1];
    const percent = progress[slug];
    if (!percent) return;

    const title = card.querySelector('.post-card-title');
    if (title && !title.querySelector('.read-check')) {
      const badge = document.createElement('span');
      badge.className = 'read-check';
      if (percent >= 90) {
        badge.textContent = ' ✓';
        badge.title = 'Read';
      } else {
        badge.textContent = ` ${percent}%`;
        badge.title = `${percent}% read`;
      }
      title.appendChild(badge);
    }
  });
}

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  loadPostList().then(() => showReadIndicators());

  const slug = new URLSearchParams(window.location.search).get('post');
  if (slug) {
    loadPost().then(() => {
      resumePosition(slug);
      trackScrollProgress(slug);
    });
  } else {
    loadPost();
  }
});
