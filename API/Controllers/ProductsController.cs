using API.Models;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductsController : ControllerBase
    {
        private readonly string connectionString;

        // The connection string is read from configuration (user secrets),
        // so the database password never appears in the code or the browser.
        public ProductsController(IConfiguration configuration)
        {
            connectionString = configuration.GetConnectionString("CrimsonSupply")!;
        }

        // GET: api/products
        // Returns every active product along with its category name.
        [HttpGet]
        public ActionResult<List<Product>> GetProducts()
        {
            var products = new List<Product>();

            string sql = @"
                SELECT p.productId, p.sku, p.productName, p.description, p.price,
                       p.stockQuantity, p.isActive, p.createdAt, p.categoryId,
                       c.categoryName
                FROM Product p
                JOIN Category c ON p.categoryId = c.categoryId
                WHERE p.isActive = TRUE
                ORDER BY p.productName";

            try
            {
                using var connection = new MySqlConnection(connectionString);
                connection.Open();

                using var command = new MySqlCommand(sql, connection);
                using var reader = command.ExecuteReader();

                // Read one row at a time and copy it into a Product object
                while (reader.Read())
                {
                    products.Add(new Product
                    {
                        ProductId = reader.GetInt32("productId"),
                        Sku = reader.GetString("sku"),
                        ProductName = reader.GetString("productName"),
                        Description = reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString("description"),
                        Price = reader.GetDecimal("price"),
                        StockQuantity = reader.GetInt32("stockQuantity"),
                        IsActive = reader.GetBoolean("isActive"),
                        CreatedAt = reader.GetDateTime("createdAt"),
                        CategoryId = reader.GetInt32("categoryId"),
                        CategoryName = reader.GetString("categoryName")
                    });
                }
            }
            catch (MySqlException ex)
            {
                // 500 = server error. The front end shows a friendly message.
                return StatusCode(500, "Database error: " + ex.Message);
            }

            return Ok(products);
        }
    }
}
