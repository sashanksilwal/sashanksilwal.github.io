function toggleHeaders() {
    const headers = document.querySelectorAll('.close-headers');
    let currentIndex = 0;

    // Initial display of the first header
    headers[currentIndex].classList.add('show-header');

    setInterval(() => {
        // Hide the current header
        headers[currentIndex].classList.remove('show-header');

        // Move to the next header
        currentIndex = (currentIndex + 1) % headers.length;

        // Show the next header
        headers[currentIndex].classList.add('show-header');
    }, 5000); // Change every 5000ms or 5 seconds
}

// Call the function to start the toggling when the page loads
window.onload = toggleHeaders;

function updateThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle.querySelector('i');
    const isDarkTheme = document.body.classList.contains('dark-theme');
  
    if (isDarkTheme) {
      icon.classList.replace('fa-moon', 'fa-sun');
      themeToggle.textContent = '';
    } else {
      icon.classList.replace('fa-sun', 'fa-moon');
      themeToggle.textContent = '';
    }
    themeToggle.prepend(icon);
  }
  
  function toggleDarkTheme() {
    const body = document.body;
    body.classList.toggle('dark-theme');
    
    // Save the current theme preference to localStorage
    const isDarkTheme = body.classList.contains('dark-theme');
    localStorage.setItem('darkTheme', isDarkTheme);
    updateThemeToggle();
  }
  
  // Initialize theme based on user's previous preference
  function initTheme() {
    const savedTheme = localStorage.getItem('darkTheme');
    
    // If a saved preference exists, apply it
    if (savedTheme === 'true') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', toggleDarkTheme);
    
    // Initialize theme on page load
    initTheme();
    updateThemeToggle();
  });