# Crimson Supply

**MIS 330 · Project B: School and Office Supplies System**

Crimson Supply is a full-stack retail site for school, office and studio supplies. It's built with one HTML page plus Bootstrap and plain JavaScript on the front end, an ASP.NET Core (C#) API on the back end, and a MySQL database.

> Crimson Supply is a fictional store. Checkout is simulated: no card details are collected and no payments are processed.

---

## Team setup guide

Follow these steps once on your own computer. It takes about 15 minutes. After that, running the site is just step 5.

### 1. Install the tools

| Tool | Why | Check it's installed |
|---|---|---|
| [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) | Runs the C# API (and the website) | `dotnet --version` shows `10.x` |
| [MySQL Server 8.0 + MySQL Workbench](https://dev.mysql.com/downloads/installer/) | The database | Workbench can connect to your local server |
| [Git](https://git-scm.com/downloads) | Getting the code | `git --version` |
| [VS Code](https://code.visualstudio.com/) *(optional)* | Editing | |

When the MySQL installer asks for a **root password**, pick one you'll remember. You'll need it in step 4. Leave the port at **3306**.

### 2. Get the code

**First time:**

```bash
git clone https://github.com/masonburton04-creator/MIS-330-Group-Project.git
cd MIS-330-Group-Project
```

**Already have an older copy?** Before pulling, delete your `API/bin` and `API/obj` folders. They're build output that is no longer stored in Git, and leftover copies make `git pull` fail with *"your local changes would be overwritten"*. They are rebuilt automatically the next time you run the site.

```bash
git pull
```

### 3. Create the database

In **MySQL Workbench**, connect to your local server. Then for each file below: **File → Open SQL Script**, then click the **lightning bolt** (Execute all).

1. **`Database/create_database.sql`** creates the `crimson_supply` database and its five tables.
2. **`Database/sample_data.sql`** adds the demo store: 6 departments, 28 products, and 8 demo customers with 32 past orders, so the reports have data.

Both scripts are **safe to run again**. They never delete anything. If you created the database from an older version of `create_database.sql`, just run the new one: it adds the missing `imageUrl` column for you.

To check it worked, click the refresh icon in Workbench's **Schemas** panel. You should see `crimson_supply` with 5 tables.

### 4. Tell the API your MySQL password

The API needs your MySQL password to connect. **Don't put it in `appsettings.json`**, because that file is shared on GitHub. Instead, .NET's *user secrets* stores it in your Windows profile, outside the project.

Open a terminal in the project folder and run this, replacing `YOUR_PASSWORD` with your MySQL root password:

```bash
cd API
dotnet user-secrets set "ConnectionStrings:CrimsonSupply" "Server=localhost;Port=3306;Database=crimson_supply;User=root;Password=YOUR_PASSWORD;"
```

To check it saved: `dotnet user-secrets list`.

*(Used a different MySQL user or port when installing? Change `User=` or `Port=` to match.)*

### 5. Run the site

```bash
cd API
dotnet run
```

When you see `Now listening on: http://localhost:5095`, open **http://localhost:5095** in your browser. Press **Ctrl + C** in the terminal to stop the site.

**Why not Live Server or double-clicking `index.html`?** The pages get all their data (products, accounts, orders) from the C# API, and the API talks to MySQL. Live Server can only show files; it can't run the API. `dotnet run` starts the API, which also serves the website at the same address. That also lets the sign-in cookie work.

**Tip:** while editing code, run **`dotnet watch run`** instead. It restarts automatically when you save a C# file and usually refreshes the browser when you change HTML, CSS or JS (if not, just refresh the page).

### 6. Make your accounts

Your database is separate from everyone else's, so you need your own accounts.

**Customer:** on the site, click **Sign in → Create account** and register.

**Admin:** there's no separate admin login. An admin signs in on the same form; their account just has the `Admin` role.
1. Register a second account on the site (for example `yourname.admin@example.com`).
2. In Workbench, open `Database/make_admin.sql`, replace both copies of `your-admin-email@example.com` with that email, and run it.
3. On the site, **sign out and sign back in**. An **Admin** button appears in the header.

The demo customers from `sample_data.sql` can't sign in. They exist only so the reports have order history.

### Troubleshooting

| Problem | Fix |
|---|---|
| Site says *"We couldn't reach the Crimson Supply server"* | The API isn't running. Run `dotnet run` in the `API` folder and use `http://localhost:5095`, not Live Server or a file path. |
| Pages load but show an error loading products | The API can't reach MySQL. Check the MySQL service is running (Workbench can connect) and that your user-secrets password is right (step 4). The terminal shows the exact error. |
| `Access denied for user 'root'` in the terminal | Wrong password in user secrets. Run the step 4 command again. |
| `Unknown database 'crimson_supply'` | Run `Database/create_database.sql` (step 3). |
| `Unknown column 'imageUrl'` | Your database is from the old script. Run the current `create_database.sql` again. |
| `Failed to bind to address … 5095` / address already in use | The site is already running in another terminal. Stop it with Ctrl + C, or close that terminal. |
| `dotnet user-secrets` says it can't find a project | Run it from inside the `API` folder. |
| No **Admin** button after running `make_admin.sql` | Sign out and sign back in. The role is read when you sign in. |
| `git pull` fails with "local changes would be overwritten" in `API/bin` or `API/obj` | Delete the `API/bin` and `API/obj` folders and pull again. |

### Working together

- **Pull before you start** (`git pull`), and commit and push when you finish something.
- Don't commit `API/bin`, `API/obj`, or any password. The `.gitignore` already skips the build folders.
- Database changes go in the scripts in `Database/` so everyone can re-run them, and the scripts must stay safe to re-run (never `DROP`).
- Project rules (approved technologies, code style) are in `CLAUDE.md`.

---

## What's included

| Area | Features |
|---|---|
| **Storefront** | Home page with live best sellers, departments, kits and new arrivals; full catalog; product detail pages with live stock |
| **Search & filtering** | Keyword search, department, price range, in-stock only, and six sort orders. All filtering is done by SQL on the server. |
| **Accounts** | Register, sign in/out, profile, password change, order history with "Buy again". Customer and Admin roles. |
| **Cart & checkout** | Bag drawer with quantity controls, checkout that requires sign-in, server-calculated totals, receipt page |
| **Inventory** | Each order and its items are saved, and stock is reduced, in **one MySQL transaction**. Stock never goes negative, even with simultaneous checkouts. |
| **Admin workspace** | Dashboard; products (add, edit, restock, hide/show, delete); categories; orders (status changes, cancel with restock) |
| **Reports** | Five SQL reports using `JOIN`, `GROUP BY` and aggregates, shown with charts and tables |

---

## Project layout

```text
API/                      ASP.NET Core API (also serves the website)
  Controllers/
    ApiControllerBase.cs  shared helpers: DB connection, current user, error handling
    AccountController.cs  register, login/logout, profile, password
    ProductsController.cs catalog search/filter, admin product management
    CategoriesController.cs
    OrdersController.cs   checkout transaction, order history, admin order status
    ReportsController.cs  the five business reports + dashboard numbers
  Models/                 the JSON shapes sent between browser and API
  Program.cs              cookie sign-in, serves ../Client
  API.http                sample requests for testing the API in VS Code
Client/
  index.html              the ONE html page (every "page" is a <section>)
  Resources/Scripts/
    index.js              helpers, router, home, shop, product pages, kits
    cart.js               bag, checkout, receipt
    account.js            sign in, register, account pages
    admin.js              admin workspace and reports
  Resources/Styles/index.css
  Resources/Images/products/   product illustrations (SVG)
Database/
  create_database.sql     step 1: database + 5 tables (safe to re-run)
  sample_data.sql         step 2 (optional): demo categories, products, customers, orders
  reports.sql             the five report queries, runnable in Workbench
  make_admin.sql          promote your account to Admin
```

---

## The five business reports

The SQL for each report is in `Database/reports.sql`, and the same queries are in `API/Controllers/ReportsController.cs`. They appear in the site under **Admin → Reports**. Cancelled orders are excluded from all sales numbers.

| # | Report | Business question | SQL concepts |
|---|---|---|---|
| 1 | Sales by product | Which products bring in the most money? | 4-table `JOIN`, `GROUP BY`, `SUM`, `COUNT(DISTINCT)` |
| 2 | Sales by category | Which departments perform best? | `JOIN`, `GROUP BY`, `SUM`, `AVG` |
| 3 | Sales by month | How are sales trending? | `JOIN`, `GROUP BY DATE_FORMAT`, `SUM`, `COUNT(DISTINCT)` |
| 4 | Customer purchasing activity | Who are the most valuable customers? | `LEFT JOIN`, `COUNT`, `SUM`, `AVG`, `MAX` |
| 5 | Inventory health by category | Where is stock low, and what's it worth? | `LEFT JOIN`, `SUM(CASE…)`, `COUNT`, `SUM` |

---

## How the important parts work

- **Passwords** are hashed with PBKDF2 (built into .NET) using a random salt per user and stored as `salt:hash`. Plain passwords are never stored.
- **Sign-in** uses ASP.NET Core's built-in cookie authentication. The cookie is HttpOnly (JavaScript can't read it) and SameSite=Strict. Admin endpoints use `[Authorize(Roles = "Admin")]`, so a customer gets **403 Forbidden** even if they call the API directly.
- **SQL** is always parameterized (`@name` parameters), never built from user input.
- **Checkout** (`OrdersController.PlaceOrder`) locks each product row with `SELECT … FOR UPDATE`, checks stock, saves `CustomerOrder` and `OrderItem` rows, and decrements stock, all in one transaction. If any step fails, nothing is saved. Prices always come from the database, never from the browser, and `OrderItem.unitPrice` keeps the price paid even if the product price changes later.
- **Cancelling an order** (admin) returns its items to stock in a transaction.
- **Deleting products:** a product that appears on past orders can only be *hidden* (`isActive = FALSE`), so order history stays intact.

## Schema notes (differences from the ERD)

- `Product.imageUrl` was added (the path to the product picture).
- The tables are named `CustomerOrder` and `OrderItem`, matching the ERD's `customerOrder`/`orderItem`. MySQL on Windows ignores table-name case.
- `orderStatus` values: `Placed`, `Ready for Pickup`, `Completed`, `Cancelled`.
- Extra constraints: `CHECK` rules for no negative price, stock, quantity or totals; `UNIQUE` email, SKU and category name; an index on `orderDate` for the monthly report.
