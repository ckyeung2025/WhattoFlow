using System;

namespace PurpleRice.Models
{
    public class UserSession
    {
        public int Id { get; set; }
        public string UserWaId { get; set; }
        public int? CurrentWorkflowExecutionId { get; set; }
        public WorkflowExecution? CurrentWorkflowExecution { get; set; }
        public DateTime SessionStartTime { get; set; }
        public DateTime LastActivityTime { get; set; }
        public string Status { get; set; } = "Active"; // Active/Inactive
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
} 