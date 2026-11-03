# CLAUDE.md — Crimson Supply Project Instructions

## Project Overview

This project is for **MIS 330** (assignment option *Project B*; some notes call it Project C).

**Project Title:** Crimson Supply: School and Office Supplies System

Crimson Supply is a retail web application for school, office and studio supplies. It is **not** TechCycle or FitZone.

### Current status (updated 2026-10-29)

A **complete first version** has been built and tested:

- A fully redesigned storefront: home, catalog, search and filters, product pages, kits, bag and checkout, receipt.
- Customer accounts: register, sign in/out, profile, password, order history.
- An admin workspace: dashboard, products, categories, orders, and five business reports.
- A C# API with cookie authentication and role checks.
- MySQL schema, demo seed data, and report SQL.

The owner authorized this full rebuild on 2026-10-29. That direction **replaces** the old rules about building one small feature at a time and not creating the database, seed data, checkout or reports yet.

**From now on, work is refinement:** the owner reviews the site and asks for specific changes. Make the requested change thoroughly and in the existing style. Fix related bugs you notice. Don't redesign unrelated parts or add big new features without asking.

See `README.md` for setup, run instructions and how each part works.

---

## Most Important Rule

**Do not introduce a new programming language, framework, database, ORM, build system, or major dependency without asking first.**

If another technology would help, explain what it is, why, what problem it solves, and whether the project can be finished without it. Then wait for approval.

---

## Approved Technology Stack

- **Front end:** HTML, CSS, Bootstrap 5.3 (CDN), plain JavaScript. Google Fonts (Fraunces, Instrument Sans, IBM Plex Mono) are used for styling.
- **Back end:** C# in the existing ASP.NET Core API project (`API/`), using the `MySql.Data` package and ASP.NET Core's **built-in** cookie authentication.
- **Database:** MySQL, with plain parameterized SQL.

### Do NOT add without permission
Node.js/Express (for the app), React, Vue, Angular, TypeScript, Python, Flask, Django, PHP, Java, Spring, Next.js, MongoDB, PostgreSQL, SQLite, Entity Framework or any ORM, chart libraries, icon libraries, paid services, or any new build system.

(Using `node --check` or headless Chrome locally just to *test* files is fine; they are not part of the project.)

---

## Project Structure

```text
API/
  Controllers/  ApiControllerBase (shared helpers), Account, Products, Categories, Orders, Reports
  Models/       request/response classes
  Program.cs    cookie auth + serves ../Client as the website
Client/
  index.html                    the ONLY html file
  Resources/Scripts/index.js    helpers, router, storefront pages
  Resources/Scripts/cart.js     bag, checkout, receipt
  Resources/Scripts/account.js  sign in/register, account pages
  Resources/Scripts/admin.js    admin workspace + reports
  Resources/Styles/index.css    all custom styling (design tokens at the top)
  Resources/Images/products/    product illustrations (SVG) + placeholder.svg
Database/
  create_database.sql  schema (IF NOT EXISTS, never drops)
  sample_data.sql      optional demo data (INSERT IGNORE / NOT EXISTS, re-runnable)
  reports.sql          the five report queries (same SQL as ReportsController)
  make_admin.sql       promote an account to Admin
```

The site is run with `dotnet run` in `API/` and opened at **http://localhost:5095**. The API serves `Client/` so the cookie login works on one origin.

Do not edit generated `bin/` or `obj/` folders.

---

## Front-End Rules

- **One HTML file only** (`Client/index.html`). Each "page" is a `<section class="view">`. The hash router in `index.js` (`#/shop`, `#/product/5`, `#/admin/reports`, …) shows one view at a time. Never add separate HTML pages.
- Plain JavaScript only, no front-end framework. Keep the four script files; add another only if it clearly makes things easier to understand.
- All API calls go through `api()` in `index.js`. Any database text placed into HTML must go through `esc()`.
- Styling lives in `index.css`. Use the CSS variables in section 1 (crimson, paper, ink, marigold, and so on) and the existing component classes (`btn-cs`, `product-card`, `admin-card`, `data-table`, …) rather than inventing new styles.
- Keep the established visual identity: warm paper, crimson, charcoal ink, marigold highlights, Fraunces headings, flat ink-outline product illustrations.
- Keep it accessible (labels, keyboard focus, `aria-live` for updates), responsive (no horizontal scroll at 390px), and give every loading, empty and error case a friendly state.

## C# / API Rules

- Controllers inherit `ApiControllerBase`: use `OpenConnection()`, `CurrentUserId`, `IsAdmin`, and `DatabaseError(ex)` (which logs the details and returns a generic message).
- Every query is parameterized. Column names in `ORDER BY` come from a fixed `switch`, never from user input.
- Admin endpoints use `[Authorize(Roles = "Admin")]`. Customer endpoints use `[Authorize]` and take the user from the cookie, **never** from a userId in the request body.
- Return clear messages with appropriate status codes (400 validation, 401 not signed in, 403 not admin, 404 not found, 409 conflict such as out of stock or duplicate SKU).
- Keep the code at a level an MIS 330 student can explain: no repositories, services layers, or ORMs unless approved.

## Database Rules

- Schema follows the ERD: `User`, `Category`, `Product`, `CustomerOrder`, `OrderItem` (composite PK). Added beyond the ERD: `Product.imageUrl`.
- **Never drop tables or delete data without explicit permission.** Setup scripts must stay safe to re-run.
- Order placement and order cancellation must stay in single transactions. Stock must never go negative (the `FOR UPDATE` lock, the conditional `UPDATE`, and the `CHECK` constraint all enforce it).
- `OrderItem.unitPrice` stores the price at purchase time. Reports use it, not the current price.
- Products on past orders are hidden (`isActive = FALSE`), not deleted.
- Report changes should be made in **both** `Database/reports.sql` and `ReportsController.cs`.

## Security Guidelines

- No real passwords or secrets in source. The connection string lives in .NET user secrets (`ConnectionStrings:CrimsonSupply`); `appsettings.json` has only a placeholder.
- Passwords are PBKDF2-hashed with a per-user salt (`AccountController`).
- Demo seed customers have the unusable hash `DEMO-NO-LOGIN`. Real accounts are created through the site, and admins are promoted with `make_admin.sql`.
- Never store real payment information. Checkout stays simulated ("pay at pickup").
- The browser never talks to MySQL directly.

## Working Style

- Inspect the relevant files before changing them; reuse what exists.
- After changes, build the API (`dotnet build`) and check that changed JS parses. Test affected flows where possible, and say clearly what was and wasn't tested.
- Don't commit or push unless asked.
- When explaining changes: say what changed and in which files, anything important to understand, commands to run, how to test, and any open concerns. Keep it student-friendly.
