namespace API.Models
{
    // The JSON the browser sends from the Profile form
    public class ProfileRequest
    {
        public string FirstName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string Email { get; set; } = "";
        public string? Phone { get; set; }
    }
}
