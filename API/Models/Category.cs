namespace API.Models
{
    // One row from the Category table, plus how many active products it has
    public class Category
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = "";
        public string? Description { get; set; }
        public int ProductCount { get; set; }
    }

    // The JSON the admin page sends when adding or renaming a category
    public class CategoryRequest
    {
        public string CategoryName { get; set; } = "";
        public string? Description { get; set; }
    }
}
