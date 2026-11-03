-- =============================================================
-- Crimson Supply: the five business-report queries
--
-- These are the same queries the API runs in
-- API/Controllers/ReportsController.cs to fill the admin
-- "Reports" screen. You can also run them here in Workbench.
--
-- Cancelled orders are left out of every sales report, because
-- that money was never collected.
-- =============================================================

USE crimson_supply;


-- -------------------------------------------------------------
-- Report 1: Sales by product (best sellers)
-- Which products bring in the most money?
-- JOINs OrderItem -> CustomerOrder (to skip cancelled orders),
-- -> Product and -> Category (for names).
-- Revenue uses the unitPrice saved on each order item, so a later
-- price change does not rewrite history.
-- -------------------------------------------------------------
SELECT p.productId,
       p.sku,
       p.productName,
       c.categoryName,
       COUNT(DISTINCT oi.orderId)       AS ordersCount,
       SUM(oi.quantity)                 AS unitsSold,
       SUM(oi.quantity * oi.unitPrice)  AS revenue
FROM OrderItem oi
JOIN CustomerOrder o ON o.orderId    = oi.orderId
JOIN Product p       ON p.productId  = oi.productId
JOIN Category c      ON c.categoryId = p.categoryId
WHERE o.orderStatus <> 'Cancelled'
GROUP BY p.productId, p.sku, p.productName, c.categoryName
ORDER BY revenue DESC;


-- -------------------------------------------------------------
-- Report 2: Sales by category
-- Which departments of the store perform best?
-- -------------------------------------------------------------
SELECT c.categoryId,
       c.categoryName,
       COUNT(DISTINCT o.orderId)        AS ordersCount,
       SUM(oi.quantity)                 AS unitsSold,
       SUM(oi.quantity * oi.unitPrice)  AS revenue,
       ROUND(AVG(oi.unitPrice), 2)      AS avgUnitPrice
FROM Category c
JOIN Product p       ON p.categoryId = c.categoryId
JOIN OrderItem oi    ON oi.productId = p.productId
JOIN CustomerOrder o ON o.orderId    = oi.orderId
WHERE o.orderStatus <> 'Cancelled'
GROUP BY c.categoryId, c.categoryName
ORDER BY revenue DESC;


-- -------------------------------------------------------------
-- Report 3: Sales by month
-- How are sales trending over time?
-- Merchandise sales = item subtotals (before tax).
-- Average order value = merchandise sales / number of orders.
-- -------------------------------------------------------------
SELECT DATE_FORMAT(o.orderDate, '%Y-%m')  AS salesMonth,
       COUNT(DISTINCT o.orderId)          AS ordersCount,
       SUM(oi.quantity)                   AS unitsSold,
       SUM(oi.quantity * oi.unitPrice)    AS merchandiseSales,
       ROUND(SUM(oi.quantity * oi.unitPrice) / COUNT(DISTINCT o.orderId), 2) AS avgOrderValue
FROM CustomerOrder o
JOIN OrderItem oi ON oi.orderId = o.orderId
WHERE o.orderStatus <> 'Cancelled'
GROUP BY salesMonth
ORDER BY salesMonth;


-- -------------------------------------------------------------
-- Report 4: Customer purchasing activity
-- Who are the most valuable customers?
-- LEFT JOIN keeps customers who have never ordered (they show 0).
-- The cancelled-order filter is in the ON clause, not WHERE,
-- so it doesn't remove those zero-order customers.
-- -------------------------------------------------------------
SELECT u.userId,
       CONCAT(u.firstName, ' ', u.lastName)   AS customerName,
       u.email,
       COUNT(o.orderId)                       AS ordersCount,
       COALESCE(SUM(o.totalAmount), 0)        AS totalSpent,
       COALESCE(ROUND(AVG(o.totalAmount), 2), 0) AS avgOrderTotal,
       MAX(o.orderDate)                       AS lastOrderDate
FROM User u
LEFT JOIN CustomerOrder o
       ON o.userId = u.userId AND o.orderStatus <> 'Cancelled'
WHERE u.role = 'Customer'
GROUP BY u.userId, u.firstName, u.lastName, u.email
ORDER BY totalSpent DESC, customerName;


-- -------------------------------------------------------------
-- Report 5: Inventory health by category
-- Where is stock running low, and how much money is sitting on
-- the shelves? Counts only active (for-sale) products.
-- Low stock = 1 to 10 units left. Out of stock = 0 units.
-- -------------------------------------------------------------
SELECT c.categoryId,
       c.categoryName,
       COUNT(p.productId)                                        AS activeProducts,
       COALESCE(SUM(p.stockQuantity), 0)                         AS unitsInStock,
       COALESCE(SUM(p.stockQuantity * p.price), 0)               AS inventoryValue,
       SUM(CASE WHEN p.stockQuantity BETWEEN 1 AND 10 THEN 1 ELSE 0 END) AS lowStockProducts,
       SUM(CASE WHEN p.stockQuantity = 0 THEN 1 ELSE 0 END)      AS outOfStockProducts
FROM Category c
LEFT JOIN Product p ON p.categoryId = c.categoryId AND p.isActive = TRUE
GROUP BY c.categoryId, c.categoryName
ORDER BY (lowStockProducts + outOfStockProducts) DESC, c.categoryName;
