namespace API.Models
{
    // The JSON the browser sends when the customer clicks "Place order".
    // Only product IDs and quantities are sent. Prices are looked up in
    // MySQL so the browser can't change what an item costs, and the
    // customer comes from the login cookie, not from this request.
    public class OrderRequest
    {
        public List<OrderItemRequest> Items { get; set; } = new List<OrderItemRequest>();
    }

    // One line in the cart
    public class OrderItemRequest
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
    }

    // Admin order screen: the new status for an order
    public class OrderStatusRequest
    {
        public string Status { get; set; } = "";
    }
}
