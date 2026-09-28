// Crimson Supply - front-end script
// The site uses one HTML file. Each "page" is a <section class="page-section">,
// and we show one section at a time by toggling Bootstrap's d-none class.

function showSection(sectionId) {
  const sections = document.querySelectorAll(".page-section");
  sections.forEach(function (section) {
    section.classList.toggle("d-none", section.id !== sectionId);
  });

  // Mark the matching navbar link as active
  const navLinks = document.querySelectorAll(".navbar .nav-link");
  navLinks.forEach(function (link) {
    link.classList.toggle("active", link.dataset.section === sectionId);
  });

  window.scrollTo(0, 0);
}

// Any element with a data-section attribute acts as a navigation link
document.querySelectorAll("[data-section]").forEach(function (link) {
  link.addEventListener("click", function (event) {
    event.preventDefault();
    showSection(link.dataset.section);
  });
});

// Shows a Bootstrap alert inside a form's message box
function showMessage(elementId, text, type) {
  const box = document.getElementById(elementId);
  box.className = "alert alert-" + type;
  box.textContent = text;
}

// Login and registration are not connected to the API yet.
// For now, the forms just show a message instead of reloading the page.
document.getElementById("loginForm").addEventListener("submit", function (event) {
  event.preventDefault();
  showMessage("loginMessage", "Login is not connected to the server yet.", "warning");
});

document.getElementById("registerForm").addEventListener("submit", function (event) {
  event.preventDefault();
  showMessage("registerMessage", "Registration is not connected to the server yet.", "warning");
});

// Checkout is simulated. The browser checks the required fields first,
// then we show the order confirmation section.
document.getElementById("checkoutForm").addEventListener("submit", function (event) {
  event.preventDefault();
  showSection("confirmation");
});

// Adding products will call the API later. For now, just show a message.
document.getElementById("addProductForm").addEventListener("submit", function (event) {
  event.preventDefault();
  showMessage("addProductMessage", "Adding products is not connected to the server yet.", "warning");
});

// Start on the home section
showSection("home");
