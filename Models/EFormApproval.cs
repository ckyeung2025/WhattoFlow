using System;

namespace PurpleRice.Models
{
    public class EFormApproval
    {
        public int Id { get; set; }
        public Guid EFormInstanceId { get; set; }
        public EFormInstance? EFormInstance { get; set; }
        public string Action { get; set; } = string.Empty; // Approve, Reject
        public string ApprovedBy { get; set; } = string.Empty;
        public string? ApprovalNote { get; set; }
        public DateTime ApprovedAt { get; set; }
    }
} 