-- =============================================================
-- Crimson Supply: OPTIONAL demo data for class demonstrations
-- Step 2 of setup. Run AFTER create_database.sql.
--
-- What it adds:
--   * 6 categories and 28 demo products (made-up items, not a real store's inventory)
--   * 8 demo customers with order history from May-Oct 2026, so the
--     admin reports have real rows to summarize
--
-- SAFE TO RE-RUN: nothing is deleted or overwritten.
--   * Categories, products, and users are matched on their UNIQUE
--     columns (categoryName, sku, email) with INSERT IGNORE, so a row
--     that already exists is skipped.
--   * Demo orders are only inserted if that customer does not already
--     have an order at that exact date/time.
--
-- Demo customers CANNOT log in: their passwordHash is not a real
-- hash, so no password is stored anywhere in this file. Create your
-- own accounts on the website (see README.md).
-- =============================================================

USE crimson_supply;


-- -------------------------------------------------------------
-- Categories
-- -------------------------------------------------------------
INSERT IGNORE INTO Category (categoryName, description) VALUES
('Writing Instruments', 'Pens, pencils, markers and highlighters that make every note feel deliberate.'),
('Notebooks & Paper',   'Notebooks, pads and sticky notes for class, studio and office.'),
('Desk & Organization', 'Folders, binders, staplers and organizers that keep a workspace calm.'),
('Tech Essentials',     'Calculators, cables, mice and the small gadgets that keep work moving.'),
('Bags & Carry',        'Backpacks, cases and sleeves built for the commute between class and work.'),
('Art & Studio',        'Sketchbooks, color and cutting tools for drawing, design and studio projects.');


-- -------------------------------------------------------------
-- Products
-- categoryId is looked up by name with a subquery, so this works
-- no matter which ID numbers MySQL gave the categories.
-- Stock levels are mixed on purpose so every case can be demoed:
-- plenty in stock, low stock (10 or fewer), and sold out (0).
-- -------------------------------------------------------------
INSERT IGNORE INTO Product (sku, productName, description, price, stockQuantity, imageUrl, createdAt, categoryId) VALUES
-- Writing Instruments
('WRT-101', 'Gel Ink Pens, 0.7 mm (8-Pack)', 'Quick-drying gel ink in eight saturated colors. Smooth enough for long lecture notes, bold enough for color-coding.', 9.50, 64, 'Resources/Images/products/gel-pens.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Writing Instruments')),
('WRT-102', 'Fineliner Set, 0.4 mm (12 Colors)', 'Fiber-tip fineliners with water-based ink that will not bleed through most notebook paper. A planner and diagram favorite.', 14.00, 38, 'Resources/Images/products/fineliners.svg', '2026-04-11 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Writing Instruments')),
('WRT-103', 'Drafting Mechanical Pencil, 0.5 mm', 'Weighted metal grip, retractable tip and a lead-hardness window. Built for precise sketches, formulas and graph paper work.', 11.00, 27, 'Resources/Images/products/mechanical-pencil.svg', '2026-05-20 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Writing Instruments')),
('WRT-104', 'Pastel Highlighters (6-Pack)', 'Soft chisel-tip highlighters in muted tones that mark the important lines without shouting over the text.', 7.25, 6, 'Resources/Images/products/highlighters.svg', '2026-06-03 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Writing Instruments')),
('WRT-105', 'Everyday Fountain Pen', 'A forgiving medium nib, a converter and two ink cartridges. The easiest way to make handwriting feel special.', 24.00, 12, 'Resources/Images/products/fountain-pen.svg', '2026-10-21 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Writing Instruments')),
('WRT-106', 'Graphite Pencils, HB (12-Pack)', 'Pre-sharpened cedar pencils with latex-free erasers. Ready for exams, sketching and scantrons.', 5.50, 90, 'Resources/Images/products/pencils.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Writing Instruments')),

-- Notebooks & Paper
('NBP-201', 'Dot Grid Notebook, A5 Hardcover', '160 numbered pages of 100 gsm paper, two ribbon markers and a back pocket. Lies flat for journaling and bullet planning.', 16.00, 45, 'Resources/Images/products/dot-notebook.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Notebooks & Paper')),
('NBP-202', '3-Subject Spiral Notebook', '150 college-ruled sheets with sturdy poly covers and pocket dividers. One notebook for three classes.', 6.75, 80, 'Resources/Images/products/spiral-notebook.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Notebooks & Paper')),
('NBP-203', 'Sticky Notes Variety Pack (12 Pads)', 'Twelve 3 x 3 in pads in four colors with a strong, repositionable adhesive.', 8.50, 3, 'Resources/Images/products/sticky-notes.svg', '2026-04-28 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Notebooks & Paper')),
('NBP-204', 'Canary Legal Pads (6-Pack)', 'Classic yellow 8.5 x 11.75 in pads, 50 sheets each, perforated at the top for clean tear-outs.', 10.25, 30, 'Resources/Images/products/legal-pad.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Notebooks & Paper')),
('NBP-205', 'Composition Notebook, College Ruled', 'Sewn binding and 100 sheets that stay put. The lab notebook that survives the whole semester.', 3.95, 0, 'Resources/Images/products/composition.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Notebooks & Paper')),

-- Desk & Organization
('DSK-301', 'Mesh Desk Organizer', 'Five compartments and a sliding drawer in powder-coated steel mesh. Pens up front, paper clips out of sight.', 22.00, 18, 'Resources/Images/products/desk-organizer.svg', '2026-05-06 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Desk & Organization')),
('DSK-302', 'Poly Pocket Folders (6-Pack)', 'Water-resistant two-pocket folders in six colors, with business-card slots. Built to outlast paper folders.', 6.50, 70, 'Resources/Images/products/folders.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Desk & Organization')),
('DSK-303', '1.5 in View Binder', 'Clear overlay cover for custom inserts, D-rings that hold 350 sheets and two inside pockets.', 8.95, 4, 'Resources/Images/products/binder.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Desk & Organization')),
('DSK-304', 'Heavy-Duty Desk Stapler', 'All-metal stapler that drives through 40 sheets with one press. Includes 1,000 staples.', 18.50, 15, 'Resources/Images/products/stapler.svg', '2026-07-14 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Desk & Organization')),
('DSK-305', 'Weekly Desk Planner Pad', '52 undated tear-off sheets with a weekly grid, priorities box and notes column.', 12.00, 22, 'Resources/Images/products/desk-planner.svg', '2026-10-24 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Desk & Organization')),

-- Tech Essentials
('TEC-401', 'Scientific Calculator, 2-Line', '240 functions, fractions, statistics and a slide-on hard case. Approved for most standardized tests.', 17.99, 25, 'Resources/Images/products/calculator.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Tech Essentials')),
('TEC-402', 'Silent Wireless Mouse', 'Near-silent clicks for libraries and shared offices, with a tuck-away USB receiver and 18-month battery life.', 21.00, 14, 'Resources/Images/products/mouse.svg', '2026-06-18 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Tech Essentials')),
('TEC-403', 'Braided USB-C Cable, 6 ft', 'Nylon-braided USB-C to USB-C cable rated for 60 W charging and fast data transfer. Long enough to reach the outlet.', 13.50, 2, 'Resources/Images/products/usb-cable.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Tech Essentials')),
('TEC-404', 'Aluminum Laptop Stand', 'Raises your screen to eye level and folds flat for the backpack. Fits laptops from 10 to 16 in.', 34.00, 9, 'Resources/Images/products/laptop-stand.svg', '2026-10-17 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Tech Essentials')),
('TEC-405', 'USB Flash Drive, 64 GB', 'Swivel-cap USB 3.2 drive with a keyring loop. For presentations, backups and the lab printer.', 11.25, 40, 'Resources/Images/products/flash-drive.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Tech Essentials')),

-- Bags & Carry
('BAG-501', 'Commuter Backpack, 24 L', 'Water-resistant canvas, a padded 15 in laptop compartment and a luggage pass-through for travel days.', 64.00, 7, 'Resources/Images/products/backpack.svg', '2026-08-04 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Bags & Carry')),
('BAG-502', 'Canvas Zip Pencil Case', 'Waxed canvas pouch with a sturdy metal zipper. Holds about 30 pens, plus a calculator if you squeeze.', 12.50, 33, 'Resources/Images/products/pencil-case.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Bags & Carry')),
('BAG-503', 'Padded Laptop Sleeve, 14 in', 'Felt-lined sleeve with a front pocket for a charger and cables. Slides into any bag.', 28.00, 11, 'Resources/Images/products/laptop-sleeve.svg', '2026-09-09 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Bags & Carry')),

-- Art & Studio
('ART-601', 'Hardbound Sketchbook, 9 x 12 in', '110 sheets of acid-free 90 lb drawing paper in a stitched hardcover that opens flat.', 15.50, 26, 'Resources/Images/products/sketchbook.svg', '2026-03-02 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Art & Studio')),
('ART-602', 'Watercolor Travel Set (24 Colors)', 'Twenty-four half pans, a water brush and a mixing lid that closes into a pocket-sized tin.', 26.00, 8, 'Resources/Images/products/watercolor.svg', '2026-10-27 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Art & Studio')),
('ART-603', 'Colored Pencils (36 Colors)', 'Soft, richly pigmented cores that layer and blend. Comes in a tin that doubles as a stand.', 19.00, 0, 'Resources/Images/products/colored-pencils.svg', '2026-04-11 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Art & Studio')),
('ART-604', 'Self-Healing Cutting Mat, A3', 'Five-layer mat with a printed grid and angle guides. The surface closes back up after every cut.', 16.75, 13, 'Resources/Images/products/cutting-mat.svg', '2026-05-20 09:00:00', (SELECT categoryId FROM Category WHERE categoryName = 'Art & Studio'));


-- -------------------------------------------------------------
-- Demo customers (they own the historical orders below)
-- 'DEMO-NO-LOGIN' is not a valid "salt:hash" value, so the API
-- refuses every password for these accounts.
-- @example.com is a domain reserved for examples, so these
-- addresses can never belong to a real person.
-- -------------------------------------------------------------
INSERT IGNORE INTO User (firstName, lastName, email, passwordHash, phone, role, createdAt) VALUES
('Maya',   'Thompson', 'maya.thompson@example.com', 'DEMO-NO-LOGIN', '205-555-0142', 'Customer', '2026-04-30 10:15:00'),
('Jordan', 'Ellis',    'jordan.ellis@example.com',  'DEMO-NO-LOGIN', NULL,           'Customer', '2026-05-02 16:40:00'),
('Priya',  'Raman',    'priya.raman@example.com',   'DEMO-NO-LOGIN', '205-555-0177', 'Customer', '2026-05-11 08:05:00'),
('Marcus', 'Bell',     'marcus.bell@example.com',   'DEMO-NO-LOGIN', NULL,           'Customer', '2026-06-01 12:30:00'),
('Sofia',  'Alvarez',  'sofia.alvarez@example.com', 'DEMO-NO-LOGIN', '205-555-0119', 'Customer', '2026-07-21 19:45:00'),
('Ethan',  'Park',     'ethan.park@example.com',    'DEMO-NO-LOGIN', NULL,           'Customer', '2026-08-10 09:20:00'),
('Hannah', 'Brooks',   'hannah.brooks@example.com', 'DEMO-NO-LOGIN', '205-555-0163', 'Customer', '2026-08-15 14:10:00'),
('Devon',  'Carter',   'devon.carter@example.com',  'DEMO-NO-LOGIN', NULL,           'Customer', '2026-09-03 11:55:00');


-- -------------------------------------------------------------
-- Demo orders
-- The orders are typed into two TEMPORARY tables first (they
-- disappear when you disconnect), then copied into CustomerOrder
-- and OrderItem with JOINs that look up the real userId and
-- productId values.
-- -------------------------------------------------------------
CREATE TEMPORARY TABLE demo_order (
    ref        INT PRIMARY KEY,
    email      VARCHAR(100),
    orderDate  DATETIME,
    status     VARCHAR(20)
);

CREATE TEMPORARY TABLE demo_item (
    ref       INT,
    sku       VARCHAR(30),
    quantity  INT
);

INSERT INTO demo_order VALUES
( 1, 'maya.thompson@example.com', '2026-05-04 10:12:00', 'Completed'),
( 2, 'jordan.ellis@example.com',  '2026-05-09 15:30:00', 'Completed'),
( 3, 'priya.raman@example.com',   '2026-05-14 09:02:00', 'Completed'),
( 4, 'maya.thompson@example.com', '2026-05-27 18:44:00', 'Completed'),
( 5, 'marcus.bell@example.com',   '2026-06-03 13:15:00', 'Completed'),
( 6, 'priya.raman@example.com',   '2026-06-12 11:48:00', 'Completed'),
( 7, 'jordan.ellis@example.com',  '2026-06-19 20:05:00', 'Cancelled'),
( 8, 'marcus.bell@example.com',   '2026-06-28 08:37:00', 'Completed'),
( 9, 'maya.thompson@example.com', '2026-07-08 12:20:00', 'Completed'),
(10, 'priya.raman@example.com',   '2026-07-16 16:55:00', 'Completed'),
(11, 'sofia.alvarez@example.com', '2026-07-23 10:40:00', 'Completed'),
(12, 'jordan.ellis@example.com',  '2026-07-30 14:25:00', 'Completed'),
(13, 'ethan.park@example.com',    '2026-08-11 09:10:00', 'Completed'),
(14, 'hannah.brooks@example.com', '2026-08-16 15:00:00', 'Completed'),
(15, 'sofia.alvarez@example.com', '2026-08-18 11:35:00', 'Completed'),
(16, 'marcus.bell@example.com',   '2026-08-20 19:12:00', 'Completed'),
(17, 'priya.raman@example.com',   '2026-08-22 10:05:00', 'Completed'),
(18, 'ethan.park@example.com',    '2026-08-25 13:48:00', 'Completed'),
(19, 'maya.thompson@example.com', '2026-08-27 17:30:00', 'Completed'),
(20, 'hannah.brooks@example.com', '2026-09-02 08:50:00', 'Completed'),
(21, 'devon.carter@example.com',  '2026-09-04 12:15:00', 'Completed'),
(22, 'jordan.ellis@example.com',  '2026-09-10 16:20:00', 'Completed'),
(23, 'sofia.alvarez@example.com', '2026-09-17 10:30:00', 'Cancelled'),
(24, 'priya.raman@example.com',   '2026-09-24 14:45:00', 'Completed'),
(25, 'devon.carter@example.com',  '2026-10-01 09:40:00', 'Completed'),
(26, 'maya.thompson@example.com', '2026-10-06 18:05:00', 'Completed'),
(27, 'ethan.park@example.com',    '2026-10-12 11:25:00', 'Completed'),
(28, 'hannah.brooks@example.com', '2026-10-19 15:50:00', 'Ready for Pickup'),
(29, 'marcus.bell@example.com',   '2026-10-24 10:10:00', 'Ready for Pickup'),
(30, 'priya.raman@example.com',   '2026-10-27 13:35:00', 'Placed'),
(31, 'devon.carter@example.com',  '2026-10-28 09:55:00', 'Placed'),
(32, 'sofia.alvarez@example.com', '2026-10-28 17:20:00', 'Placed');

INSERT INTO demo_item VALUES
( 1, 'WRT-101', 2), ( 1, 'NBP-202', 3), ( 1, 'DSK-302', 1),
( 2, 'TEC-401', 1), ( 2, 'WRT-106', 2),
( 3, 'NBP-201', 1), ( 3, 'WRT-102', 1), ( 3, 'WRT-104', 1),
( 4, 'NBP-203', 2), ( 4, 'WRT-101', 1),
( 5, 'TEC-402', 1), ( 5, 'TEC-405', 2), ( 5, 'NBP-204', 1),
( 6, 'ART-601', 1), ( 6, 'ART-604', 1), ( 6, 'WRT-103', 1),
( 7, 'BAG-502', 1), ( 7, 'WRT-101', 1),
( 8, 'DSK-301', 1), ( 8, 'DSK-303', 2), ( 8, 'DSK-302', 2),
( 9, 'NBP-201', 2), ( 9, 'WRT-102', 1),
(10, 'ART-603', 1), (10, 'ART-601', 1),
(11, 'NBP-202', 4), (11, 'WRT-106', 2), (11, 'WRT-104', 2), (11, 'BAG-502', 1),
(12, 'TEC-403', 2), (12, 'TEC-402', 1),
(13, 'TEC-401', 1), (13, 'NBP-205', 3), (13, 'WRT-106', 1),
(14, 'BAG-501', 1), (14, 'BAG-502', 1), (14, 'NBP-202', 2),
(15, 'DSK-303', 3), (15, 'DSK-302', 2), (15, 'NBP-203', 1),
(16, 'TEC-405', 1), (16, 'TEC-403', 1),
(17, 'WRT-101', 2), (17, 'WRT-104', 1), (17, 'NBP-201', 1),
(18, 'BAG-501', 1), (18, 'TEC-401', 1), (18, 'NBP-205', 2),
(19, 'ART-602', 1), (19, 'ART-601', 1), (19, 'WRT-102', 1),
(20, 'DSK-304', 1), (20, 'NBP-204', 2),
(21, 'BAG-503', 1), (21, 'TEC-402', 1), (21, 'TEC-403', 1),
(22, 'WRT-101', 3), (22, 'NBP-202', 2),
(23, 'TEC-404', 1),
(24, 'ART-603', 1), (24, 'ART-604', 1), (24, 'WRT-103', 2),
(25, 'NBP-203', 3), (25, 'WRT-104', 2), (25, 'DSK-301', 1),
(26, 'NBP-201', 1), (26, 'WRT-105', 1),
(27, 'BAG-501', 1), (27, 'BAG-503', 1),
(28, 'TEC-404', 1), (28, 'TEC-402', 1), (28, 'DSK-305', 1),
(29, 'WRT-101', 2), (29, 'NBP-203', 2), (29, 'DSK-302', 1),
(30, 'ART-602', 1), (30, 'ART-601', 2),
(31, 'TEC-401', 1), (31, 'NBP-202', 3), (31, 'WRT-106', 2),
(32, 'WRT-105', 1), (32, 'NBP-201', 1), (32, 'DSK-305', 1);

-- 1) Create each order (totalAmount is filled in by step 3).
--    NOT EXISTS skips an order that was already added by an earlier run.
INSERT INTO CustomerOrder (userId, orderDate, orderStatus, totalAmount)
SELECT u.userId, d.orderDate, d.status, 0
FROM demo_order d
JOIN User u ON u.email = d.email
WHERE NOT EXISTS (
    SELECT 1 FROM CustomerOrder o
    WHERE o.userId = u.userId AND o.orderDate = d.orderDate
);

-- 2) Add the items. unitPrice is copied from the product's current price.
--    INSERT IGNORE skips items already saved by an earlier run.
INSERT IGNORE INTO OrderItem (orderId, productId, quantity, unitPrice)
SELECT o.orderId, p.productId, i.quantity, p.price
FROM demo_item i
JOIN demo_order d     ON d.ref = i.ref
JOIN User u           ON u.email = d.email
JOIN CustomerOrder o  ON o.userId = u.userId AND o.orderDate = d.orderDate
JOIN Product p        ON p.sku = i.sku;

-- 3) Set each new order's total = item subtotal + 8% sales tax,
--    the same formula the API uses at checkout.
--    Workbench's "Safe Updates" mode blocks an UPDATE whose WHERE
--    doesn't use a key column (error 1175), so it is switched off
--    for this one statement and back on right after.
SET SQL_SAFE_UPDATES = 0;
UPDATE CustomerOrder o
JOIN (
    SELECT orderId, SUM(quantity * unitPrice) AS subtotal
    FROM OrderItem
    GROUP BY orderId
) t ON t.orderId = o.orderId
SET o.totalAmount = t.subtotal + ROUND(t.subtotal * 0.08, 2)
WHERE o.totalAmount = 0;
SET SQL_SAFE_UPDATES = 1;

DROP TEMPORARY TABLE demo_item;
DROP TEMPORARY TABLE demo_order;
