using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    // Shared code that every Crimson Supply controller inherits,
    // so each controller doesn't repeat the same few lines.
    [ApiController]
    public abstract class ApiControllerBase : ControllerBase
    {
        // MySQL error numbers we turn into friendly messages
        protected const int DuplicateEntryError = 1062;        // a UNIQUE column (email, sku, categoryName) already has this value
        protected const int ForeignKeyMissingError = 1452;     // the categoryId being saved doesn't exist
        protected const int ForeignKeyInUseError = 1451;       // the row is still referenced by another table

        private readonly string connectionString;

        // The connection string comes from configuration (user secrets in development),
        // so the database password never appears in the code or reaches the browser.
        protected ApiControllerBase(IConfiguration configuration)
        {
            connectionString = configuration.GetConnectionString("CrimsonSupply")
                ?? throw new InvalidOperationException("Connection string 'CrimsonSupply' is not configured.");
        }

        protected MySqlConnection OpenConnection()
        {
            var connection = new MySqlConnection(connectionString);
            connection.Open();
            return connection;
        }

        // The logged-in user's id, read from the login cookie (see AccountController.SignInUser)
        protected int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        protected bool IsAdmin => User.IsInRole("Admin");

        // Logs the real error for the developer, but only sends the browser a
        // general message so database details are never exposed to users.
        protected ObjectResult DatabaseError(MySqlException ex)
        {
            var logger = HttpContext.RequestServices.GetRequiredService<ILogger<ApiControllerBase>>();
            logger.LogError(ex, "MySQL error {Number}", ex.Number);
            return StatusCode(500, "Something went wrong talking to the database. Please try again.");
        }

        // Runs a SELECT and returns every row as "column name -> value".
        // The reports use this so each report is just its SQL query:
        // the JSON the browser receives uses the same names as the SQL column aliases.
        protected List<Dictionary<string, object?>> ReadRows(string sql)
        {
            var rows = new List<Dictionary<string, object?>>();

            using var connection = OpenConnection();
            using var command = new MySqlCommand(sql, connection);
            using var reader = command.ExecuteReader();

            while (reader.Read())
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                }
                rows.Add(row);
            }
            return rows;
        }

        // Small helper for optional text columns
        protected static string? GetNullableString(MySqlDataReader reader, string column)
        {
            int ordinal = reader.GetOrdinal(column);
            return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
        }
    }
}
