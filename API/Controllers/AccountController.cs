using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using API.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MySql.Data.MySqlClient;

namespace API.Controllers
{
    // Registration, login/logout, and the logged-in user's own profile.
    // Every "me" endpoint uses the id from the login cookie, never an id sent
    // by the browser, so a user can only ever see or change their own account.
    [Route("api/account")]
    [ApiController]
    public class AccountController : ApiControllerBase
    {
        public AccountController(IConfiguration configuration) : base(configuration) { }

        // POST: api/account/register
        // Creates a new Customer account and logs the new user in.
        [HttpPost("register")]
        public async Task<ActionResult<User>> Register(RegisterRequest request)
        {
            string firstName = request.FirstName.Trim();
            string lastName = request.LastName.Trim();
            // Emails are stored in lowercase so "Bob@X.com" and "bob@x.com" are the same account
            string email = request.Email.Trim().ToLower();

            string? error = ValidateName(firstName, lastName) ?? ValidateEmail(email) ?? ValidatePassword(request.Password);
            if (error != null)
            {
                return BadRequest(error);
            }

            // New accounts are always Customers. The browser never gets to choose the role,
            // so nobody can sign themselves up as an Admin.
            string sql = @"
                INSERT INTO User (firstName, lastName, email, passwordHash, role)
                VALUES (@firstName, @lastName, @email, @passwordHash, 'Customer')";

            User user;
            try
            {
                using var connection = OpenConnection();
                using var command = new MySqlCommand(sql, connection);
                command.Parameters.AddWithValue("@firstName", firstName);
                command.Parameters.AddWithValue("@lastName", lastName);
                command.Parameters.AddWithValue("@email", email);
                command.Parameters.AddWithValue("@passwordHash", HashPassword(request.Password));
                command.ExecuteNonQuery();

                user = new User
                {
                    UserId = (int)command.LastInsertedId,
                    FirstName = firstName,
                    LastName = lastName,
                    Email = email,
                    Role = "Customer",
                    CreatedAt = DateTime.Now
                };
            }
            catch (MySqlException ex) when (ex.Number == DuplicateEntryError)
            {
                // The email column is UNIQUE, so MySQL rejects a second account with the same email
                return Conflict("An account with that email already exists. Try signing in instead.");
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }

            await SignInUser(user);
            return Ok(user);
        }

        // POST: api/account/login
        // Checks the email and password. If they match, sets the login cookie.
        [HttpPost("login")]
        public async Task<ActionResult<User>> Login(LoginRequest request)
        {
            string email = request.Email.Trim().ToLower();

            User? user;
            string? storedHash;
            try
            {
                (user, storedHash) = FindUser("email = @value", email);
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }

            // Same message whether the email or the password is wrong,
            // so nobody can use the login form to find out which emails have accounts.
            if (user == null || storedHash == null || !VerifyPassword(request.Password, storedHash))
            {
                return Unauthorized("Incorrect email or password.");
            }

            await SignInUser(user);
            return Ok(user);
        }

        // POST: api/account/logout
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok();
        }

        // GET: api/account/me
        // Returns the logged-in user. The front end calls this when the page loads
        // to find out whether someone is signed in. For a guest it returns
        // 204 No Content (nobody is signed in), which is a normal answer, not an error.
        [HttpGet("me")]
        public async Task<ActionResult<User?>> GetMe()
        {
            if (User.Identity?.IsAuthenticated != true)
            {
                return NoContent();
            }

            try
            {
                var (user, _) = FindUser("userId = @value", CurrentUserId);
                if (user == null)
                {
                    // The account was removed from the database: end the stale session
                    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                    return Unauthorized("Please sign in again.");
                }
                return Ok(user);
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // PUT: api/account/me
        // Updates the logged-in user's name, email and phone.
        // The role and password are not changed here.
        [Authorize]
        [HttpPut("me")]
        public ActionResult<User> UpdateProfile(ProfileRequest request)
        {
            string firstName = request.FirstName.Trim();
            string lastName = request.LastName.Trim();
            string email = request.Email.Trim().ToLower();
            // An empty phone box is saved as NULL, since phone is optional
            string? phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();

            string? error = ValidateName(firstName, lastName) ?? ValidateEmail(email);
            if (error == null && phone != null && phone.Length > 20)
            {
                error = "Phone number must be 20 characters or fewer.";
            }
            if (error != null)
            {
                return BadRequest(error);
            }

            string sql = @"
                UPDATE User
                SET firstName = @firstName, lastName = @lastName, email = @email, phone = @phone
                WHERE userId = @userId";

            try
            {
                using (var connection = OpenConnection())
                using (var command = new MySqlCommand(sql, connection))
                {
                    command.Parameters.AddWithValue("@firstName", firstName);
                    command.Parameters.AddWithValue("@lastName", lastName);
                    command.Parameters.AddWithValue("@email", email);
                    command.Parameters.AddWithValue("@phone", phone);
                    command.Parameters.AddWithValue("@userId", CurrentUserId);
                    command.ExecuteNonQuery();
                }

                // Read the account back so the browser gets the complete, current user
                var (user, _) = FindUser("userId = @value", CurrentUserId);
                return user == null ? NotFound("Account not found.") : Ok(user);
            }
            catch (MySqlException ex) when (ex.Number == DuplicateEntryError)
            {
                return Conflict("Another account already uses that email.");
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // PUT: api/account/password
        // Changes the logged-in user's password. The current password is required,
        // so someone who walks up to an unlocked computer can't change it.
        [Authorize]
        [HttpPut("password")]
        public IActionResult ChangePassword(PasswordRequest request)
        {
            string? error = ValidatePassword(request.NewPassword);
            if (error != null)
            {
                return BadRequest(error);
            }

            try
            {
                var (_, storedHash) = FindUser("userId = @value", CurrentUserId);
                if (storedHash == null || !VerifyPassword(request.CurrentPassword, storedHash))
                {
                    return BadRequest("Your current password is incorrect.");
                }

                using var connection = OpenConnection();
                using var command = new MySqlCommand(
                    "UPDATE User SET passwordHash = @passwordHash WHERE userId = @userId", connection);
                command.Parameters.AddWithValue("@passwordHash", HashPassword(request.NewPassword));
                command.Parameters.AddWithValue("@userId", CurrentUserId);
                command.ExecuteNonQuery();
                return Ok();
            }
            catch (MySqlException ex)
            {
                return DatabaseError(ex);
            }
        }

        // Looks up one user by a single column ("email = @value" or "userId = @value").
        // Returns the user (without the hash) and, separately, the stored password hash.
        // whereClause is always one of the fixed strings above, never text from the browser.
        private (User? user, string? passwordHash) FindUser(string whereClause, object value)
        {
            string sql = @"
                SELECT userId, firstName, lastName, email, phone, role, createdAt, passwordHash
                FROM User
                WHERE " + whereClause;

            using var connection = OpenConnection();
            using var command = new MySqlCommand(sql, connection);
            command.Parameters.AddWithValue("@value", value);
            using var reader = command.ExecuteReader();

            if (!reader.Read())
            {
                return (null, null);
            }

            var user = new User
            {
                UserId = reader.GetInt32("userId"),
                FirstName = reader.GetString("firstName"),
                LastName = reader.GetString("lastName"),
                Email = reader.GetString("email"),
                Phone = GetNullableString(reader, "phone"),
                Role = reader.GetString("role"),
                CreatedAt = reader.GetDateTime("createdAt")
            };
            return (user, reader.GetString("passwordHash"));
        }

        // Creates the login cookie. The claims inside it are signed by the server,
        // so the browser can't edit its own role or userId.
        private async Task SignInUser(User user)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Name, user.FirstName),
                new Claim(ClaimTypes.Role, user.Role)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = true });
        }

        // ===== Input checks (each returns an error message, or null if OK) =====

        private static string? ValidateName(string firstName, string lastName)
        {
            if (firstName == "" || lastName == "")
            {
                return "Please enter your first and last name.";
            }
            if (firstName.Length > 50 || lastName.Length > 50)
            {
                return "Names must be 50 characters or fewer.";
            }
            return null;
        }

        private static string? ValidateEmail(string email)
        {
            // MailAddress.TryCreate is .NET's built-in email format check
            if (email.Length > 100 || !MailAddress.TryCreate(email, out var parsed) || parsed.Address != email || !email.Contains('.'))
            {
                return "Please enter a valid email address.";
            }
            return null;
        }

        private static string? ValidatePassword(string password)
        {
            if (password.Length < 8 || password.Length > 100)
            {
                return "Password must be 8 to 100 characters long.";
            }
            if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
            {
                return "Password must include at least one letter and one number.";
            }
            return null;
        }

        // ===== Password hashing =====
        // Passwords are never stored as plain text. We store "salt:hash", where
        //   salt = 16 random bytes, different for every user
        //   hash = PBKDF2 (built into .NET) run on password + salt 100,000 times
        // Both are saved as Base64 text so they fit in the passwordHash VARCHAR column.
        // To check a login, we hash the typed password with the same salt and compare.

        private const int SaltSize = 16;
        private const int HashSize = 32;
        private const int Iterations = 100000;

        private static string HashPassword(string password)
        {
            byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
            return Convert.ToBase64String(salt) + ":" + Convert.ToBase64String(hash);
        }

        private static bool VerifyPassword(string password, string storedHash)
        {
            string[] parts = storedHash.Split(':');
            if (parts.Length != 2)
            {
                // Not a "salt:hash" value (e.g. the demo accounts' 'DEMO-NO-LOGIN'), so no password matches
                return false;
            }

            try
            {
                byte[] salt = Convert.FromBase64String(parts[0]);
                byte[] expectedHash = Convert.FromBase64String(parts[1]);
                byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);

                // FixedTimeEquals takes the same time whether the first byte or the last byte
                // differs, so an attacker can't guess the hash by timing the response.
                return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
