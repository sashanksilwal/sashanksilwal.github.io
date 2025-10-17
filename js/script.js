// === HEADER TOGGLING ===
function toggleHeaders() {
  const headers = document.querySelectorAll('.close-headers');
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
  const icon = themeToggle.querySelector('i');
  const isDarkTheme = document.body.classList.contains('dark-theme');

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
  const body = document.body;
  body.classList.toggle('dark-theme');

  // Save preference
  const isDarkTheme = body.classList.contains('dark-theme');
  localStorage.setItem('darkTheme', isDarkTheme);

  updateThemeToggle();
}

function initTheme() {
  const savedTheme = localStorage.getItem('darkTheme');

  if (savedTheme === null) {
    // No saved preference → follow system setting
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('dark-theme', prefersDark);
  } else {
    // Apply stored user preference
    document.body.classList.toggle('dark-theme', savedTheme === 'true');
  }
}


// === VISIT COUNTER ===
function trackVisits() {
  let visitCount = localStorage.getItem('visitCount');

  if (visitCount === null) {
    visitCount = 1;
  } else {
    visitCount = parseInt(visitCount) + 1;
  }

  localStorage.setItem('visitCount', visitCount);

  console.log(`Welcome back! Visit count: ${visitCount}`);

  // Optional: Display it on the page if element exists
  const counterDisplay = document.getElementById('visitCounter');
  if (counterDisplay) {
    counterDisplay.textContent = `Visit #${visitCount}`;
  }
}


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleDarkTheme);
  }

  initTheme();
  updateThemeToggle();
  trackVisits();
});
