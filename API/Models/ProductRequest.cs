namespace API.Models
{
    // The JSON the admin page sends when adding or editing a product.
    // productId, isActive, and createdAt are left out because the
    // database sets those, not the admin.
    // StockQuantity is only used when ADDING a product (the starting stock);
    // after that, stock changes go through the restock endpoint.
    public class ProductRequest
    {
        public string Sku { get; set; } = "";
        public string ProductName { get; set; } = "";
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public int StockQuantity { get; set; }
        public string? ImageUrl { get; set; }
        public int CategoryId { get; set; }
    }
}
