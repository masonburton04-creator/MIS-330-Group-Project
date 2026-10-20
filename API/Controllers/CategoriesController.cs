using API.Models;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController : ControllerBase
    {
        private readonly string connectionString;

        public CategoriesController(IConfiguration configuration)
        {
            connectionString = configuration.GetConnectionString("CrimsonSupply")!;
        }

        // GET: api/categories
        // Returns all categories, used to fill the category dropdowns.
        [HttpGet]
        public ActionResult<List<Category>> GetCategories()
        {
            var categories = new List<Category>();

            string sql = "SELECT categoryId, categoryName, description FROM Category ORDER BY categoryName";

            try
            {
                using var connection = new MySqlConnection(connectionString);
                connection.Open();

                using var command = new MySqlCommand(sql, connection);
                using var reader = command.ExecuteReader();

                while (reader.Read())
                {
                    categories.Add(new Category
                    {
                        CategoryId = reader.GetInt32("categoryId"),
                        CategoryName = reader.GetString("categoryName"),
                        Description = reader.IsDBNull(reader.GetOrdinal("description")) ? null : reader.GetString("description")
                    });
                }
            }
            catch (MySqlException ex)
            {
                return StatusCode(500, "Database error: " + ex.Message);
            }

            return Ok(categories);
        }
    }
}
