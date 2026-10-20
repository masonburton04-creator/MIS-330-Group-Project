-- =============================================================
-- Crimson Supply: School and Office Supplies System
-- Database creation script (MySQL)
--
-- Builds the tables from the ERD:
--   User, Category, Product, CustomerOrder, OrderItem
--
-- Tables are created in dependency order: a table that has a
-- foreign key must be created AFTER the table it points to.
-- =============================================================

CREATE DATABASE IF NOT EXISTS crimson_supply;
USE crimson_supply;

-- Drop in reverse order so foreign keys don't block the drops.
-- This lets you re-run the script to start fresh.
DROP TABLE IF EXISTS OrderItem;
DROP TABLE IF EXISTS CustomerOrder;
DROP TABLE IF EXISTS Product;
DROP TABLE IF EXISTS Category;
DROP TABLE IF EXISTS User;


-- -------------------------------------------------------------
-- User
-- Stores both customers and admins. The role column decides
-- which features a user can access.
-- -------------------------------------------------------------
CREATE TABLE User (
    userId     INT AUTO_INCREMENT PRIMARY KEY,
    firstName  VARCHAR(50)  NOT NULL,
    lastName   VARCHAR(50)  NOT NULL,
    email      VARCHAR(100) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,               -- hashed password, never plain text
    phone     VARCHAR(20)  NULL,                     -- optional
    role       ENUM('Customer', 'Admin') NOT NULL DEFAULT 'Customer',
    createdAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- -------------------------------------------------------------
-- Category
-- One category contains zero or many products.
-- -------------------------------------------------------------
CREATE TABLE Category (
    categoryId    INT AUTO_INCREMENT PRIMARY KEY,
    categoryName  VARCHAR(50)  NOT NULL UNIQUE,
    description   VARCHAR(255) NULL                   -- optional
);


-- -------------------------------------------------------------
-- Product
-- Each product belongs to exactly one category.
-- isActive lets an admin hide a product without deleting it
-- (deleting would break old orders that reference it).
-- -------------------------------------------------------------
CREATE TABLE Product (
    productId      INT AUTO_INCREMENT PRIMARY KEY,
    sku            VARCHAR(30)   NOT NULL UNIQUE,
    productName    VARCHAR(100)  NOT NULL,
    description    TEXT          NULL,                -- optional
    price          DECIMAL(10,2) NOT NULL,
    stockQuantity  INT           NOT NULL DEFAULT 0,
    isActive       BOOLEAN       NOT NULL DEFAULT TRUE,
    createdAt      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    categoryId     INT           NOT NULL,

    CONSTRAINT fk_product_category
        FOREIGN KEY (categoryId) REFERENCES Category(categoryId),

    -- Business rules: no negative prices or negative inventory
    CONSTRAINT chk_product_price CHECK (price >= 0),
    CONSTRAINT chk_product_stock CHECK (stockQuantity >= 0)
);


-- -------------------------------------------------------------
-- CustomerOrder
-- One user places zero or many orders.
-- (Named CustomerOrder because ORDER is a reserved SQL word.)
-- -------------------------------------------------------------
CREATE TABLE CustomerOrder (
    orderId      INT AUTO_INCREMENT PRIMARY KEY,
    userId       INT           NOT NULL,
    orderDate    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    orderStatus  VARCHAR(20)   NOT NULL DEFAULT 'Placed',
    totalAmount  DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_order_user
        FOREIGN KEY (userId) REFERENCES User(userId),

    CONSTRAINT chk_order_total CHECK (totalAmount >= 0)
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
CREATE TABLE OrderItem (
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
