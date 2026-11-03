namespace API.Models
{
    // Admin restock form: how many units to add (or remove, if negative)
    public class StockRequest
    {
        public int Change { get; set; }
    }

    // Admin activate/deactivate switch for a product
    public class ActiveRequest
    {
        public bool IsActive { get; set; }
    }
}
