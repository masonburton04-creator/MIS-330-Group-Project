using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    // Every order endpoint requires a logged-in user.
    [Authorize]
    [Route("api/orders")]
    [ApiController]
    public class OrdersController : ApiControllerBase
    {
        // Sales tax rate. The front end shows the same rate as an estimate,
        // but the final total is always calculated here on the server.
        private const decimal TaxRate = 0.08m;

        private static readonly string[] OrderStatuses = { "Placed", "Ready for Pickup", "Completed", "Cancelled" };

        public OrdersController(IConfiguration configuration) : base(configuration) { }

        // POST: api/orders
        // Places an order for the logged-in user (checkout is simulated: no payment is taken).
        // Steps:
        //   1. Lock each product row, check it exists and has enough stock
        //   2. Save the order in CustomerOrder
        //   3. Save each purchased item in OrderItem
        //   4. Reduce each product's stockQuantity
        // All of this runs inside one transaction, so either every step
        // is saved or none of them are.
        [HttpPost]
        public ActionResult<OrderConfirmation> PlaceOrder(OrderRequest request)
        {
            // ----- Basic validation before touching the database -----
            if (request.Items.Count == 0)
            {
                return BadRequest("Your cart is empty.");
            }
            if (request.Items.Any(item => item.Quantity < 1 || item.Quantity > 99))
            {
                return BadRequest("Each quantity must be between 1 and 99.");
            }
            // OrderItem's primary key is (orderId, productId), so each product can only appear once
            if (request.Items.Select(i => i.ProductId).Distinct().Count() != request.Items.Count)
            {
                return BadRequest("Each product can only appear once in an order.");
            }

            // Always lock products in the same order (by id). If two checkouts lock rows
            // in opposite orders they can deadlock; a fixed order prevents that.
            var items = request.Items.OrderBy(i => i.ProductId).ToList();

            try
            {
                using var connection = OpenConnection();

                // If we return before transaction.Commit(), disposing the transaction
                // rolls it back, so nothing is half-saved.
                using var transaction = connection.BeginTransaction();

                // ----- Step 1: look up price and stock for each product -----
                // FOR UPDATE locks these product rows until we commit, so two customers
                // can't both buy the last item: the second checkout waits, then sees the new stock.
                var unitPrices = new Dictionary<int, decimal>();
                decimal subtotal = 0;

                foreach (var item in items)
                {
                    using var productCommand = new MySqlCommand(@"
                        SELECT productName, price, stockQuantity
                        FROM Product
                        WHERE productId = @productId AND isActive = TRUE
                        FOR UPDATE", connection, transaction);
                    productCommand.Parameters.AddWithValue("@productId", item.ProductId);

                    using var reader = productCommand.ExecuteReader();
                    if (!reader.Read())
                    {
                        return NotFound("A product in your cart is no longer available. Please remove it and try again.");
                    }

                    string productName = reader.GetString("productName");
                    decimal price = reader.GetDecimal("price");
                    int stock = reader.GetInt32("stockQuantity");

                    // Inventory can never go negative
                    if (item.Quantity > stock)
                    {
                        // 409 Conflict = the request is valid but the current stock can't fill it
                        return Conflict(stock == 0
                            ? $"\"{productName}\" just sold out. Please remove it from your cart."
                            : $"Only {stock} of \"{productName}\" left in stock. Please lower the quantity.");
                    }

                    // The price comes from the database, never from the browser
                    unitPrices[item.ProductId] = price;
                    subtotal += price * item.Quantity;
                }

                decimal tax = Math.Round(subtotal * TaxRate, 2);
                decimal total = subtotal + tax;

                // ----- Step 2: save the order -----
                int orderId;
                using (var orderCommand = new MySqlCommand(
                    "INSERT INTO CustomerOrder (userId, orderStatus, totalAmount) VALUES (@userId, 'Placed', @totalAmount)",
                    connection, transaction))
                {
                    orderCommand.Parameters.AddWithValue("@userId", CurrentUserId);
                    orderCommand.Parameters.AddWithValue("@totalAmount", total);
                    orderCommand.ExecuteNonQuery();
                    // The orderId MySQL just generated with AUTO_INCREMENT
                    orderId = (int)orderCommand.LastInsertedId;
                }

                foreach (var item in items)
                {
                    // ----- Step 3: save the purchased item -----
                    // unitPrice is stored so the order keeps its price even if the product price changes later
                    using (var itemCommand = new MySqlCommand(@"
                        INSERT INTO OrderItem (orderId, productId, quantity, unitPrice)
                        VALUES (@orderId, @productId, @quantity, @unitPrice)", connection, transaction))
                    {
                        itemCommand.Parameters.AddWithValue("@orderId", orderId);
                        itemCommand.Parameters.AddWithValue("@productId", item.ProductId);
                        itemCommand.Parameters.AddWithValue("@quantity", item.Quantity);
                        itemCommand.Parameters.AddWithValue("@unitPrice", unitPrices[item.ProductId]);
                        itemCommand.ExecuteNonQuery();
                    }

                    // ----- Step 4: reduce inventory -----
                    // "AND stockQuantity >= @quantity" is a second safety check on top of the lock.
                    using (var stockCommand = new MySqlCommand(@"
                        UPDATE Product
                        SET stockQuantity = stockQuantity - @quantity
                        WHERE productId = @productId AND stockQuantity >= @quantity", connection, transaction))
                    {
                        stockCommand.Parameters.AddWithValue("@quantity", item.Quantity);
                        stockCommand.Parameters.AddWithValue("@productId", item.ProductId);
                        if (stockCommand.ExecuteNonQuery() == 0)
                        {
                            return Conflict("Stock changed while placing your order. Please review your cart and try again.");
                        }
                    }
                }

                transaction.Commit();

                return Ok(new OrderConfirmation
                {
                    OrderId = orderId,
                    Subtotal = subtotal,
                    Tax = tax,
                    TotalAmount = total
                });
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // GET: api/orders/mine
        // The logged-in customer's order history, newest first, each with its items.
        [HttpGet("mine")]
        public ActionResult<List<OrderSummary>> GetMyOrders()
        {
            try
            {
                return Ok(ReadOrdersWithItems("o.userId = @value", CurrentUserId));
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // GET: api/orders/12
        // One order with its items (used by the confirmation page and order details).
        // Customers can only open their own orders; admins can open any order.
        [HttpGet("{id:int}")]
        public ActionResult<OrderSummary> GetOrder(int id)
        {
            try
            {
                var orders = ReadOrdersWithItems("o.orderId = @value", id);

                // 404 (not 403) for someone else's order, so customers can't discover which order numbers exist
                if (orders.Count == 0 || (orders[0].UserId != CurrentUserId && !IsAdmin))
                {
                    return NotFound("Order not found.");
                }
                return Ok(orders[0]);
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // GET: api/orders
        // Admin: every order with the customer's name and item counts, newest first.
        [Authorize(Roles = "Admin")]
        [HttpGet]
        public ActionResult<List<OrderSummary>> GetAllOrders()
        {
            var orders = new List<OrderSummary>();

            string sql = @"
                SELECT o.orderId, o.orderDate, o.orderStatus, o.totalAmount,
                       u.userId, CONCAT(u.firstName, ' ', u.lastName) AS customerName, u.email,
                       COUNT(oi.productId) AS lineCount,
                       SUM(oi.quantity)    AS unitCount
                FROM CustomerOrder o
                JOIN User u       ON u.userId = o.userId
                JOIN OrderItem oi ON oi.orderId = o.orderId
                GROUP BY o.orderId, o.orderDate, o.orderStatus, o.totalAmount, u.userId, u.firstName, u.lastName, u.email
                ORDER BY o.orderDate DESC, o.orderId DESC";

            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(sql, connection);
                using var reader = command.ExecuteReader();

                while (reader.Read())
                {
                    orders.Add(new OrderSummary
                    {
                        OrderId = reader.GetInt32("orderId"),
                        OrderDate = reader.GetDateTime("orderDate"),
                        OrderStatus = reader.GetString("orderStatus"),
                        TotalAmount = reader.GetDecimal("totalAmount"),
                        UserId = reader.GetInt32("userId"),
                        CustomerName = reader.GetString("customerName"),
                        CustomerEmail = reader.GetString("email"),
                        LineCount = Convert.ToInt32(reader["lineCount"]),
                        UnitCount = Convert.ToInt32(reader["unitCount"])
                    });
                }
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }

            return Ok(orders);
        }

        // PUT: api/orders/12/status   body: { "status": "Ready for Pickup" }
        // Admin: moves an order through Placed -> Ready for Pickup -> Completed.
        // Cancelling puts the items back into inventory, in one transaction.
        // A cancelled order is final (its stock has already been returned).
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/status")]
        public IActionResult UpdateStatus(int id, OrderStatusRequest request)
        {
            if (!OrderStatuses.Contains(request.Status))
            {
                return BadRequest("Unknown order status.");
            }

            try
            {
                using var connection = OpenConnection();
                using var transaction = connection.BeginTransaction();

                string currentStatus;
                using (var statusCommand = new MySqlCommand(
                    "SELECT orderStatus FROM CustomerOrder WHERE orderId = @orderId FOR UPDATE", connection, transaction))
                {
                    statusCommand.Parameters.AddWithValue("@orderId", id);
                    object? result = statusCommand.ExecuteScalar();
                    if (result == null)
                    {
                        return NotFound("Order not found.");
                    }
                    currentStatus = (string)result;
                }

                if (currentStatus == "Cancelled")
                {
                    return Conflict("This order was cancelled and its stock was returned, so it can't be changed.");
                }

                if (request.Status == "Cancelled")
                {
                    // Return every item's quantity to its product's stock
                    using var restockCommand = new MySqlCommand(@"
                        UPDATE Product p
                        JOIN OrderItem oi ON oi.productId = p.productId
                        SET p.stockQuantity = p.stockQuantity + oi.quantity
                        WHERE oi.orderId = @orderId", connection, transaction);
                    restockCommand.Parameters.AddWithValue("@orderId", id);
                    restockCommand.ExecuteNonQuery();
                }

                using (var updateCommand = new MySqlCommand(
                    "UPDATE CustomerOrder SET orderStatus = @status WHERE orderId = @orderId", connection, transaction))
                {
                    updateCommand.Parameters.AddWithValue("@status", request.Status);
                    updateCommand.Parameters.AddWithValue("@orderId", id);
                    updateCommand.ExecuteNonQuery();
                }

                transaction.Commit();
                return Ok();
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // Reads orders together with their items.
        // whereClause is one of the fixed strings used above, never text from the browser.
        // The query returns one row per order ITEM, so an order with 3 items comes back as
        // 3 rows; the loop groups those rows back into one OrderSummary per order.
        // Deactivated products keep their Product row, so old orders still show every item.
        private List<OrderSummary> ReadOrdersWithItems(string whereClause, int value)
        {
            var orders = new List<OrderSummary>();

            string sql = @"
                SELECT o.orderId, o.orderDate, o.orderStatus, o.totalAmount,
                       u.userId, CONCAT(u.firstName, ' ', u.lastName) AS customerName, u.email,
                       p.productId, p.sku, p.productName, p.imageUrl, oi.quantity, oi.unitPrice
                FROM CustomerOrder o
                JOIN User u       ON u.userId = o.userId
                JOIN OrderItem oi ON oi.orderId = o.orderId
                JOIN Product p    ON p.productId = oi.productId
                WHERE " + whereClause + @"
                ORDER BY o.orderDate DESC, o.orderId DESC, p.productName";

            using var connection = OpenConnection();
            using var command = new MySqlCommand(sql, connection);
            command.Parameters.AddWithValue("@value", value);
            using var reader = command.ExecuteReader();

            OrderSummary? currentOrder = null;
            while (reader.Read())
            {
                int orderId = reader.GetInt32("orderId");

                // Rows are sorted by order, so a new orderId means a new order has started
                if (currentOrder == null || currentOrder.OrderId != orderId)
                {
                    currentOrder = new OrderSummary
                    {
                        OrderId = orderId,
                        OrderDate = reader.GetDateTime("orderDate"),
                        OrderStatus = reader.GetString("orderStatus"),
                        TotalAmount = reader.GetDecimal("totalAmount"),
                        UserId = reader.GetInt32("userId"),
                        CustomerName = reader.GetString("customerName"),
                        CustomerEmail = reader.GetString("email")
                    };
                    orders.Add(currentOrder);
                }

                var line = new OrderLine
                {
                    ProductId = reader.GetInt32("productId"),
                    Sku = reader.GetString("sku"),
                    ProductName = reader.GetString("productName"),
                    ImageUrl = GetNullableString(reader, "imageUrl"),
                    Quantity = reader.GetInt32("quantity"),
                    UnitPrice = reader.GetDecimal("unitPrice")
                };
                currentOrder.Items.Add(line);
                currentOrder.LineCount++;
                currentOrder.UnitCount += line.Quantity;
                currentOrder.Subtotal += line.Quantity * line.UnitPrice;
            }

            // Tax is the part of the saved total that isn't merchandise
            foreach (var order in orders)
            {
                order.Tax = order.TotalAmount - order.Subtotal;
            }
            return orders;
        }
    }
}
