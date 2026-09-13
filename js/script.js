// === HEADER TOGGLING ===
function toggleHeaders() {
  const headers = document.querySelectorAll('.close-headers');
  if (headers.length === 0) return;
  let currentIndex = 0;

  // Show first header
  headers[currentIndex].classList.add('show-header');

  setInterval(() => {
    const nextIndex = (currentIndex + 1) % headers.length;

    // Start fade-out
    headers[currentIndex].classList.remove('show-header');

    // Wait briefly before fade-in for overlap
    setTimeout(() => {
      headers[nextIndex].classList.add('show-header');
      currentIndex = nextIndex;
    }, 300);
  }, 5000);
}


window.onload = toggleHeaders;


// === THEME MANAGEMENT ===
function updateThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  const icon = themeToggle.querySelector('i');
  const isDarkTheme = document.documentElement.classList.contains('dark-theme');

  // Update icon (moon/sun)
  if (isDarkTheme) {
    icon.classList.replace('fa-moon', 'fa-sun');
  } else {
    icon.classList.replace('fa-sun', 'fa-moon');
  }

  themeToggle.textContent = '';
  themeToggle.prepend(icon);
}

function toggleDarkTheme() {
  const root = document.documentElement;
  root.classList.toggle('dark-theme');

  // Save preference
  const isDarkTheme = root.classList.contains('dark-theme');
  localStorage.setItem('darkTheme', isDarkTheme);

  updateThemeToggle();
}

function initTheme() {
  const savedTheme = localStorage.getItem('darkTheme');

  // Dark is the default. Only go light if the user explicitly chose it before.
  const isDarkTheme = savedTheme === null ? true : savedTheme === 'true';
  document.documentElement.classList.toggle('dark-theme', isDarkTheme);
}


// === VISIT COUNTER ===
function trackVisit() {
  const count = parseInt(localStorage.getItem('visitCount') || '0') + 1;
  localStorage.setItem('visitCount', count);
  const suffix = count === 1 ? 'st' : count === 2 ? 'nd' : count === 3 ? 'rd' : 'th';
  console.log(`👋 Welcome! This is your ${count}${suffix} visit.`);
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
  trackVisit();
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleDarkTheme);
  }

  initTheme();
  updateThemeToggle();
});
