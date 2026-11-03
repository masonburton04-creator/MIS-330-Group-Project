using API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    [Route("api/categories")]
    [ApiController]
    public class CategoriesController : ApiControllerBase
    {
        public CategoriesController(IConfiguration configuration) : base(configuration) { }

        // GET: api/categories
        // All categories with a count of their active products.
        // LEFT JOIN keeps categories that have no products yet (count = 0).
        [HttpGet]
        public ActionResult<List<Category>> GetCategories()
        {
            var categories = new List<Category>();

            string sql = @"
                SELECT c.categoryId, c.categoryName, c.description,
                       COUNT(p.productId) AS productCount
                FROM Category c
                LEFT JOIN Product p ON p.categoryId = c.categoryId AND p.isActive = TRUE
                GROUP BY c.categoryId, c.categoryName, c.description
                ORDER BY c.categoryId";

            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(sql, connection);
                using var reader = command.ExecuteReader();

                while (reader.Read())
                {
                    categories.Add(new Category
                    {
                        CategoryId = reader.GetInt32("categoryId"),
                        CategoryName = reader.GetString("categoryName"),
                        Description = GetNullableString(reader, "description"),
                        ProductCount = reader.GetInt32("productCount")
                    });
                }
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }

            return Ok(categories);
        }

        // POST: api/categories
        // Admin: adds a category. Returns the new categoryId.
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public ActionResult<int> CreateCategory(CategoryRequest request)
        {
            string? error = ValidateCategory(request);
            if (error != null)
            {
                return BadRequest(error);
            }

            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(
                    "INSERT INTO Category (categoryName, description) VALUES (@categoryName, @description)", connection);
                AddCategoryParameters(command, request);
                command.ExecuteNonQuery();
                return Ok((int)command.LastInsertedId);
            }
            catch (MySqlException ex) when (ex.Number == DuplicateEntryError)
            {
                return Conflict("A category with that name already exists.");
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // PUT: api/categories/3
        // Admin: renames a category or changes its description.
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}")]
        public IActionResult UpdateCategory(int id, CategoryRequest request)
        {
            string? error = ValidateCategory(request);
            if (error != null)
            {
                return BadRequest(error);
            }

            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(@"
                    UPDATE Category SET categoryName = @categoryName, description = @description
                    WHERE categoryId = @categoryId", connection);
                AddCategoryParameters(command, request);
                command.Parameters.AddWithValue("@categoryId", id);

                if (command.ExecuteNonQuery() == 0)
                {
                    return NotFound("Category not found.");
                }
                return Ok();
            }
            catch (MySqlException ex) when (ex.Number == DuplicateEntryError)
            {
                return Conflict("A category with that name already exists.");
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // DELETE: api/categories/3
        // Admin: deletes an EMPTY category. The Product foreign key makes MySQL refuse
        // to delete a category that still has products (active or not), and we
        // turn that refusal into a friendly message.
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id:int}")]
        public IActionResult DeleteCategory(int id)
        {
            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand("DELETE FROM Category WHERE categoryId = @categoryId", connection);
                command.Parameters.AddWithValue("@categoryId", id);

                if (command.ExecuteNonQuery() == 0)
                {
                    return NotFound("Category not found.");
                }
                return Ok();
            }
            catch (MySqlException ex) when (ex.Number == ForeignKeyInUseError)
            {
                return Conflict("This category still has products (including deactivated ones). Move or delete them first.");
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        private static string? ValidateCategory(CategoryRequest request)
        {
            if (request.CategoryName.Trim() == "")
            {
                return "Category name is required.";
            }
            if (request.CategoryName.Trim().Length > 50)
            {
                return "Category name must be 50 characters or fewer.";
            }
            if (request.Description != null && request.Description.Trim().Length > 255)
            {
                return "Description must be 255 characters or fewer.";
            }
            return null;
        }

        private static void AddCategoryParameters(MySqlCommand command, CategoryRequest request)
        {
            command.Parameters.AddWithValue("@categoryName", request.CategoryName.Trim());
            command.Parameters.AddWithValue("@description",
                string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim());
        }
    }
}
