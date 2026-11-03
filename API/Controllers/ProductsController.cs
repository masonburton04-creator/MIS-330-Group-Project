using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    [Route("api/products")]
    [ApiController]
    public class ProductsController : ApiControllerBase
    {
        public ProductsController(IConfiguration configuration) : base(configuration) { }

        // Every product query starts with this SELECT. The LEFT JOIN adds how many
        // units of each product have sold (cancelled orders don't count). A product
        // that has never sold has no row in the subquery, so COALESCE turns NULL into 0.
        private const string ProductSelect = @"
            SELECT p.productId, p.sku, p.productName, p.description, p.price,
                   p.stockQuantity, p.imageUrl, p.isActive, p.createdAt, p.categoryId,
                   c.categoryName,
                   COALESCE(sales.unitsSold, 0) AS unitsSold
            FROM Product p
            JOIN Category c ON p.categoryId = c.categoryId
            LEFT JOIN (
                SELECT oi.productId, SUM(oi.quantity) AS unitsSold
                FROM OrderItem oi
                JOIN CustomerOrder o ON o.orderId = oi.orderId
                WHERE o.orderStatus <> 'Cancelled'
                GROUP BY oi.productId
            ) sales ON sales.productId = p.productId";

        // GET: api/products?search=pen&categoryId=1&minPrice=5&maxPrice=20&inStock=true&sort=price-asc&limit=8
        // The storefront catalog. Only active products are returned.
        // Every filter is optional; each one that is used adds a condition to the WHERE.
        [HttpGet]
        public ActionResult<List<Product>> GetProducts(
            string? search, int? categoryId, decimal? minPrice, decimal? maxPrice,
            bool inStock = false, string sort = "featured", int? limit = null)
        {
            string sql = ProductSelect + " WHERE p.isActive = TRUE";
            var parameters = new List<MySqlParameter>();

            if (!string.IsNullOrWhiteSpace(search))
            {
                // The search text is a parameter, so it is never pasted into the SQL itself.
                // Names, SKUs and categories match anywhere; descriptions only match at the start
                // of a word ("% pen%"), so searching "pen" doesn't find "opens".
                sql += @" AND (p.productName LIKE @search OR p.sku LIKE @search OR c.categoryName LIKE @search
                               OR p.description LIKE @searchWord OR p.description LIKE @searchStart)";
                parameters.Add(new MySqlParameter("@search", "%" + search.Trim() + "%"));
                parameters.Add(new MySqlParameter("@searchWord", "% " + search.Trim() + "%"));
                parameters.Add(new MySqlParameter("@searchStart", search.Trim() + "%"));
            }
            if (categoryId != null)
            {
                sql += " AND p.categoryId = @categoryId";
                parameters.Add(new MySqlParameter("@categoryId", categoryId));
            }
            if (minPrice != null)
            {
                sql += " AND p.price >= @minPrice";
                parameters.Add(new MySqlParameter("@minPrice", minPrice));
            }
            if (maxPrice != null)
            {
                sql += " AND p.price <= @maxPrice";
                parameters.Add(new MySqlParameter("@maxPrice", maxPrice));
            }
            if (inStock)
            {
                sql += " AND p.stockQuantity > 0";
            }

            // Column names can't be parameters, so the sort is picked from a fixed list.
            // Anything unexpected falls back to the default.
            sql += sort switch
            {
                "price-asc" => " ORDER BY p.price, p.productName",
                "price-desc" => " ORDER BY p.price DESC, p.productName",
                "name" => " ORDER BY p.productName",
                "newest" => " ORDER BY p.createdAt DESC, p.productId DESC",
                "popular" => " ORDER BY unitsSold DESC, p.productName",
                // featured: in-stock items first, then best sellers
                _ => " ORDER BY (p.stockQuantity = 0), unitsSold DESC, p.productName"
            };

            if (limit != null)
            {
                sql += " LIMIT @limit";
                parameters.Add(new MySqlParameter("@limit", Math.Clamp(limit.Value, 1, 100)));
            }

            try
            {
                return Ok(ReadProducts(sql, parameters));
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // GET: api/products/5
        // One product for the product detail page.
        // Admins can also open deactivated products; customers get 404 for them.
        [HttpGet("{id:int}")]
        public ActionResult<Product> GetProduct(int id)
        {
            try
            {
                var products = ReadProducts(ProductSelect + " WHERE p.productId = @productId",
                    new List<MySqlParameter> { new MySqlParameter("@productId", id) });

                if (products.Count == 0 || (!products[0].IsActive && !IsAdmin))
                {
                    return NotFound("That product isn't available.");
                }
                return Ok(products[0]);
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // GET: api/products/manage
        // Admin: every product, including deactivated ones, for the product manager.
        [Authorize(Roles = "Admin")]
        [HttpGet("manage")]
        public ActionResult<List<Product>> GetAllProductsForAdmin()
        {
            try
            {
                return Ok(ReadProducts(ProductSelect + " ORDER BY p.isActive DESC, c.categoryName, p.productName",
                    new List<MySqlParameter>()));
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // POST: api/products
        // Admin: adds a new product. Returns the new productId.
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public ActionResult<int> CreateProduct(ProductRequest request)
        {
            string? error = ValidateProduct(request);
            if (error != null)
            {
                return BadRequest(error);
            }

            string sql = @"
                INSERT INTO Product (sku, productName, description, price, stockQuantity, imageUrl, categoryId)
                VALUES (@sku, @productName, @description, @price, @stockQuantity, @imageUrl, @categoryId)";

            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(sql, connection);
                AddProductParameters(command, request);
                command.ExecuteNonQuery();
                return Ok((int)command.LastInsertedId);
            }
            catch (MySqlException ex)
            {
                return HandleProductDatabaseError(ex);
            }
        }

        // PUT: api/products/5
        // Admin: updates a product's details.
        // stockQuantity is deliberately NOT changed here. If a customer bought the item
        // while the admin had the edit form open, saving the form would undo that sale.
        // Stock changes go through PATCH api/products/5/stock instead, which adds or
        // subtracts from the current value.
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}")]
        public IActionResult UpdateProduct(int id, ProductRequest request)
        {
            string? error = ValidateProduct(request);
            if (error != null)
            {
                return BadRequest(error);
            }

            string sql = @"
                UPDATE Product
                SET sku = @sku, productName = @productName, description = @description,
                    price = @price, imageUrl = @imageUrl, categoryId = @categoryId
                WHERE productId = @productId";

            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(sql, connection);
                AddProductParameters(command, request);
                command.Parameters.AddWithValue("@productId", id);

                // ExecuteNonQuery returns how many rows matched the WHERE. 0 = no such product.
                if (command.ExecuteNonQuery() == 0)
                {
                    return NotFound("Product not found.");
                }
                return Ok();
            }
            catch (MySqlException ex)
            {
                return HandleProductDatabaseError(ex);
            }
        }

        // PATCH: api/products/5/stock   body: { "change": 25 }
        // Admin: restock (positive change) or write off (negative change) inventory.
        // Adding to the current value in SQL (stockQuantity + @change) avoids
        // overwriting a sale that happened while the admin had the page open.
        [Authorize(Roles = "Admin")]
        [HttpPatch("{id:int}/stock")]
        public ActionResult<int> AdjustStock(int id, StockRequest request)
        {
            if (request.Change == 0 || Math.Abs(request.Change) > 10000)
            {
                return BadRequest("Enter a stock change between -10,000 and 10,000 (not 0).");
            }

            try
            {
                using var connection = OpenConnection();
                using (var command = new MySqlCommand(@"
                    UPDATE Product
                    SET stockQuantity = stockQuantity + @change
                    WHERE productId = @productId AND stockQuantity + @change >= 0", connection))
                {
                    command.Parameters.AddWithValue("@change", request.Change);
                    command.Parameters.AddWithValue("@productId", id);

                    if (command.ExecuteNonQuery() == 0)
                    {
                        // Either the product doesn't exist, or the change would make stock negative
                        return Conflict("That change would make stock negative (or the product no longer exists).");
                    }
                }

                using var stockCommand = new MySqlCommand(
                    "SELECT stockQuantity FROM Product WHERE productId = @productId", connection);
                stockCommand.Parameters.AddWithValue("@productId", id);
                return Ok(Convert.ToInt32(stockCommand.ExecuteScalar()));
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // PATCH: api/products/5/active   body: { "isActive": false }
        // Admin: deactivate (hide from the store) or reactivate a product.
        // Deactivating keeps the row, so past orders that include it still work.
        [Authorize(Roles = "Admin")]
        [HttpPatch("{id:int}/active")]
        public IActionResult SetActive(int id, ActiveRequest request)
        {
            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(
                    "UPDATE Product SET isActive = @isActive WHERE productId = @productId", connection);
                command.Parameters.AddWithValue("@isActive", request.IsActive);
                command.Parameters.AddWithValue("@productId", id);

                if (command.ExecuteNonQuery() == 0)
                {
                    return NotFound("Product not found.");
                }
                return Ok();
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // DELETE: api/products/5
        // Admin: permanently deletes a product that has NEVER been ordered.
        // A product on a past order can only be deactivated, because deleting it
        // would break that order's history (the foreign key also prevents it).
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id:int}")]
        public IActionResult DeleteProduct(int id)
        {
            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand("DELETE FROM Product WHERE productId = @productId", connection);
                command.Parameters.AddWithValue("@productId", id);

                if (command.ExecuteNonQuery() == 0)
                {
                    return NotFound("Product not found.");
                }
                return Ok();
            }
            catch (MySqlException ex) when (ex.Number == ForeignKeyInUseError)
            {
                return Conflict("This product appears on past orders, so it can't be deleted. Deactivate it instead.");
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // Runs a product SELECT and copies each row into a Product object
        private List<Product> ReadProducts(string sql, List<MySqlParameter> parameters)
        {
            var products = new List<Product>();

            using var connection = OpenConnection();
            using var command = new MySqlCommand(sql, connection);
            command.Parameters.AddRange(parameters.ToArray());
            using var reader = command.ExecuteReader();

            while (reader.Read())
            {
                products.Add(new Product
                {
                    ProductId = reader.GetInt32("productId"),
                    Sku = reader.GetString("sku"),
                    ProductName = reader.GetString("productName"),
                    Description = GetNullableString(reader, "description"),
                    Price = reader.GetDecimal("price"),
                    StockQuantity = reader.GetInt32("stockQuantity"),
                    ImageUrl = GetNullableString(reader, "imageUrl"),
                    IsActive = reader.GetBoolean("isActive"),
                    CreatedAt = reader.GetDateTime("createdAt"),
                    CategoryId = reader.GetInt32("categoryId"),
                    CategoryName = reader.GetString("categoryName"),
                    UnitsSold = Convert.ToInt32(reader["unitsSold"])
                });
            }
            return products;
        }

        // Checks the admin's input. Returns an error message, or null if everything is OK.
        private static string? ValidateProduct(ProductRequest request)
        {
            if (request.Sku.Trim() == "" || request.ProductName.Trim() == "")
            {
                return "SKU and product name are required.";
            }
            if (request.Sku.Trim().Length > 30 || request.ProductName.Trim().Length > 100)
            {
                return "SKU must be 30 characters or fewer, and the name 100 or fewer.";
            }
            if (request.Price < 0 || request.Price > 100000)
            {
                return "Price must be between $0 and $100,000.";
            }
            if (decimal.Round(request.Price, 2) != request.Price)
            {
                return "Price can have at most two decimal places.";
            }
            if (request.StockQuantity < 0 || request.StockQuantity > 100000)
            {
                return "Stock must be between 0 and 100,000.";
            }
            if (request.CategoryId <= 0)
            {
                return "Please choose a category.";
            }
            if (request.ImageUrl != null && request.ImageUrl.Trim().Length > 255)
            {
                return "Image path must be 255 characters or fewer.";
            }
            return null;
        }

        // The INSERT and UPDATE use the same parameters, so they're added in one place.
        // Empty optional fields are saved as NULL.
        private static void AddProductParameters(MySqlCommand command, ProductRequest request)
        {
            command.Parameters.AddWithValue("@sku", request.Sku.Trim().ToUpper());
            command.Parameters.AddWithValue("@productName", request.ProductName.Trim());
            command.Parameters.AddWithValue("@description",
                string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim());
            command.Parameters.AddWithValue("@price", request.Price);
            command.Parameters.AddWithValue("@stockQuantity", request.StockQuantity);
            command.Parameters.AddWithValue("@imageUrl",
                string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim());
            command.Parameters.AddWithValue("@categoryId", request.CategoryId);
        }

        private ObjectResult HandleProductDatabaseError(MySqlException ex)
        {
            if (ex.Number == DuplicateEntryError)
            {
                return Conflict("Another product already uses that SKU.");
            }
            if (ex.Number == ForeignKeyMissingError)
            {
                return BadRequest("Please choose a valid category.");
            }
            return DatabaseError(ex);
        }
    }
}
