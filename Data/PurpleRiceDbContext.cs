using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
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
        public DbSet<Company> Companies { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }
        public DbSet<RolesInterface> RolesInterfaces { get; set; }
        public DbSet<PurpleRice.Models.eFormDefinition> eFormDefinitions { get; set; }
        public DbSet<WhatsAppTemplate> WhatsAppTemplates { get; set; }
        public DbSet<WhatsAppTemplateUsage> WhatsAppTemplateUsage { get; set; }
        
        // 新增的 DbSet
        public DbSet<UserSession> UserSessions { get; set; }
        public DbSet<MessageValidation> MessageValidations { get; set; }
        public DbSet<EFormInstance> EFormInstances { get; set; }
        public DbSet<EFormApproval> EFormApprovals { get; set; }
        public DbSet<WhatsAppMonitorChatMsg> WhatsAppMonitorChatMsgs { get; set; }
        public DbSet<DataSet> DataSets { get; set; }
        public DbSet<DataSetColumn> DataSetColumns { get; set; }
        public DbSet<DataSetDataSource> DataSetDataSources { get; set; }
        public DbSet<DataSetRecord> DataSetRecords { get; set; }
        public DbSet<DataSetRecordValue> DataSetRecordValues { get; set; }
        
        // 流程變量相關 DbSet
        public DbSet<ProcessVariableDefinition> ProcessVariableDefinitions { get; set; }
        public DbSet<ProcessVariableValue> ProcessVariableValues { get; set; }
        
        // Contact List 相關 DbSet
        public DbSet<ContactList> ContactLists { get; set; }
        public DbSet<BroadcastGroup> BroadcastGroups { get; set; }
        public DbSet<ContactHashtag> ContactHashtags { get; set; }
        
        // Workflow Message Send 相關 DbSet
        public DbSet<WorkflowMessageSend> WorkflowMessageSends { get; set; }
        public DbSet<WorkflowMessageRecipient> WorkflowMessageRecipients { get; set; }
        
        // Workflow DataSet Query 相關 DbSet
        public DbSet<WorkflowDataSetQueryResult> WorkflowDataSetQueryResults { get; set; }
        public DbSet<WorkflowDataSetQueryRecord> WorkflowDataSetQueryRecords { get; set; }
        
        // Contact Import Schedule 相關 DbSet
        public DbSet<ContactImportSchedule> ContactImportSchedules { get; set; }
        public DbSet<ContactImportExecution> ContactImportExecutions { get; set; }
        public DbSet<SchedulerExecution> SchedulerExecutions { get; set; }
        
        // API Provider 設定
        public DbSet<ApiProviderDefinition> ApiProviderDefinitions { get; set; }
        public DbSet<CompanyApiProviderSetting> CompanyApiProviderSettings { get; set; }
        
        // Company Phone Verification 相關 DbSet
        public DbSet<CompanyPhoneVerification> CompanyPhoneVerifications { get; set; }


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
                entity.Property(e => e.Description).HasColumnName("description");
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
                entity.Property(e => e.TaskName).HasColumnName("TaskName").HasMaxLength(500);
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
                entity.Property(e => e.InputJson).HasColumnName("InputJson");
                entity.Property(e => e.OutputJson).HasColumnName("OutputJson");
                entity.Property(e => e.ReceivedPayloadJson).HasColumnName("ReceivedPayloadJson");
                entity.Property(e => e.AiResultJson).HasColumnName("AiResultJson");
                entity.Property(e => e.StartedAt).HasColumnName("StartedAt");
                entity.Property(e => e.EndedAt).HasColumnName("EndedAt");
                
                // 新增等待相關欄位
                entity.Property(e => e.IsWaiting).HasColumnName("IsWaiting");
                entity.Property(e => e.WaitingForUser).HasColumnName("WaitingForUser").HasMaxLength(50);
                entity.Property(e => e.ValidationConfig).HasColumnName("ValidationConfig");
            });
            modelBuilder.Entity<WhatsAppMessage>().ToTable("whatsapp_messages", schema: "dbo");
            
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
                entity.Property(e => e.TemplateSource).HasColumnName("TemplateSource").HasMaxLength(20);
                entity.Property(e => e.Content).HasColumnName("Content").IsRequired();
                entity.Property(e => e.Variables).HasColumnName("Variables");
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
                entity.Property(e => e.HeaderUrl).HasColumnName("HeaderUrl").HasMaxLength(1000);
                entity.Property(e => e.HeaderType).HasColumnName("HeaderType").HasMaxLength(50);
                entity.Property(e => e.HeaderFilename).HasColumnName("HeaderFilename").HasMaxLength(500);
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
                entity.Property(e => e.MessageType).HasColumnName("message_type").HasMaxLength(20);
                entity.Property(e => e.MediaId).HasColumnName("media_id").HasMaxLength(200);
                entity.Property(e => e.MediaUrl).HasColumnName("media_url").HasMaxLength(500);
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
            
            // eFormDefinition 配置
            modelBuilder.Entity<eFormDefinition>(entity =>
            {
                entity.ToTable("eFormDefinitions", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
                entity.Property(e => e.HtmlCode).HasColumnName("html_code").IsRequired();
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(10);
                entity.Property(e => e.RStatus).HasColumnName("rstatus").HasMaxLength(10);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedUserId).HasColumnName("created_user_id");
                entity.Property(e => e.UpdatedUserId).HasColumnName("updated_user_id");
                entity.Property(e => e.SourceFilePath).HasColumnName("source_file_path").HasMaxLength(500);
                entity.Property(e => e.FormType).HasColumnName("form_type").HasMaxLength(20).HasDefaultValue("HTML");
                entity.Property(e => e.MetaFlowId).HasColumnName("meta_flow_id").HasMaxLength(255);
                entity.Property(e => e.MetaFlowVersion).HasColumnName("meta_flow_version").HasMaxLength(50);
                entity.Property(e => e.MetaFlowStatus).HasColumnName("meta_flow_status").HasMaxLength(50);
                entity.Property(e => e.MetaFlowJson).HasColumnName("meta_flow_json");
                entity.Property(e => e.MetaFlowMetadata).HasColumnName("meta_flow_metadata");
            });

            modelBuilder.Entity<WhatsAppMonitorChatMsg>(entity =>
            {
                entity.ToTable("WhatsAppMonitorChatMsg", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.WaId).HasColumnName("WaId").HasMaxLength(50).IsRequired();
                entity.Property(e => e.WorkflowInstanceId).HasColumnName("WorkflowInstanceId");
                entity.Property(e => e.MessageId).HasColumnName("MessageId").HasMaxLength(100).IsRequired();
                entity.Property(e => e.SenderType).HasColumnName("SenderType").HasMaxLength(20).IsRequired();
                entity.Property(e => e.MessageText).HasColumnName("MessageText").IsRequired();
                entity.Property(e => e.MessageType).HasColumnName("MessageType").HasMaxLength(20);
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(20);
                entity.Property(e => e.Timestamp).HasColumnName("Timestamp").IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
                entity.Property(e => e.IsDeleted).HasColumnName("IsDeleted");
                entity.Property(e => e.Metadata).HasColumnName("Metadata");
                
                // 配置關係
                entity.HasOne(e => e.WorkflowExecution)
                      .WithMany()
                      .HasForeignKey(e => e.WorkflowInstanceId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            // DataSet 相關配置 - 簡化版本
            modelBuilder.Entity<DataSet>(entity =>
            {
                entity.ToTable("data_sets");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Name).HasColumnName("name");
                entity.Property(e => e.Description).HasColumnName("description");
                entity.Property(e => e.DataSourceType).HasColumnName("data_source_type");
                entity.Property(e => e.CompanyId).HasColumnName("company_id");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.IsScheduled).HasColumnName("is_scheduled");
                entity.Property(e => e.UpdateIntervalMinutes).HasColumnName("update_interval_minutes");
                entity.Property(e => e.SyncDirection).HasColumnName("sync_direction");
                entity.Property(e => e.LastUpdateTime).HasColumnName("last_update_time");
                entity.Property(e => e.NextUpdateTime).HasColumnName("next_update_time");
                entity.Property(e => e.TotalRecords).HasColumnName("total_records");
                entity.Property(e => e.LastDataSyncTime).HasColumnName("last_data_sync_time");
                
                // 同步狀態管理欄位映射
                entity.Property(e => e.SyncStatus).HasColumnName("sync_status");
                entity.Property(e => e.SyncStartedAt).HasColumnName("sync_started_at");
                entity.Property(e => e.SyncCompletedAt).HasColumnName("sync_completed_at");
                entity.Property(e => e.SyncErrorMessage).HasColumnName("sync_error_message");
                entity.Property(e => e.SyncStartedBy).HasColumnName("sync_started_by");
                
                // 進度追蹤欄位映射
                entity.Property(e => e.TotalRecordsToSync).HasColumnName("total_records_to_sync");
                entity.Property(e => e.RecordsProcessed).HasColumnName("records_processed");
                entity.Property(e => e.RecordsInserted).HasColumnName("records_inserted");
                entity.Property(e => e.RecordsUpdated).HasColumnName("records_updated");
                entity.Property(e => e.RecordsDeleted).HasColumnName("records_deleted");
                entity.Property(e => e.RecordsSkipped).HasColumnName("records_skipped");
                
                // 批次處理設定欄位映射
                entity.Property(e => e.BatchSize).HasColumnName("batch_size");
                entity.Property(e => e.MaxSyncDurationMinutes).HasColumnName("max_sync_duration_minutes");
                entity.Property(e => e.AllowOverlap).HasColumnName("allow_overlap");
                
                entity.Property(e => e.CreatedBy).HasColumnName("created_by");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => new { e.CompanyId, e.Name }).IsUnique();
                
                // 新增同步狀態相關索引
                entity.HasIndex(e => e.SyncStatus);
                entity.HasIndex(e => e.SyncStartedAt);
                entity.HasIndex(e => new { e.CompanyId, e.SyncStatus });
            });
            
            modelBuilder.Entity<DataSetColumn>(entity =>
            {
                entity.ToTable("data_set_columns");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.DataSetId).HasColumnName("data_set_id");
                entity.Property(e => e.ColumnName).HasColumnName("column_name");
                entity.Property(e => e.DisplayName).HasColumnName("display_name");
                entity.Property(e => e.DataType).HasColumnName("data_type");
                entity.Property(e => e.MaxLength).HasColumnName("max_length");
                entity.Property(e => e.IsRequired).HasColumnName("is_required");
                entity.Property(e => e.IsPrimaryKey).HasColumnName("is_primary_key");
                entity.Property(e => e.IsSearchable).HasColumnName("is_searchable");
                entity.Property(e => e.IsSortable).HasColumnName("is_sortable");
                entity.Property(e => e.IsIndexed).HasColumnName("is_indexed");
                entity.Property(e => e.DefaultValue).HasColumnName("default_value");
                entity.Property(e => e.SortOrder).HasColumnName("sort_order");
                
                entity.HasIndex(e => e.DataSetId);
                entity.HasIndex(e => new { e.DataSetId, e.ColumnName }).IsUnique();
                entity.HasIndex(e => new { e.DataSetId, e.SortOrder });
            });
            
            modelBuilder.Entity<DataSetDataSource>(entity =>
            {
                entity.ToTable("data_set_data_sources");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.DataSetId).HasColumnName("data_set_id");
                entity.Property(e => e.SourceType).HasColumnName("source_type");
                entity.Property(e => e.DatabaseConnection).HasColumnName("database_connection");
                entity.Property(e => e.SqlQuery).HasColumnName("sql_query");
                entity.Property(e => e.SqlParameters).HasColumnName("sql_parameters");
                entity.Property(e => e.ExcelFilePath).HasColumnName("excel_file_path");
                entity.Property(e => e.ExcelSheetName).HasColumnName("excel_sheet_name");
                entity.Property(e => e.GoogleDocsUrl).HasColumnName("google_docs_url");
                entity.Property(e => e.GoogleDocsSheetName).HasColumnName("google_docs_sheet_name");
                entity.Property(e => e.AuthenticationConfig).HasColumnName("authentication_config");
                entity.Property(e => e.LastUpdateTime).HasColumnName("last_update_time");
                
                entity.HasIndex(e => e.DataSetId);
            });
            
            modelBuilder.Entity<DataSetRecord>(entity =>
            {
                entity.ToTable("data_set_records");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.DataSetId).HasColumnName("data_set_id");
                entity.Property(e => e.PrimaryKeyValue).HasColumnName("primary_key_value");
                entity.Property(e => e.Status).HasColumnName("status");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                
                entity.HasIndex(e => e.DataSetId);
                entity.HasIndex(e => new { e.DataSetId, e.PrimaryKeyValue });
                entity.HasIndex(e => new { e.DataSetId, e.Status });
                entity.HasIndex(e => new { e.DataSetId, e.CreatedAt });
            });
            
            modelBuilder.Entity<DataSetRecordValue>(entity =>
            {
                entity.ToTable("data_set_record_values");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.RecordId).HasColumnName("record_id");
                entity.Property(e => e.ColumnName).HasColumnName("column_name");
                entity.Property(e => e.StringValue).HasColumnName("string_value");
                entity.Property(e => e.NumericValue).HasColumnName("numeric_value");
                entity.Property(e => e.DateValue).HasColumnName("date_value");
                entity.Property(e => e.BooleanValue).HasColumnName("boolean_value");
                entity.Property(e => e.TextValue).HasColumnName("text_value");
                
                entity.HasIndex(e => e.RecordId);
                entity.HasIndex(e => e.ColumnName);
                entity.HasIndex(e => new { e.ColumnName, e.StringValue });
                entity.HasIndex(e => new { e.ColumnName, e.NumericValue });
                entity.HasIndex(e => new { e.ColumnName, e.DateValue });
            });
            
            // 配置外鍵關係 - 簡化版本
            modelBuilder.Entity<DataSetColumn>(entity =>
            {
                entity.HasOne(c => c.DataSet)
                      .WithMany(d => d.Columns)
                      .HasForeignKey(c => c.DataSetId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            modelBuilder.Entity<DataSetDataSource>(entity =>
            {
                entity.HasOne(ds => ds.DataSet)
                      .WithMany(d => d.DataSources)
                      .HasForeignKey(ds => ds.DataSetId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            modelBuilder.Entity<DataSetRecord>(entity =>
            {
                entity.HasOne(r => r.DataSet)
                      .WithMany(d => d.Records)
                      .HasForeignKey(r => r.DataSetId)
                      .OnDelete(DeleteBehavior.Cascade);
                
                entity.HasMany(r => r.Values)
                      .WithOne(v => v.Record)
                      .HasForeignKey(v => v.RecordId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            modelBuilder.Entity<DataSetRecordValue>(entity =>
            {
                entity.HasOne(v => v.Record)
                      .WithMany(r => r.Values)
                      .HasForeignKey(v => v.RecordId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // 流程變量定義配置
            modelBuilder.Entity<ProcessVariableDefinition>(entity =>
            {
                entity.ToTable("process_variable_definitions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.WorkflowDefinitionId).HasColumnName("workflow_definition_id");
                entity.Property(e => e.VariableName).HasColumnName("variable_name").HasMaxLength(100).IsRequired();
                entity.Property(e => e.DisplayName).HasColumnName("display_name").HasMaxLength(200);
                entity.Property(e => e.DataType).HasColumnName("data_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
                entity.Property(e => e.IsRequired).HasColumnName("is_required");
                entity.Property(e => e.DefaultValue).HasColumnName("default_value").HasMaxLength(500);
                entity.Property(e => e.ValidationRules).HasColumnName("validation_rules").HasMaxLength(1000);
                entity.Property(e => e.JsonSchema).HasColumnName("json_schema");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(100).IsRequired();
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by").HasMaxLength(100);
                
                // 索引配置
                entity.HasIndex(e => e.WorkflowDefinitionId);
                entity.HasIndex(e => e.VariableName);
                entity.HasIndex(e => e.DataType);
                entity.HasIndex(e => new { e.WorkflowDefinitionId, e.VariableName }).IsUnique();
                
                // 外鍵關係
                entity.HasOne(e => e.WorkflowDefinition)
                      .WithMany()
                      .HasForeignKey(e => e.WorkflowDefinitionId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // 流程變量值配置
            modelBuilder.Entity<ProcessVariableValue>(entity =>
            {
                entity.ToTable("process_variable_values");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.WorkflowExecutionId).HasColumnName("workflow_execution_id");
                entity.Property(e => e.VariableName).HasColumnName("variable_name").HasMaxLength(100).IsRequired();
                entity.Property(e => e.DataType).HasColumnName("data_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.StringValue).HasColumnName("string_value").HasMaxLength(500);
                entity.Property(e => e.NumericValue).HasColumnName("numeric_value").HasColumnType("decimal(18,4)");
                entity.Property(e => e.DateValue).HasColumnName("date_value");
                entity.Property(e => e.BooleanValue).HasColumnName("boolean_value");
                entity.Property(e => e.TextValue).HasColumnName("text_value");
                entity.Property(e => e.JsonValue).HasColumnName("json_value");
                entity.Property(e => e.SetAt).HasColumnName("set_at");
                entity.Property(e => e.SetBy).HasColumnName("set_by").HasMaxLength(100);
                entity.Property(e => e.SourceType).HasColumnName("source_type").HasMaxLength(50);
                entity.Property(e => e.SourceReference).HasColumnName("source_reference").HasMaxLength(500);
                
                // 索引配置
                entity.HasIndex(e => e.WorkflowExecutionId);
                entity.HasIndex(e => e.VariableName);
                entity.HasIndex(e => e.SetAt);
                entity.HasIndex(e => e.SourceType);
                entity.HasIndex(e => new { e.WorkflowExecutionId, e.VariableName });
                
                // 外鍵關係
                entity.HasOne(e => e.WorkflowExecution)
                      .WithMany()
                      .HasForeignKey(e => e.WorkflowExecutionId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            // Contact List 相關配置
            modelBuilder.Entity<ContactList>(entity =>
            {
                entity.ToTable("contact_lists");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(100);
                entity.Property(e => e.Occupation).HasColumnName("occupation").HasMaxLength(100);
                entity.Property(e => e.WhatsAppNumber).HasColumnName("whatsapp_number").HasMaxLength(20);
                entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(255);
                entity.Property(e => e.CompanyName).HasColumnName("company").HasMaxLength(200);
                entity.Property(e => e.Department).HasColumnName("department").HasMaxLength(100);
                entity.Property(e => e.Position).HasColumnName("position").HasMaxLength(100);
                entity.Property(e => e.Hashtags).HasColumnName("hashtags").HasMaxLength(500);
                entity.Property(e => e.BroadcastGroupId).HasColumnName("broadcast_group_id");
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(100).IsRequired();
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by").HasMaxLength(100);
                
                // 索引配置
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.BroadcastGroupId);
                entity.HasIndex(e => e.WhatsAppNumber);
                entity.HasIndex(e => e.Email);
                entity.HasIndex(e => e.Hashtags);
                
                // 外鍵關係
                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.Cascade);
                      
                entity.HasOne(e => e.BroadcastGroup)
                      .WithMany(bg => bg.Contacts)
                      .HasForeignKey(e => e.BroadcastGroupId)
                      .OnDelete(DeleteBehavior.SetNull);
            });
            
            modelBuilder.Entity<BroadcastGroup>(entity =>
            {
                entity.ToTable("broadcast_groups");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
                entity.Property(e => e.Color).HasColumnName("color").HasMaxLength(7);
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(100).IsRequired();
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by").HasMaxLength(100);
                
                // 索引配置
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.Name);
                
                // 外鍵關係
                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            modelBuilder.Entity<ContactHashtag>(entity =>
            {
                entity.ToTable("contact_hashtags");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
                entity.Property(e => e.Color).HasColumnName("color").HasMaxLength(7);
                entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(300);
                entity.Property(e => e.IsActive).HasColumnName("is_active");
                entity.Property(e => e.CreatedAt).HasColumnName("created_at");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(100).IsRequired();
                
                // 索引配置
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.Name);
                
                // 外鍵關係
                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            // CompanyPhoneVerification 配置
            modelBuilder.Entity<CompanyPhoneVerification>(entity =>
            {
                entity.ToTable("CompanyPhoneVerification");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.CompanyId).HasColumnName("CompanyId").IsRequired();
                entity.Property(e => e.PhoneNumber).HasColumnName("PhoneNumber").HasMaxLength(20).IsRequired();
                entity.Property(e => e.Certificate).HasColumnName("Certificate").IsRequired();
                entity.Property(e => e.CertificateExpiry).HasColumnName("CertificateExpiry");
                entity.Property(e => e.Status).HasColumnName("Status").HasMaxLength(50).IsRequired().HasDefaultValue("Pending");
                entity.Property(e => e.VerificationCode).HasColumnName("VerificationCode").HasMaxLength(10);
                entity.Property(e => e.CodeExpiry).HasColumnName("CodeExpiry");
                entity.Property(e => e.CodeMethod).HasColumnName("CodeMethod").HasMaxLength(20);
                entity.Property(e => e.PhoneNumberId).HasColumnName("PhoneNumberId").HasMaxLength(200);
                entity.Property(e => e.RequestId).HasColumnName("RequestId").HasMaxLength(200);
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
                entity.Property(e => e.CreatedBy).HasColumnName("CreatedBy").HasMaxLength(100);
                entity.Property(e => e.ErrorMessage).HasColumnName("ErrorMessage");
                
                // 索引配置
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.Status);
                
                // 外鍵關係
                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
            
            // WorkflowMessageSend 配置
            modelBuilder.Entity<WorkflowMessageSend>(entity =>
            {
                entity.ToTable("workflow_message_sends");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.WorkflowExecutionId).HasColumnName("workflow_execution_id").IsRequired();
                entity.Property(e => e.WorkflowStepExecutionId).HasColumnName("workflow_step_execution_id");
                entity.Property(e => e.NodeId).HasColumnName("node_id").HasMaxLength(50).IsRequired();
                entity.Property(e => e.NodeType).HasColumnName("node_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.MessageType).HasColumnName("message_type").HasMaxLength(20).HasDefaultValue("text");
                entity.Property(e => e.TemplateId).HasColumnName("template_id").HasMaxLength(50);
                entity.Property(e => e.TemplateName).HasColumnName("template_name").HasMaxLength(100);
                entity.Property(e => e.MessageContent).HasColumnName("message_content");
                entity.Property(e => e.TotalRecipients).HasColumnName("total_recipients").HasDefaultValue(0);
                entity.Property(e => e.SuccessCount).HasColumnName("success_count").HasDefaultValue(0);
                entity.Property(e => e.FailedCount).HasColumnName("failed_count").HasDefaultValue(0);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("Pending");
                entity.Property(e => e.StartedAt).HasColumnName("started_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(50).IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                
                // 索引配置
                entity.HasIndex(e => e.WorkflowExecutionId);
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.StartedAt);
                entity.HasIndex(e => e.NodeType);
                
                // 外鍵關係
                entity.HasOne(e => e.WorkflowExecution)
                      .WithMany()
                      .HasForeignKey(e => e.WorkflowExecutionId)
                      .OnDelete(DeleteBehavior.Cascade);
                      
                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            // WorkflowMessageRecipient 配置
            modelBuilder.Entity<WorkflowMessageRecipient>(entity =>
            {
                entity.ToTable("workflow_message_recipients");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.MessageSendId).HasColumnName("message_send_id").IsRequired();
                entity.Property(e => e.RecipientType).HasColumnName("recipient_type").HasMaxLength(20).IsRequired();
                entity.Property(e => e.RecipientId).HasColumnName("recipient_id");
                entity.Property(e => e.RecipientName).HasColumnName("recipient_name").HasMaxLength(200);
                entity.Property(e => e.PhoneNumber).HasColumnName("phone_number").HasMaxLength(20).IsRequired();
                entity.Property(e => e.WhatsAppMessageId).HasColumnName("whatsapp_message_id").HasMaxLength(100);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("Pending");
                entity.Property(e => e.ErrorCode).HasColumnName("error_code").HasMaxLength(50);
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message").HasMaxLength(500);
                entity.Property(e => e.SentAt).HasColumnName("sent_at");
                entity.Property(e => e.DeliveredAt).HasColumnName("delivered_at");
                entity.Property(e => e.ReadAt).HasColumnName("read_at");
                entity.Property(e => e.FailedAt).HasColumnName("failed_at");
                entity.Property(e => e.RetryCount).HasColumnName("retry_count").HasDefaultValue(0);
                entity.Property(e => e.MaxRetries).HasColumnName("max_retries").HasDefaultValue(3);
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(50).IsRequired();
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                
                // 索引配置
                entity.HasIndex(e => e.MessageSendId);
                entity.HasIndex(e => e.PhoneNumber);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.WhatsAppMessageId);
                
                // 外鍵關係
                entity.HasOne(e => e.MessageSend)
                      .WithMany(ms => ms.Recipients)
                      .HasForeignKey(e => e.MessageSendId)
                      .OnDelete(DeleteBehavior.Cascade);
                      
                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.NoAction);
            });
            
            // Contact Import Schedule 相關配置
            modelBuilder.Entity<ContactImportSchedule>(entity =>
            {
                entity.ToTable("contact_import_schedules");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
                entity.Property(e => e.ImportType).HasColumnName("import_type").HasMaxLength(20).IsRequired();
                entity.Property(e => e.IsScheduled).HasColumnName("is_scheduled");
                entity.Property(e => e.ScheduleType).HasColumnName("schedule_type").HasMaxLength(20);
                entity.Property(e => e.IntervalMinutes).HasColumnName("interval_minutes");
                entity.Property(e => e.ScheduleCron).HasColumnName("schedule_cron").HasMaxLength(100);
                entity.Property(e => e.LastRunAt).HasColumnName("last_run_at");
                entity.Property(e => e.NextRunAt).HasColumnName("next_run_at");
                entity.Property(e => e.SourceConfig).HasColumnName("source_config").IsRequired();
                entity.Property(e => e.FieldMapping).HasColumnName("field_mapping").IsRequired();
                entity.Property(e => e.AllowUpdateDuplicates).HasColumnName("allow_update_duplicates");
                entity.Property(e => e.BroadcastGroupId).HasColumnName("broadcast_group_id");
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("Active");
                entity.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(100).IsRequired();
                entity.Property(e => e.UpdatedBy).HasColumnName("updated_by").HasMaxLength(100);
                
                // 索引配置
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.NextRunAt);
                entity.HasIndex(e => e.IsScheduled);
                entity.HasIndex(e => e.ImportType);
                
                // 外鍵關係
                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            modelBuilder.Entity<ContactImportExecution>(entity =>
            {
                entity.ToTable("contact_import_executions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ScheduleId).HasColumnName("schedule_id").IsRequired();
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
                entity.Property(e => e.TotalRecords).HasColumnName("total_records").HasDefaultValue(0);
                entity.Property(e => e.SuccessCount).HasColumnName("success_count").HasDefaultValue(0);
                entity.Property(e => e.FailedCount).HasColumnName("failed_count").HasDefaultValue(0);
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
                entity.Property(e => e.StartedAt).HasColumnName("started_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
                
                // 索引配置
                entity.HasIndex(e => e.ScheduleId);
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.StartedAt);
                entity.HasIndex(e => e.Status);
                
                // 外鍵關係
                entity.HasOne(e => e.Schedule)
                      .WithMany()
                      .HasForeignKey(e => e.ScheduleId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
            
            // SchedulerExecution 配置
            modelBuilder.Entity<SchedulerExecution>(entity =>
            {
                entity.ToTable("scheduler_executions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
                entity.Property(e => e.ScheduleType).HasColumnName("schedule_type").HasMaxLength(50).IsRequired();
                entity.Property(e => e.RelatedId).HasColumnName("related_id");
                entity.Property(e => e.RelatedName).HasColumnName("related_name").HasMaxLength(200);
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
                entity.Property(e => e.TotalItems).HasColumnName("total_items").HasDefaultValue(0);
                entity.Property(e => e.SuccessCount).HasColumnName("success_count").HasDefaultValue(0);
                entity.Property(e => e.FailedCount).HasColumnName("failed_count").HasDefaultValue(0);
                entity.Property(e => e.Message).HasColumnName("message").HasMaxLength(500);
                entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
                entity.Property(e => e.StartedAt).HasColumnName("started_at").HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
                entity.Property(e => e.ExecutionDurationMs).HasColumnName("execution_duration_ms");
                entity.Property(e => e.CreatedBy).HasColumnName("created_by").HasMaxLength(100).HasDefaultValue("system");
                
                entity.HasIndex(e => e.ScheduleType);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.StartedAt);
                entity.HasIndex(e => e.CompanyId);
                entity.HasIndex(e => e.RelatedId);
                
                if (modelBuilder.Entity<Company>() != null)
                {
                    entity.HasOne(e => e.Company)
                          .WithMany()
                          .HasForeignKey(e => e.CompanyId)
                          .OnDelete(DeleteBehavior.SetNull);
                }
            });
            
            modelBuilder.Entity<ApiProviderDefinition>(entity =>
            {
                entity.ToTable("ApiProviderDefinitions", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.ProviderKey).HasColumnName("ProviderKey").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Category).HasColumnName("Category").HasMaxLength(50).IsRequired();
                entity.Property(e => e.DisplayName).HasColumnName("DisplayName").HasMaxLength(100).IsRequired();
                entity.Property(e => e.IconName).HasColumnName("IconName").HasMaxLength(100);
                entity.Property(e => e.DefaultApiUrl).HasColumnName("DefaultApiUrl").HasMaxLength(500).IsRequired();
                entity.Property(e => e.DefaultModel).HasColumnName("DefaultModel").HasMaxLength(100);
                entity.Property(e => e.SupportedModels).HasColumnName("SupportedModels");
                entity.Property(e => e.AuthType).HasColumnName("AuthType").HasMaxLength(50);
                entity.Property(e => e.DefaultSettingsJson).HasColumnName("DefaultSettingsJson");
                entity.Property(e => e.EnableStreaming).HasColumnName("EnableStreaming");
                entity.Property(e => e.TemperatureMin).HasColumnName("TemperatureMin").HasColumnType("decimal(4,2)");
                entity.Property(e => e.TemperatureMax).HasColumnName("TemperatureMax").HasColumnType("decimal(4,2)");
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");

                entity.HasIndex(e => e.ProviderKey).IsUnique();
                entity.HasIndex(e => e.Category);
            });

            modelBuilder.Entity<CompanyApiProviderSetting>(entity =>
            {
                entity.ToTable("CompanyApiProviderSettings", schema: "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("Id");
                entity.Property(e => e.CompanyId).HasColumnName("CompanyId").IsRequired();
                entity.Property(e => e.ProviderKey).HasColumnName("ProviderKey").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Category).HasColumnName("Category").HasMaxLength(50);
                entity.Property(e => e.ApiUrlOverride).HasColumnName("ApiUrlOverride").HasMaxLength(500);
                entity.Property(e => e.ApiKeyEncrypted).HasColumnName("ApiKeyEncrypted");
                entity.Property(e => e.ModelOverride).HasColumnName("ModelOverride").HasMaxLength(100);
                entity.Property(e => e.Temperature).HasColumnName("Temperature").HasColumnType("decimal(4,2)");
                entity.Property(e => e.TopP).HasColumnName("TopP").HasColumnType("decimal(4,2)");
                entity.Property(e => e.EnableStreaming).HasColumnName("EnableStreaming");
                entity.Property(e => e.ExtraHeadersJson).HasColumnName("ExtraHeadersJson");
                entity.Property(e => e.AuthType).HasColumnName("AuthType").HasMaxLength(50);
                entity.Property(e => e.AuthConfigJson).HasColumnName("AuthConfigJson");
                entity.Property(e => e.SettingsJson).HasColumnName("SettingsJson");
                entity.Property(e => e.Active).HasColumnName("Active");
                entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
                entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");

                entity.HasIndex(e => new { e.CompanyId, e.ProviderKey }).IsUnique();
                entity.HasIndex(e => e.CompanyId);

                entity.HasOne(e => e.Company)
                      .WithMany()
                      .HasForeignKey(e => e.CompanyId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.ProviderDefinition)
                      .WithMany()
                      .HasForeignKey(e => e.ProviderKey)
                      .HasPrincipalKey(d => d.ProviderKey)
                      .OnDelete(DeleteBehavior.Cascade);
            });

        }
    }
} 