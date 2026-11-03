namespace API.Models
{
    // Sent back to the browser after an order is saved,
    // so the confirmation page can show the order number and total.
    public class OrderConfirmation
    {
        public int OrderId { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Tax { get; set; }
        public decimal TotalAmount { get; set; }
    }
}
