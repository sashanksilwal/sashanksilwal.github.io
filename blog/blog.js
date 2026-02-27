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
async function loadPostList() {
  const container = document.getElementById('post-list');
  if (!container) return;

  try {
    const res = await fetch('posts.json');
    const posts = await res.json();

    // Sort newest first
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (posts.length === 0) {
      container.innerHTML = '<p class="empty-state">No posts yet. Check back soon!</p>';
      return;
    }

    container.innerHTML = posts.map(post => `
      <a href="post.html?post=${post.slug}" class="post-card">
        <h2 class="post-card-title">${post.title}</h2>
        <div class="post-card-date">${formatDate(post.date)}</div>
        <p class="post-card-description">${post.description}</p>
        <div class="post-card-tags">${renderTags(post.tags)}</div>
      </a>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p class="empty-state">Could not load posts.</p>';
  }
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
