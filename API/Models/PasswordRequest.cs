namespace API.Models
{
    // The JSON the browser sends from the "Change password" form
    public class PasswordRequest
    {
        public string CurrentPassword { get; set; } = "";
        public string NewPassword { get; set; } = "";
    }
}
