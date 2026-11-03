namespace API.Models
{
    // The JSON the browser sends from the "Log In" form
    public class LoginRequest
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
    }
}
