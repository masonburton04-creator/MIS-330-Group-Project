namespace API.Models
{
    // One order, shown in order history, the confirmation page, and the admin order list
    public class OrderSummary
    {
        public int OrderId { get; set; }
        public DateTime OrderDate { get; set; }
        public string OrderStatus { get; set; } = "";
        public decimal TotalAmount { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Tax { get; set; }

        public int UserId { get; set; }
        public string CustomerName { get; set; } = "";
        public string CustomerEmail { get; set; } = "";

        public int LineCount { get; set; }     // number of different products
        public int UnitCount { get; set; }     // total number of units
        public List<OrderLine> Items { get; set; } = new List<OrderLine>();
    }

    // One product on an order (a row from OrderItem plus product details)
    public class OrderLine
    {
        public int ProductId { get; set; }
        public string Sku { get; set; } = "";
        public string ProductName { get; set; } = "";
        public string? ImageUrl { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }
}
