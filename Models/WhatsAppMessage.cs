using System;

namespace PurpleRice.Models
{
    public class WhatsAppMessage
    {
        public int Id { get; set; }
        public int? WorkflowExecutionId { get; set; }
        public WorkflowExecution WorkflowExecution { get; set; }
        public string WaId { get; set; }
        public string Message { get; set; }
        public string MessageType { get; set; }
        public string Direction { get; set; }
        public string Status { get; set; }
        public DateTime Timestamp { get; set; }
    }
} 