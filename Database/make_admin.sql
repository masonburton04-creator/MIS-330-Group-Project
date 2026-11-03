-- =============================================================
-- Crimson Supply: give an existing account the Admin role
--
-- 1. Register a normal account on the website first
--    (passwords are hashed by the API, so accounts can't be typed in here).
-- 2. Replace the email below with that account's email and run this.
-- 3. On the website, sign out and sign back in. The role is read when
--    you sign in, so the Admin workspace appears after signing in again.
-- =============================================================

USE crimson_supply;

UPDATE User
SET role = 'Admin'
WHERE email = 'your-admin-email@example.com';

-- Check the result (should show role = Admin)
SELECT userId, firstName, lastName, email, role
FROM User
WHERE email = 'your-admin-email@example.com';
