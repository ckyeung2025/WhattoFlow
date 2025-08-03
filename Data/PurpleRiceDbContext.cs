using Microsoft.EntityFrameworkCore;
using PurpleRice.Models;

namespace PurpleRice.Data
{
    public class PurpleRiceDbContext : DbContext
    {
        public PurpleRiceDbContext(DbContextOptions<PurpleRiceDbContext> options) : base(options)
        {
        }

        public DbSet<WorkflowDefinition> WorkflowDefinitions { get; set; }
        public DbSet<WorkflowExecution> WorkflowExecutions { get; set; }
        public DbSet<WorkflowStepExecution> WorkflowStepExecutions { get; set; }
        public DbSet<WhatsAppMessage> WhatsAppMessages { get; set; }
        public DbSet<DeliveryReceipt> DeliveryReceipt { get; set; }
        public DbSet<Company> Companies { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<delivery_receipt> delivery_receipt { get; set; }
        public DbSet<PurpleRice.Models.eFormDefinition> eFormDefinitions { get; set; }
        public DbSet<WhatsAppTemplate> WhatsAppTemplates { get; set; }
        public DbSet<WhatsAppTemplateUsage> WhatsAppTemplateUsage { get; set; }
        
        // 新增的 DbSet
        public DbSet<UserSession> UserSessions { get; set; }
        public DbSet<MessageValidation> MessageValidations { get; set; }
        public DbSet<EFormInstance> EFormInstances { get; set; }
        public DbSet<EFormApproval> EFormApprovals { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("users");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id");
                entity.Property(e => e.Account).HasColumnName("account");
                entity.Property(e => e.Email).HasColumnName("email");
                entity.Property(e => e.GoogleId).HasColumnName("google_id");
                entity.Property(e => e.PasswordHash).HasColumnName("password_hash");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.IsOwner).HasColumnName("is_owner");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");
                entity.Property(e => e.Timezone).HasColumnName("timezone");
                entity.Property(e => e.Name).HasColumnName("name");
                entity.Property(e => e.Phone).HasColumnName("phone");
                entity.Property(e => e.Language).HasColumnName("language");
            });
            modelBuilder.Entity<Company>(entity =>
            {
                entity.ToTable("companies");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.MasterUserId).HasColumnName("master_user_id");
                entity.Property(e => e.Name).HasColumnName("name");
                entity.Property(e => e.Email).HasColumnName("email");
                entity.Property(e => e.Address).HasColumnName("address");
                entity.Property(e => e.Phone).HasColumnName("phone");
                entity.Property(e => e.Website).HasColumnName("website");
                entity.Property(e => e.WA_API_Key).HasColumnName("WA_API_Key");
                entity.Property(e => e.WA_PhoneNo_ID).HasColumnName("WA_PhoneNo_ID");
                entity.Property(e => e.WA_VerifyToken).HasColumnName("WA_VerifyToken");
                entity.Property(e => e.WA_WebhookToken).HasColumnName("WA_WebhookToken");
                entity.Property(e => e.LogoUrl).HasColumnName("logo_url");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            });
            // 設定資料表名稱
            modelBuilder.Entity<WorkflowDefinition>(entity =>
            {
                entity.ToTable("WorkflowDefinitions", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id");
                entity.Property(e => e.Name).HasColumnName("Name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Description).HasColumnName("Description").HasMaxLength(500);
                entity.Property(e => e.Json).HasColumnName("Json");
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
                entity.Property(e => e.CreatedBy).HasColumnName("CreatedBy").HasMaxLength(100);
                entity.Property(e => e.UpdatedBy).HasColumnName("UpdatedBy").HasMaxLength(100);
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
            });
            modelBuilder.Entity<WorkflowExecution>().ToTable("workflow_executions", schema: "dbo");
            modelBuilder.Entity<WorkflowStepExecution>().ToTable("workflow_step_executions", schema: "dbo");
            
            // 配置 WorkflowExecution 的欄位映射
            modelBuilder.Entity<WorkflowExecution>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.WorkflowDefinitionId).HasColumnName("WorkflowDefinitionId");
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
                entity.Property(e => e.CurrentStep).HasColumnName("CurrentStep");
                entity.Property(e => e.InputJson).HasColumnName("InputJson");
                entity.Property(e => e.OutputJson).HasColumnName("OutputJson");
                entity.Property(e => e.StartedAt).HasColumnName("StartedAt");
                entity.Property(e => e.EndedAt).HasColumnName("EndedAt");
                entity.Property(e => e.CreatedBy).HasColumnName("CreatedBy").HasMaxLength(100);
                entity.Property(e => e.ErrorMessage).HasColumnName("ErrorMessage").HasMaxLength(500);
                
                // 新增等待相關欄位
                entity.Property(e => e.IsWaiting).HasColumnName("IsWaiting");
                entity.Property(e => e.WaitingSince).HasColumnName("WaitingSince");
                entity.Property(e => e.LastUserActivity).HasColumnName("LastUserActivity");
                entity.Property(e => e.CurrentWaitingStep).HasColumnName("CurrentWaitingStep");
                entity.Property(e => e.WaitingForUser).HasColumnName("WaitingForUser").HasMaxLength(50);
            });
            
            // 配置 WorkflowStepExecution 的欄位映射
            modelBuilder.Entity<WorkflowStepExecution>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.WorkflowExecutionId).HasColumnName("WorkflowExecutionId");
                entity.Property(e => e.StepIndex).HasColumnName("StepIndex");
                entity.Property(e => e.StepType).HasColumnName("StepType").HasMaxLength(50);
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
                entity.Property(e => e.InputJson).HasColumnName("InputJson");
                entity.Property(e => e.OutputJson).HasColumnName("OutputJson");
                entity.Property(e => e.StartedAt).HasColumnName("StartedAt");
                entity.Property(e => e.EndedAt).HasColumnName("EndedAt");
                
                // 新增等待相關欄位
                entity.Property(e => e.IsWaiting).HasColumnName("IsWaiting");
                entity.Property(e => e.WaitingForUser).HasColumnName("WaitingForUser").HasMaxLength(50);
                entity.Property(e => e.ValidationConfig).HasColumnName("ValidationConfig");
            });
            modelBuilder.Entity<WhatsAppMessage>().ToTable("whatsapp_messages", schema: "dbo");
            modelBuilder.Entity<delivery_receipt>().ToTable("delivery_receipt", schema: "dbo");
            
            // WhatsApp 模板相關配置
            modelBuilder.Entity<WhatsAppTemplate>(entity =>
            {
                entity.ToTable("WhatsAppTemplates", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.Name).HasColumnName("Name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Description).HasColumnName("Description").HasMaxLength(500);
                entity.Property(e => e.Category).HasColumnName("Category").HasMaxLength(100);
                entity.Property(e => e.TemplateType).HasColumnName("TemplateType").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Content).HasColumnName("Content").IsRequired();
                entity.Property(e => e.Variables).HasColumnName("Variables");
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
                entity.Property(e => e.Language).HasColumnName("Language").HasMaxLength(10);
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
                entity.Property(e => e.CreatedBy).HasColumnName("CreatedBy").HasMaxLength(100);
                entity.Property(e => e.UpdatedBy).HasColumnName("UpdatedBy").HasMaxLength(100);
                entity.Property(e => e.CompanyId).HasColumnName("CompanyId");
                entity.Property(e => e.IsDeleted).HasColumnName("IsDeleted");
                entity.Property(e => e.Version).HasColumnName("Version");
            });
            
            modelBuilder.Entity<WhatsAppTemplateUsage>(entity =>
            {
                entity.ToTable("WhatsAppTemplateUsage", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.TemplateId).HasColumnName("TemplateId").IsRequired();
                entity.Property(e => e.WorkflowId).HasColumnName("WorkflowId");
                entity.Property(e => e.NodeId).HasColumnName("NodeId").HasMaxLength(100);
                entity.Property(e => e.UsedAt).HasColumnName("UsedAt");
                entity.Property(e => e.UsedBy).HasColumnName("UsedBy").HasMaxLength(100);
                entity.Property(e => e.Variables).HasColumnName("Variables");
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
                entity.Property(e => e.MessageId).HasColumnName("MessageId").HasMaxLength(200);
                
                // 外鍵關係
                entity.HasOne(e => e.Template)
                    .WithMany()
                    .HasForeignKey(e => e.TemplateId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            
            // 新增表的配置
            modelBuilder.Entity<UserSession>(entity =>
            {
                entity.ToTable("user_sessions", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserWaId).HasColumnName("user_wa_id").HasMaxLength(50).IsRequired();
                entity.Property(e => e.CurrentWorkflowExecutionId).HasColumnName("current_workflow_execution_id");
                entity.Property(e => e.SessionStartTime).HasColumnName("session_start_time");
                entity.Property(e => e.LastActivityTime).HasColumnName("last_activity_time");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                // 外鍵關係
                entity.HasOne(e => e.CurrentWorkflowExecution)
                    .WithMany()
                    .HasForeignKey(e => e.CurrentWorkflowExecutionId)
                    .OnDelete(DeleteBehavior.SetNull);
            });
            
            modelBuilder.Entity<MessageValidation>(entity =>
            {
                entity.ToTable("message_validations", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.WorkflowExecutionId).HasColumnName("workflow_execution_id").IsRequired();
                entity.Property(e => e.StepIndex).HasColumnName("step_index").IsRequired();
                entity.Property(e => e.UserWaId).HasColumnName("user_wa_id").HasMaxLength(50).IsRequired();
                entity.Property(e => e.UserMessage).HasColumnName("user_message").IsRequired();
                entity.Property(e => e.IsValid).HasColumnName("is_valid").IsRequired();
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message").HasMaxLength(500);
                entity.Property(e => e.ValidatorType).HasColumnName("validator_type").HasMaxLength(50);
                entity.Property(e => e.ProcessedData).HasColumnName("processed_data");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                
                // 外鍵關係
                entity.HasOne(e => e.WorkflowExecution)
                    .WithMany()
                    .HasForeignKey(e => e.WorkflowExecutionId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            
            // EFormInstance 配置
            modelBuilder.Entity<EFormInstance>(entity =>
            {
                entity.ToTable("eFormInstances", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.EFormDefinitionId).HasColumnName("EFormDefinitionId").IsRequired();
                entity.Property(e => e.WorkflowExecutionId).HasColumnName("WorkflowExecutionId").IsRequired();
                entity.Property(e => e.WorkflowStepExecutionId).HasColumnName("WorkflowStepExecutionId").IsRequired();
                entity.Property(e => e.CompanyId).HasColumnName("CompanyId").IsRequired();
                entity.Property(e => e.InstanceName).HasColumnName("InstanceName").HasMaxLength(255).IsRequired();
                entity.Property(e => e.OriginalHtmlCode).HasColumnName("OriginalHtmlCode").IsRequired();
                entity.Property(e => e.FilledHtmlCode).HasColumnName("FilledHtmlCode");
                entity.Property(e => e.UserMessage).HasColumnName("UserMessage");
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20).HasDefaultValue("Pending");
                entity.Property(e => e.ApprovalBy).HasColumnName("ApprovalBy").HasMaxLength(255);
                entity.Property(e => e.ApprovalAt).HasColumnName("ApprovalAt");
                entity.Property(e => e.ApprovalNote).HasColumnName("ApprovalNote").HasMaxLength(500);
                entity.Property(e => e.FormUrl).HasColumnName("FormUrl").HasMaxLength(500);
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt").HasDefaultValueSql("GETUTCDATE()");
                
                // 外鍵關係
                entity.HasOne(e => e.EFormDefinition)
                    .WithMany()
                    .HasForeignKey(e => e.EFormDefinitionId)
                    .OnDelete(DeleteBehavior.Restrict);
                    
                entity.HasOne(e => e.WorkflowExecution)
                    .WithMany()
                    .HasForeignKey(e => e.WorkflowExecutionId)
                    .OnDelete(DeleteBehavior.Restrict);
                    
                entity.HasOne(e => e.WorkflowStepExecution)
                    .WithMany()
                    .HasForeignKey(e => e.WorkflowStepExecutionId)
                    .OnDelete(DeleteBehavior.Restrict);
                    
                entity.HasOne(e => e.Company)
                    .WithMany()
                    .HasForeignKey(e => e.CompanyId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
            
            // EFormApproval 配置
            modelBuilder.Entity<EFormApproval>(entity =>
            {
                entity.ToTable("eFormApprovals", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.EFormInstanceId).HasColumnName("EFormInstanceId").IsRequired();
                entity.Property(e => e.Action).HasColumnName("Action").HasMaxLength(20).IsRequired();
                entity.Property(e => e.ApprovedBy).HasColumnName("ApprovedBy").HasMaxLength(255).IsRequired();
                entity.Property(e => e.ApprovalNote).HasColumnName("ApprovalNote").HasMaxLength(500);
                entity.Property(e => e.ApprovedAt).HasColumnName("ApprovedAt").HasDefaultValueSql("GETUTCDATE()");
                
                // 外鍵關係
                entity.HasOne(e => e.EFormInstance)
                    .WithMany()
                    .HasForeignKey(e => e.EFormInstanceId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
} 