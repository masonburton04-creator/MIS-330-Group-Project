namespace API.Models
{
    // One row from the Product table, plus the category name from a JOIN.
    // ASP.NET Core turns this into JSON for the browser automatically.
    public class Product
    {
        public int ProductId { get; set; }
        public string Sku { get; set; } = "";
        public string ProductName { get; set; } = "";
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = "";
    }
}
