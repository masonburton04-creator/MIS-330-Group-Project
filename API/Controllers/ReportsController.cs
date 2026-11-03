using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    // Business reports for the admin workspace. Admin only.
    //
    // The five assignment reports are the same queries as Database/reports.sql.
    // Each endpoint just runs its SQL with ReadRows, so the JSON field names
    // are exactly the column aliases in the query (e.g. "unitsSold", "revenue").
    // Cancelled orders are left out of every sales number.
    [Authorize(Roles = "Admin")]
    [Route("api/reports")]
    [ApiController]
    public class ReportsController : ApiControllerBase
    {
        // A product with this many units or fewer counts as "low stock"
        private const int LowStockThreshold = 10;

        public ReportsController(IConfiguration configuration) : base(configuration) { }

        // Report 1 - GET: api/reports/sales-by-product
        [HttpGet("sales-by-product")]
        public IActionResult SalesByProduct() => RunReport(@"
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
            ORDER BY revenue DESC");

        // Report 2 - GET: api/reports/sales-by-category
        [HttpGet("sales-by-category")]
        public IActionResult SalesByCategory() => RunReport(@"
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
            ORDER BY revenue DESC");

        // Report 3 - GET: api/reports/sales-by-month
        [HttpGet("sales-by-month")]
        public IActionResult SalesByMonth() => RunReport(@"
            SELECT DATE_FORMAT(o.orderDate, '%Y-%m')  AS salesMonth,
                   COUNT(DISTINCT o.orderId)          AS ordersCount,
                   SUM(oi.quantity)                   AS unitsSold,
                   SUM(oi.quantity * oi.unitPrice)    AS merchandiseSales,
                   ROUND(SUM(oi.quantity * oi.unitPrice) / COUNT(DISTINCT o.orderId), 2) AS avgOrderValue
            FROM CustomerOrder o
            JOIN OrderItem oi ON oi.orderId = o.orderId
            WHERE o.orderStatus <> 'Cancelled'
            GROUP BY salesMonth
            ORDER BY salesMonth");

        // Report 4 - GET: api/reports/customers
        [HttpGet("customers")]
        public IActionResult CustomerActivity() => RunReport(@"
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
            ORDER BY totalSpent DESC, customerName");

        // Report 5 - GET: api/reports/inventory
        [HttpGet("inventory")]
        public IActionResult InventoryByCategory() => RunReport(@"
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
            ORDER BY (lowStockProducts + outOfStockProducts) DESC, c.categoryName");

        // GET: api/reports/summary
        // The headline numbers on the admin dashboard, each from its own small subquery.
        [HttpGet("summary")]
        public IActionResult Summary() => RunReport($@"
            SELECT
              (SELECT COALESCE(SUM(totalAmount), 0) FROM CustomerOrder WHERE orderStatus <> 'Cancelled') AS totalRevenue,
              (SELECT COALESCE(SUM(totalAmount), 0) FROM CustomerOrder
                 WHERE orderStatus <> 'Cancelled' AND orderDate >= NOW() - INTERVAL 30 DAY)               AS revenueLast30Days,
              (SELECT COUNT(*) FROM CustomerOrder WHERE orderStatus <> 'Cancelled')                      AS ordersCount,
              (SELECT COUNT(*) FROM CustomerOrder WHERE orderStatus IN ('Placed', 'Ready for Pickup'))   AS openOrders,
              (SELECT COALESCE(ROUND(AVG(totalAmount), 2), 0) FROM CustomerOrder WHERE orderStatus <> 'Cancelled') AS avgOrderTotal,
              (SELECT COUNT(*) FROM User WHERE role = 'Customer')                                        AS customersCount,
              (SELECT COUNT(*) FROM Product WHERE isActive = TRUE)                                       AS activeProducts,
              (SELECT COUNT(*) FROM Product WHERE isActive = TRUE AND stockQuantity <= {LowStockThreshold}) AS lowStockCount");

        // GET: api/reports/low-stock
        // Active products that need restocking, emptiest first.
        [HttpGet("low-stock")]
        public IActionResult LowStock() => RunReport($@"
            SELECT p.productId, p.sku, p.productName, p.stockQuantity, p.price, p.imageUrl, c.categoryName
            FROM Product p
            JOIN Category c ON c.categoryId = p.categoryId
            WHERE p.isActive = TRUE AND p.stockQuantity <= {LowStockThreshold}
            ORDER BY p.stockQuantity, p.productName");

        private IActionResult RunReport(string sql)
        {
            try
            {
                return Ok(ReadRows(sql));
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }
    }
}
