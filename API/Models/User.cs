namespace API.Models
{
    // A user's account info that is safe to send to the browser.
    // The password hash is deliberately NOT included.
    public class User
    {
        public int UserId { get; set; }
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string Email { get; set; } = "";
        public string? Phone { get; set; }
        public string Role { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }
}
