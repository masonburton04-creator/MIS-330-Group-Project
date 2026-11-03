-- =============================================================
-- Crimson Supply: School and Office Supplies System
-- Step 1 of setup: create the database and its five tables (MySQL 8)
--
-- Tables from the ERD:
--   User, Category, Product, CustomerOrder, OrderItem
--
-- SAFE TO RE-RUN: every statement uses IF NOT EXISTS, so running
-- this script again never drops a table or deletes data.
-- (To start completely over, see the note at the bottom.)
--
-- Tables are created in dependency order: a table with a foreign
-- key must be created AFTER the table it points to.
-- =============================================================

CREATE DATABASE IF NOT EXISTS crimson_supply;
USE crimson_supply;


-- -------------------------------------------------------------
-- User
-- Stores both customers and admins. The role column decides
-- which features a user can access. New sign-ups are always
-- 'Customer'; an admin is promoted with make_admin.sql.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS User (
    userId        INT AUTO_INCREMENT PRIMARY KEY,
    firstName     VARCHAR(50)  NOT NULL,
    lastName      VARCHAR(50)  NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    passwordHash  VARCHAR(255) NOT NULL,              -- "salt:hash" (PBKDF2), never the plain password
    phone         VARCHAR(20)  NULL,                  -- optional
    role          ENUM('Customer', 'Admin') NOT NULL DEFAULT 'Customer',
    createdAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- -------------------------------------------------------------
-- Category
-- One category contains zero or many products.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Category (
    categoryId    INT AUTO_INCREMENT PRIMARY KEY,
    categoryName  VARCHAR(50)  NOT NULL UNIQUE,
    description   VARCHAR(255) NULL                   -- optional
);


-- -------------------------------------------------------------
-- Product
-- Each product belongs to exactly one category.
-- isActive lets an admin hide a product without deleting it
-- (deleting would break old orders that reference it).
-- imageUrl is the one column added beyond the ERD: it holds the
-- path of the product picture, e.g. 'Resources/Images/products/gel-pens.svg'.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Product (
    productId      INT AUTO_INCREMENT PRIMARY KEY,
    sku            VARCHAR(30)   NOT NULL UNIQUE,
    productName    VARCHAR(100)  NOT NULL,
    description    TEXT          NULL,
    price          DECIMAL(10,2) NOT NULL,
    stockQuantity  INT           NOT NULL DEFAULT 0,
    imageUrl       VARCHAR(255)  NULL,
    isActive       BOOLEAN       NOT NULL DEFAULT TRUE,
    createdAt      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    categoryId     INT           NOT NULL,

    CONSTRAINT fk_product_category
        FOREIGN KEY (categoryId) REFERENCES Category(categoryId),

    -- Business rules: no negative prices or negative inventory.
    -- The CHECK on stockQuantity is the database's last line of
    -- defense: even a buggy UPDATE can't make stock go below 0.
    CONSTRAINT chk_product_price CHECK (price >= 0),
    CONSTRAINT chk_product_stock CHECK (stockQuantity >= 0)
);


-- -------------------------------------------------------------
-- CustomerOrder
-- One user places zero or many orders.
-- (Named CustomerOrder because ORDER is a reserved SQL word.)
-- orderStatus is one of: 'Placed', 'Ready for Pickup', 'Completed', 'Cancelled'
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CustomerOrder (
    orderId      INT AUTO_INCREMENT PRIMARY KEY,
    userId       INT           NOT NULL,
    orderDate    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    orderStatus  VARCHAR(20)   NOT NULL DEFAULT 'Placed',
    totalAmount  DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_order_user
        FOREIGN KEY (userId) REFERENCES User(userId),

    CONSTRAINT chk_order_total CHECK (totalAmount >= 0),

    -- The sales-over-time report groups by orderDate
    INDEX idx_order_date (orderDate)
);


-- -------------------------------------------------------------
-- OrderItem  (the "Includes" relationship in the ERD)
-- Many-to-many between CustomerOrder and Product, so it becomes
-- its own table. quantity and unitPrice live here because they
-- describe one product on one order.
--
-- unitPrice is saved at the time of purchase so old orders stay
-- correct even if the product's price changes later.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS OrderItem (
    orderId    INT           NOT NULL,
    productId  INT           NOT NULL,
    quantity   INT           NOT NULL,
    unitPrice  DECIMAL(10,2) NOT NULL,

    -- Composite primary key: a product appears at most once per order
    PRIMARY KEY (orderId, productId),

    CONSTRAINT fk_orderitem_order
        FOREIGN KEY (orderId) REFERENCES CustomerOrder(orderId),
    CONSTRAINT fk_orderitem_product
        FOREIGN KEY (productId) REFERENCES Product(productId),

    CONSTRAINT chk_orderitem_quantity CHECK (quantity > 0),
    CONSTRAINT chk_orderitem_price    CHECK (unitPrice >= 0)
);


-- -------------------------------------------------------------
-- Upgrade older copies of the database
-- The first version of this script (before Oct 29, 2026) made
-- Product without imageUrl and CustomerOrder without the
-- orderDate index. CREATE TABLE IF NOT EXISTS skips tables that
-- already exist, so these steps add what's missing.
--
-- MySQL has no "ADD COLUMN IF NOT EXISTS", so each step checks
-- information_schema first and only runs the ALTER when needed
-- ('DO 0' does nothing). Safe to re-run; no data is removed.
-- -------------------------------------------------------------
SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Product' AND COLUMN_NAME = 'imageUrl') = 0,
    'ALTER TABLE Product ADD COLUMN imageUrl VARCHAR(255) NULL AFTER stockQuantity',
    'DO 0');
PREPARE upgradeStep FROM @sql;
EXECUTE upgradeStep;
DEALLOCATE PREPARE upgradeStep;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CustomerOrder' AND INDEX_NAME = 'idx_order_date') = 0,
    'ALTER TABLE CustomerOrder ADD INDEX idx_order_date (orderDate)',
    'DO 0');
PREPARE upgradeStep FROM @sql;
EXECUTE upgradeStep;
DEALLOCATE PREPARE upgradeStep;


-- =============================================================
-- Starting over (DESTRUCTIVE - deletes every order and account)
-- Only if you really want an empty database, run these by hand
-- in this order, then run this script again:
--
--   DROP TABLE OrderItem;
--   DROP TABLE CustomerOrder;
--   DROP TABLE Product;
--   DROP TABLE Category;
--   DROP TABLE User;
-- =============================================================
