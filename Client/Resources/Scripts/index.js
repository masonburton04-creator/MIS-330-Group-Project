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

// ===== Loading data from the C# API =====

// Address of the ASP.NET Core API (see API/Properties/launchSettings.json)
const API_URL = "http://localhost:5095/api";

// Loads categories from MySQL and fills both category dropdowns
async function loadCategories() {
  try {
    const response = await fetch(API_URL + "/categories");
    if (!response.ok) {
      throw new Error("Server returned status " + response.status);
    }
    const categories = await response.json();

    const dropdowns = [
      document.getElementById("categoryFilter"),
      document.getElementById("newProductCategory")
    ];
    dropdowns.forEach(function (dropdown) {
      categories.forEach(function (category) {
        const option = document.createElement("option");
        option.value = category.categoryId;
        option.textContent = category.categoryName;
        dropdown.appendChild(option);
      });
    });
  } catch (error) {
    console.error("Could not load categories:", error);
  }
}

// Loads products from MySQL and shows them as cards
async function loadProducts() {
  const messageBox = document.getElementById("productMessage");
  showMessage("productMessage", "Loading products...", "info");

  try {
    const response = await fetch(API_URL + "/products");
    if (!response.ok) {
      throw new Error("Server returned status " + response.status);
    }
    const products = await response.json();

    if (products.length === 0) {
      showMessage("productMessage", "No products found.", "secondary");
    } else {
      messageBox.className = "alert d-none";
    }
    renderProducts(products);
  } catch (error) {
    // Most often this means the API isn't running or MySQL isn't reachable
    console.error("Could not load products:", error);
    showMessage("productMessage", "Could not load products. Make sure the API is running.", "danger");
  }
}

// Builds one Bootstrap card per product inside #productList
function renderProducts(products) {
  const productList = document.getElementById("productList");
  productList.innerHTML = "";

  products.forEach(function (product) {
    // Pick the stock message and color based on how many are left
    let stockText = "In stock";
    let stockClass = "text-success";
    if (product.stockQuantity === 0) {
      stockText = "Out of stock";
      stockClass = "text-danger";
    } else if (product.stockQuantity <= 5) {
      stockText = "Only " + product.stockQuantity + " left";
      stockClass = "text-warning";
    }

    const column = document.createElement("div");
    column.className = "col-sm-6 col-lg-3";
    column.innerHTML = `
      <div class="card h-100 product-card">
        <div class="card-body d-flex flex-column">
          <span class="product-category"></span>
          <h3 class="product-name"></h3>
          <p class="product-price">$${product.price.toFixed(2)}</p>
          <p class="small ${stockClass} mb-3">${stockText}</p>
          <button class="btn mt-auto"></button>
        </div>
      </div>`;

    // Text from the database is set with textContent so it is never treated as HTML
    column.querySelector(".product-category").textContent = product.categoryName;
    column.querySelector(".product-name").textContent = product.productName;

    const button = column.querySelector("button");
    if (product.stockQuantity === 0) {
      button.textContent = "Out of Stock";
      button.classList.add("btn-secondary");
      button.disabled = true;
    } else {
      // The real cart will be built in a later step
      button.textContent = "Add to Cart";
      button.classList.add("btn-crimson");
      button.addEventListener("click", function () {
        showSection("cart");
      });
    }

    productList.appendChild(column);
  });
}

// Start on the home section and load data from the API
showSection("home");
loadCategories();
loadProducts();
