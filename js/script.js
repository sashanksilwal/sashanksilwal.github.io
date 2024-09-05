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

