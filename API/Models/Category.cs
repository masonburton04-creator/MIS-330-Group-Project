namespace API.Models
{
    // One row from the Category table
    public class Category
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = "";
        public string? Description { get; set; }
    }
}
