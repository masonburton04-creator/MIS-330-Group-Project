# Crimson Supply — MIS 330 Group Project (Project B)

## What this is
School/office supplies e-commerce site for a fictional retailer, "Crimson Supply." Course assignment for MIS 330, built as a group project. Two deliverables:

- **Task 1**: A website that interacts with a MySQL database (requirements collection → ERD/relational schema → implementation → front-end → data loading).
- **Task 2**: Five SQL queries (using joins and summary/aggregate queries) that generate meaningful business reports for a manager.

## Current phase
Front-end mockup only. There is no backend wired up yet and no database connection in the code. `index.html`, `resources/style/index.css`, and `resources/script/index.js` are placeholders to be filled in. Don't add a backend framework, ORM, or DB connection code unless explicitly asked — right now the goal is static HTML/CSS/JS for the UI.

## Structure
```
index.html
resources/
  style/index.css
  script/index.js
```
Keep this flat structure (plain HTML/CSS/JS, no bundler) unless the group decides to add a backend stack later. If/when a backend is chosen, ask before scaffolding it rather than assuming a stack.

## Required site functions (per assignment)
- User Management (registration, login, profiles)
- Product Listing & Management (CRUD)
- Search and Filtering (keyword search, sorting)
- Customer Purchase Transaction Management (order placement/confirmation)
- Inventory Management (update stock after sales/new inventory)

## Database deliverables
Task 1's ERD, relational schema, and Task 2's SQL queries are separate deliverables from the live site — they don't need to be wired into the running front end. When asked to produce these, write plain `.sql` files (schema + sample data + the five report queries) rather than trying to connect the mockup to a live database.

## Group project conventions
This repo is shared with teammates. When making changes:
- Keep commits scoped and don't restructure files teammates may be actively editing without flagging it.
- Favor plain, readable HTML/CSS/JS (no build step) so non-technical teammates can still open and edit files directly.
- If a workflow convention (branching, PRs, who owns what) comes up, add it here.

## Style
No comments unless explaining a non-obvious workaround. No unused scaffolding — build only what's asked for a given step (e.g., don't add cart/checkout logic before it's requested).
