# CLAUDE.md — Crimson Supply Project Instructions

## Project Overview

This project is for **MIS 330**.

**Project Title:** Crimson Supply: School and Office Supplies System

Crimson Supply is a retail web application for school and office supplies. Customers should eventually be able to browse products, search/filter products, manage an account, place orders, and receive order confirmation. The system will also include inventory management and business reporting.

This is a **full-stack class project**, but it must stay within the technologies that have been taught in class or explicitly approved by me.

---

## Most Important Rule

**Do not introduce a new programming language, framework, database, ORM, build system, or major dependency without asking me first.**

If you believe another technology would improve the project, explain:

1. What you want to use
2. Why you want to use it
3. What problem it solves
4. Whether the project can be completed without it

Then wait for my approval before adding it.

Do not silently switch the project to another stack.

---

## Approved Technology Stack

Use only the following unless I explicitly approve something else:

### Front End
- HTML
- CSS
- Bootstrap
- JavaScript

### Back End
- C#
- The existing ASP.NET Core API project already included in this repository

### Database
- MySQL
- SQL

### Explicitly Do NOT Add Without Permission
Do not add or convert the project to:

- Node.js
- Express
- React
- Vue
- Angular
- TypeScript
- Python
- Flask
- Django
- PHP
- Java
- Spring
- Next.js
- MongoDB
- PostgreSQL
- SQLite
- Entity Framework or another ORM unless I specifically approve it
- Any other language or framework that is not already part of the project

If an existing project file or installed package already uses something not listed above, tell me before relying on it for new work.

---

## Existing Project Structure

The project currently follows approximately this structure:

```text
MIS330_Group_Project/
│
├── API/
│   ├── Controllers/
│   ├── Properties/
│   ├── Program.cs
│   ├── API.csproj
│   ├── API.http
│   ├── appsettings.json
│   └── appsettings.Development.json
│
└── Client/
    ├── Resources/
    │   ├── Scripts/
    │   │   └── index.js
    │   └── Styles/
    │       └── index.css
    │
    └── index.html
```

Work with this existing structure unless I ask for a change.

### Generated Folders

Do not manually edit files inside:

```text
bin/
obj/
```

Those are generated build folders.

---

## Front-End Structure Rules

### One HTML File

The entire front end should use **one HTML file only**:

```text
Client/index.html
```

Do not create separate pages such as:

```text
login.html
products.html
cart.html
profile.html
admin.html
checkout.html
```

Instead, use JavaScript to control what content is displayed inside `index.html`.

For example, JavaScript may show/hide or dynamically render sections for:

- Home
- Product listing
- Search results
- Cart
- Login
- Registration
- User profile
- Checkout
- Order confirmation
- Admin product management
- Inventory management
- Reports

The project should behave like a simple single-page application, but **do not add a front-end framework**.

Use normal JavaScript.

---

## CSS Rules

Keep styling in:

```text
Client/Resources/Styles/index.css
```

Bootstrap may also be used.

Prefer Bootstrap for common layout/components when it makes the project simpler, including:

- Navigation bars
- Buttons
- Forms
- Cards
- Tables
- Modals
- Alerts
- Grid layouts

Custom CSS should be used when Bootstrap does not provide what is needed or when the project needs custom branding.

Do not create additional CSS files unless there is a clear reason and I approve it.

---

## JavaScript Rules

JavaScript should handle most front-end behavior.

The existing script is:

```text
Client/Resources/Scripts/index.js
```

Additional JavaScript files are allowed if they make the project easier to understand.

Possible examples later could include:

```text
auth.js
products.js
cart.js
admin.js
api.js
```

Do not split code into many files unnecessarily.

Keep the code simple enough for an MIS 330 student to understand and explain.

JavaScript may eventually handle:

- Changing visible sections of the page
- Loading data from the API
- Rendering products
- Search and filtering
- Cart behavior
- Login and registration forms
- User profile UI
- Admin UI
- Inventory UI
- Checkout UI
- Order confirmation UI
- Form validation
- Calling the C# API with `fetch()`

Use normal browser JavaScript unless I approve another library.

---

## C# / API Rules

Use the existing **ASP.NET Core C# API** for server-side functionality.

Do not replace it with Node.js or Express.

The API will eventually be responsible for operations such as:

- Reading data from MySQL
- Creating records
- Updating records
- Deleting records
- User/account operations
- Product operations
- Inventory operations
- Order operations
- Report queries

Use controllers and other C# files only as needed.

Keep the API design simple and appropriate for what has been taught in class.

Before introducing a complicated architecture, design pattern, authentication library, ORM, or package, ask me first.

---

## Database Rules

The required database is **MySQL**.

I am currently learning MySQL and want to build important database pieces myself.

### Do Not Jump Ahead

Do **not** automatically:

- Create the entire database for me
- Create every table without being asked
- Generate the full schema without being asked
- Populate the database with fake products
- Create 20–30 sample products
- Add seed scripts
- Add an ORM
- Replace MySQL with another database

When I ask for help with the database, help me with the specific part I request.

Explain SQL in a way that I can understand and reproduce myself.

Use standard MySQL-compatible SQL.

---

## Core Assignment Requirements

The completed application will eventually need to support the following required functions.

### 1. User Management

The system should eventually support:

- User registration
- User login
- User profiles

The system should have at least two logical user roles:

- **Customer**
- **Admin**

Customers should use the shopping features.

Admins should eventually have access to management features.

Do not implement advanced authentication/security systems unless I ask for them.

---

## 2. Product Listing and Management

The system should eventually support:

- Viewing products
- Creating products
- Reading product information
- Updating products
- Deleting products

Admin users should eventually be able to manage products.

Do not add fake product records unless I ask.

---

## 3. Search and Filtering

The system should eventually support search/filtering such as:

- Keyword search
- Product category
- Other simple filtering options when appropriate

Keep the implementation practical for a class project.

---

## 4. Customer Purchase Transactions

The system should eventually support:

- Adding products to a cart
- Reviewing the cart
- Placing an order
- Order confirmation

For now, checkout should be **simulated**.

Do not integrate:

- Stripe
- PayPal
- Credit-card processing
- Real banking/payment information
- Paid payment APIs

unless I specifically request it later.

---

## 5. Inventory Management

After an order is successfully completed, the application should eventually:

1. Save the order
2. Save the purchased items
3. Update product inventory
4. Reduce inventory by the quantity purchased

Inventory should never become negative.

Implementation should be added when I ask for that stage of the project.

---

## 6. Business Reports / SQL Queries

The assignment requires **five SQL queries** that use joins and summary queries to generate meaningful business reports.

These should be created later when the database structure is established.

Examples of appropriate report ideas include:

- Total sales by product
- Total sales by category
- Number of orders by customer
- Best-selling products
- Current low-inventory products
- Revenue by date or month
- Average order value

Do not create the final five report queries until the necessary database tables are known.

The final reports should use concepts such as:

- `JOIN`
- `GROUP BY`
- `COUNT()`
- `SUM()`
- `AVG()`

where appropriate.

---

## Development Style

I will prompt you **one step at a time**.

Do not try to complete the entire project every time I ask for one change.

If I ask:

> Build the navbar.

Then focus on the navbar.

Do not also build the database, checkout, login system, inventory system, and reports unless those changes are necessary for the requested task.

If there are logical next steps, you may briefly tell me what they are after completing the requested work, but do not implement them without being asked.

---

## Before Editing Code

Before making a substantial change:

1. Inspect the relevant existing files.
2. Understand the current project structure.
3. Reuse existing code where practical.
4. Avoid replacing working code unnecessarily.
5. Tell me if my request conflicts with the existing project.
6. Ask before introducing a technology outside the approved stack.

Do not rewrite an entire file when a small change is sufficient unless a rewrite is clearly cleaner.

---

## When Making Changes

When I ask Claude Code to modify the project:

- Make only the changes needed for the current task.
- Preserve existing working functionality.
- Keep naming consistent.
- Keep code readable.
- Avoid unnecessary abstraction.
- Avoid unnecessary packages.
- Avoid generated boilerplate that is not being used.
- Remove unused code only when it is clearly safe or I ask for cleanup.
- Do not alter unrelated files.
- Do not modify `bin` or `obj`.

If you are unsure whether a change is within the scope of my request, ask first.

---

## Code Complexity

This is a college MIS project.

Favor:

- Straightforward functions
- Clear variable names
- Simple API endpoints
- Clear SQL
- Basic Bootstrap layouts
- Easy-to-follow JavaScript
- Comments where they help explain non-obvious code

Avoid unnecessary enterprise-level patterns.

Do not make the code intentionally complex just because a more advanced architecture exists.

I should be able to explain the important parts of the project to my professor.

---

## Comments

Use useful comments, but do not comment every line.

Good comments explain:

- Why something is being done
- What a non-obvious section handles
- Important business logic
- Important API/database behavior

Avoid comments that simply repeat obvious code.

---

## Error Handling

Handle common errors cleanly.

Examples:

- Invalid form input
- Failed API request
- Product not found
- Invalid quantity
- Out-of-stock item
- Login failure
- Database error

For the front end, give the user a readable message instead of silently failing.

For the API, use appropriate HTTP status codes where practical.

---

## Security Guidelines

This is a class project, but basic security practices should still be followed.

Do not:

- Put real passwords in source code
- Put database passwords directly in JavaScript
- Expose database credentials to the browser
- Build SQL queries by directly concatenating untrusted user input
- Store real payment information
- Commit private credentials intentionally

Database access must happen through the server-side API, not directly from browser JavaScript.

Use parameterized SQL queries when database functionality is implemented.

If a feature requires credentials or secrets, explain where they should be stored before adding them.

---

## API Communication

The browser should communicate with the existing C# API using JavaScript `fetch()`.

General flow:

```text
index.html
    ↓
JavaScript
    ↓
fetch()
    ↓
ASP.NET Core API
    ↓
MySQL
```

Do not connect JavaScript in the browser directly to MySQL.

---

## UI Direction

The site should look like a simple, modern school/office supply store.

Prioritize:

- Easy navigation
- Clear product cards
- Readable text
- Consistent spacing
- Responsive Bootstrap design
- Simple forms
- Clear buttons
- Clear cart/order information

Avoid an overly complicated design.

The project's name is **Crimson Supply**, so a crimson-inspired visual theme may be appropriate, but do not redesign the site unless the current task involves styling.

---

## Expected Main Sections

Because only one HTML file is allowed, `index.html` may eventually contain or provide containers for sections such as:

```text
Navbar
Home
Products
Cart
Login
Register
Profile
Checkout
Order Confirmation
Admin Dashboard
Product Management
Inventory Management
Reports
Footer
```

JavaScript should control which section is visible when appropriate.

Not every section needs to be built immediately.

---

## Role Behavior

### Customer

A customer should eventually be able to:

- Register
- Log in
- Browse products
- Search/filter products
- Add products to cart
- Update cart quantities
- Place a simulated order
- View order confirmation
- Manage basic profile information

### Admin

An admin should eventually be able to:

- Log in
- Add products
- Edit products
- Delete products
- Update inventory
- View business reports

Only implement these features when requested.

---

## Do Not Use Paid Services

Do not introduce paid APIs, paid hosting requirements, or paid third-party services unless I explicitly ask about them.

Prefer free/local solutions appropriate for a class project.

---

## Response Style When Working With Me

When explaining changes:

1. Tell me what you changed.
2. Tell me which file(s) changed.
3. Explain anything important I need to understand.
4. Give me any commands I need to run.
5. Tell me how to test the change.
6. Mention any error or concern that I need to resolve.

Keep explanations student-friendly and direct.

If there are multiple possible approaches, explain the simpler option first.

---

## When I Ask for Code

If I ask you to implement something:

- Inspect the existing project first.
- Modify the real project files when appropriate.
- Do not give me a completely different sample project.
- Keep the existing folder layout.
- Make the smallest reasonable set of changes.
- Verify that paths and references match the actual project.
- Do not claim code works if it has not been checked.

If possible, build or test the affected part after making changes.

If testing cannot be completed, clearly tell me what still needs to be tested.

---

## Final Reminder

The priority for this project is:

1. Meet the MIS 330 assignment requirements.
2. Stay within the technologies taught/approved for the class.
3. Keep the code understandable.
4. Build the project incrementally as I request features.
5. Use one HTML file.
6. Use JavaScript for front-end behavior.
7. Use the existing C# ASP.NET Core API for server-side code.
8. Use MySQL for the database.
9. Do not create database content or fake products until I ask.
10. Ask me before adding any unapproved language, framework, database, ORM, or major dependency.
