using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Controllers;

namespace PurpleRice.Services
{
    /// <summary>
    /// 工作流程監控定時服務
    /// 負責檢查並處理 Time Validator 重試和 Overdue 逾期通知
    /// </summary>
    public class WorkflowMonitoringSchedulerService : BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly IConfiguration _configuration;
        private int _checkIntervalSeconds;
        private bool _enableRetryMonitoring;
        private bool _enableOverdueMonitoring;
        private bool _enableDataSetAutoSync;
        private bool _enableContactImportScheduling;

        public WorkflowMonitoringSchedulerService(
            IServiceScopeFactory serviceScopeFactory,
            IConfiguration configuration)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _configuration = configuration;

            // 從配置文件讀取設定
            _checkIntervalSeconds = _configuration.GetValue<int>("WorkflowMonitoring:CheckIntervalSeconds", 300);
            _enableRetryMonitoring = _configuration.GetValue<bool>("WorkflowMonitoring:EnableRetryMonitoring", true);
            _enableOverdueMonitoring = _configuration.GetValue<bool>("WorkflowMonitoring:EnableOverdueMonitoring", true);
            _enableDataSetAutoSync = _configuration.GetValue<bool>("WorkflowMonitoring:EnableDataSetAutoSync", true);
            _enableContactImportScheduling = _configuration.GetValue<bool>("WorkflowMonitoring:EnableContactImportScheduling", true);

            // 使用 Console.WriteLine 進行初始化日誌，因為此時還沒有 LoggingService
            Console.WriteLine("=== WorkflowMonitoringSchedulerService 初始化 ===");
            Console.WriteLine($"檢查間隔: {_checkIntervalSeconds} 秒");
            Console.WriteLine($"重試監控: {(_enableRetryMonitoring ? "啟用" : "停用")}");
            Console.WriteLine($"逾期監控: {(_enableOverdueMonitoring ? "啟用" : "停用")}");
            Console.WriteLine($"數據集自動同步: {(_enableDataSetAutoSync ? "啟用" : "停用")}");
            Console.WriteLine($"聯絡人定時匯入: {(_enableContactImportScheduling ? "啟用" : "停用")}");
        }

        /// <summary>
        /// 獲取 LoggingService 實例
        /// </summary>
        private LoggingService GetLoggingService()
        {
            using var scope = _serviceScopeFactory.CreateScope();
            return scope.ServiceProvider.GetRequiredService<Func<string, LoggingService>>()("WorkflowMonitoringSchedulerService");
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var loggingService = GetLoggingService();
            
            loggingService.LogInformation("WorkflowMonitoringSchedulerService 已啟動");

            // 首次執行延遲 30 秒（避免啟動時資源競爭）
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PerformMonitoringCheckAsync();
                }
                catch (Exception ex)
                {
                    loggingService.LogError($"監控檢查執行失敗: {ex.Message}");
                    loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                }

                // 等待下一次檢查
                await Task.Delay(TimeSpan.FromSeconds(_checkIntervalSeconds), stoppingToken);
            }

            loggingService.LogInformation("WorkflowMonitoringSchedulerService 已停止");
        }

        /// <summary>
        /// 執行監控檢查
        /// </summary>
        private async Task PerformMonitoringCheckAsync()
        {
            var checkTime = DateTime.UtcNow;
            var loggingService = GetLoggingService();
            loggingService.LogInformation($"=== 開始監控檢查 ({checkTime:yyyy-MM-dd HH:mm:ss}) ===");

            using (var scope = _serviceScopeFactory.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

                // 1. 檢查需要重試的等待步驟
                if (_enableRetryMonitoring)
                {
                    await CheckWaitingStepsForRetryAsync(db, scope.ServiceProvider);
                }

                // 2. 檢查逾期的流程
                if (_enableOverdueMonitoring)
                {
                    await CheckWorkflowsForOverdueAsync(db, scope.ServiceProvider);
                }

                // 3. 檢查需要自動同步的數據集
                if (_enableDataSetAutoSync)
                {
                    await CheckDataSetsForAutoSyncAsync(db, scope.ServiceProvider);
                }

                // 4. 檢查需要定時匯入的聯絡人匯入排程
                if (_enableContactImportScheduling)
                {
                    await CheckContactImportSchedulesAsync(db, scope.ServiceProvider);
                }
            }

            loggingService.LogInformation("=== 監控檢查完成 ===");
        }

        /// <summary>
        /// 記錄排程執行結果到統一表
        /// </summary>
        private async Task LogSchedulerExecutionAsync(
            PurpleRiceDbContext db,
            string scheduleType,
            Guid companyId,  // 改為非空
            Guid? relatedId,
            string relatedName,
            string status,
            int totalItems,
            int successCount,
            int failedCount,
            string message,
            string errorMessage,
            DateTime startedAt,
            DateTime? completedAt,
            int? durationMs)
        {
            try
            {
                var execution = new SchedulerExecution
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,  // 確保總是設置公司 ID
                    ScheduleType = scheduleType,
                    RelatedId = relatedId,
                    RelatedName = relatedName,
                    Status = status,
                    TotalItems = totalItems,
                    SuccessCount = successCount,
                    FailedCount = failedCount,
                    Message = message,
                    ErrorMessage = errorMessage,
                    StartedAt = startedAt,
                    CompletedAt = completedAt,
                    ExecutionDurationMs = durationMs,
                    CreatedBy = "system"
                };

                db.SchedulerExecutions.Add(execution);
            }
            catch (Exception ex)
            {
                var loggingService = GetLoggingService();
                loggingService.LogError($"記錄排程執行失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 檢查等待中的步驟是否需要重試
        /// </summary>
        private async Task CheckWaitingStepsForRetryAsync(PurpleRiceDbContext db, IServiceProvider serviceProvider)
        {
            var loggingService = GetLoggingService();
            try
            {
                loggingService.LogInformation("--- 開始檢查重試步驟 ---");

                // 查詢所有等待中的步驟（包含 ValidationConfig）
                var waitingSteps = await db.WorkflowStepExecutions
                    .Where(s => s.IsWaiting && 
                                s.Status == "Waiting" && 
                                s.ValidationConfig != null)
                    .Include(s => s.WorkflowExecution)
                        .ThenInclude(we => we.WorkflowDefinition)
                    .ToListAsync();

                loggingService.LogInformation($"找到 {waitingSteps.Count} 個等待中的步驟");

                var executionStart = DateTime.UtcNow;
                int retryCount = 0;
                int escalationCount = 0;
                
                // 收集所有涉及的公司 ID
                var companyIds = waitingSteps
                    .Where(s => s.WorkflowExecution?.WorkflowDefinition?.CompanyId != null)
                    .Select(s => s.WorkflowExecution.WorkflowDefinition.CompanyId)
                    .Distinct()
                    .ToList();

                foreach (var step in waitingSteps)
                {
                    try
                    {
                        // 解析 ValidationConfig
                        var validation = JsonSerializer.Deserialize<ValidationConfig>(step.ValidationConfig);
                        
                        if (validation?.ValidatorType != "time")
                        {
                            continue; // 不是 Time Validator，跳過
                        }

                        // 計算重試間隔（轉換為總分鐘數）
                        int retryIntervalMinutes = (validation.RetryIntervalDays ?? 0) * 24 * 60 +
                                                   (validation.RetryIntervalHours ?? 0) * 60 +
                                                   (validation.RetryIntervalMinutes ?? 0);

                        if (retryIntervalMinutes <= 0)
                        {
                            loggingService.LogWarning($"步驟 {step.Id} 的重試間隔設置無效: {retryIntervalMinutes} 分鐘，跳過");
                            continue;
                        }

                        // 計算距離上次活動的時間
                        var lastActivityTime = step.LastRetryAt ?? step.StartedAt ?? DateTime.UtcNow;
                        var minutesSinceLastActivity = (DateTime.UtcNow - lastActivityTime).TotalMinutes;

                        loggingService.LogDebug($"步驟 {step.Id} ({step.TaskName}): 距上次活動 {minutesSinceLastActivity:F1} 分鐘，重試間隔 {retryIntervalMinutes} 分鐘，已重試 {step.RetryCount} 次");

                        // 判斷是否需要重試
                        if (minutesSinceLastActivity >= retryIntervalMinutes)
                        {
                            if (step.RetryCount < (validation.RetryLimit ?? 3))
                            {
                                // 發送重試訊息
                                loggingService.LogInformation($"⏰ 發送重試訊息 - 步驟 {step.Id} ({step.TaskName})，第 {step.RetryCount + 1} 次重試");
                                await SendRetryMessageAsync(db, serviceProvider, step, validation.RetryMessageConfig);
                                
                                // 更新重試計數
                                step.RetryCount++;
                                step.LastRetryAt = DateTime.UtcNow;
                                retryCount++;
                            }
                            else if (!step.EscalationSent && validation.EscalationConfig != null)
                            {
                                // 達到重試上限，發送升級通知
                                loggingService.LogInformation($"📢 發送升級通知 - 步驟 {step.Id} ({step.TaskName})，已達重試上限 {validation.RetryLimit}");
                                await SendEscalationMessageAsync(db, serviceProvider, step, validation.EscalationConfig);
                                
                                // 標記已發送升級通知
                                step.EscalationSent = true;
                                step.EscalationSentAt = DateTime.UtcNow;
                                escalationCount++;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        loggingService.LogError($"處理步驟 {step.Id} 失敗: {ex.Message}");
                    }
                }

                // 保存所有變更（包括執行記錄）
                try
                {
                    await db.SaveChangesAsync();
                    if (retryCount > 0 || escalationCount > 0)
                    {
                        loggingService.LogInformation($"✅ 重試檢查完成 - 發送 {retryCount} 個重試訊息，{escalationCount} 個升級通知");
                    }
                    else
                    {
                        loggingService.LogInformation("✅ 重試檢查完成 - 無需處理的步驟");
                    }
                }
                catch (Exception saveEx)
                {
                    loggingService.LogError($"保存變更失敗: {saveEx.Message}");
                    loggingService.LogDebug($"保存錯誤堆疊追蹤: {saveEx.StackTrace}");
                    
                    // 嘗試獲取更詳細的錯誤信息
                    if (saveEx.InnerException != null)
                    {
                        loggingService.LogError($"內部錯誤: {saveEx.InnerException.Message}");
                    }
                }

                // 記錄執行結果到統一表
                var executionEnd = DateTime.UtcNow;
                var duration = (int)(executionEnd - executionStart).TotalMilliseconds;
                
                // 記錄多個公司的執行結果
                if (companyIds.Any())
                {
                    foreach (var companyId in companyIds)
                    {
                        await LogSchedulerExecutionAsync(
                            db, "retry_monitoring", companyId, null, null,
                            retryCount > 0 || escalationCount > 0 ? "Success" : "Skipped",
                            waitingSteps.Count, retryCount + escalationCount, 0,
                            $"處理 {retryCount} 個重試，{escalationCount} 個升級通知",
                            null, executionStart, executionEnd, duration);
                    }
                }
            }
            catch (Exception ex)
            {
                loggingService.LogError($"重試檢查失敗: {ex.Message}");
                loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                
                // 記錄失敗到統一表
                // 無法獲取公司 ID，使用 Guid.Empty 作為系統級記錄
                await LogSchedulerExecutionAsync(
                    db, "retry_monitoring", Guid.Empty, null, null,
                    "Failed", 0, 0, 1, null, ex.Message, DateTime.UtcNow, DateTime.UtcNow, null);
            }
        }

        /// <summary>
        /// 檢查運行中的流程是否逾期
        /// </summary>
        private async Task CheckWorkflowsForOverdueAsync(PurpleRiceDbContext db, IServiceProvider serviceProvider)
        {
            var loggingService = GetLoggingService();
            var executionStart = DateTime.UtcNow;
            
            try
            {
                loggingService.LogInformation("--- 開始檢查逾期流程 ---");

                // 查詢所有運行中且未發送逾期通知的流程
                var runningWorkflows = await db.WorkflowExecutions
                    .Where(w => w.Status == "Running" && !w.OverdueNotified)
                    .Include(w => w.WorkflowDefinition)
                    .ToListAsync();

                loggingService.LogInformation($"找到 {runningWorkflows.Count} 個運行中的流程");

                int overdueCount = 0;

                foreach (var workflow in runningWorkflows)
                {
                    try
                    {
                        // 從 WorkflowDefinition.Json 中提取 Start 節點的 overdueConfig
                        var overdueConfig = ExtractOverdueConfigFromDefinition(workflow.WorkflowDefinition);
                        
                        if (overdueConfig == null || !overdueConfig.Enabled)
                        {
                            continue; // 未啟用逾期監控，跳過
                        }

                        // 計算逾期閾值（轉換為總分鐘數）
                        int thresholdMinutes = (overdueConfig.Days ?? 0) * 24 * 60 +
                                              (overdueConfig.Hours ?? 0) * 60 +
                                              (overdueConfig.Minutes ?? 0);

                        if (thresholdMinutes <= 0)
                        {
                            loggingService.LogWarning($"流程 {workflow.Id} 的逾期時限設置無效: {thresholdMinutes} 分鐘，跳過");
                            continue;
                        }

                        // 計算距離啟動的時間
                        var minutesSinceStart = (DateTime.UtcNow - workflow.StartedAt).TotalMinutes;

                        loggingService.LogDebug($"流程 {workflow.Id} ({workflow.WorkflowDefinition?.Name}): 運行 {minutesSinceStart:F1} 分鐘，閾值 {thresholdMinutes} 分鐘");

                        // 判斷是否逾期
                        if (minutesSinceStart >= thresholdMinutes)
                        {
                            loggingService.LogInformation($"⏰ 發送逾期通知 - 流程 {workflow.Id} ({workflow.WorkflowDefinition?.Name})，已運行 {minutesSinceStart:F1} 分鐘");
                            await SendOverdueNotificationAsync(db, serviceProvider, workflow, overdueConfig.EscalationConfig);
                            
                            // 標記已發送逾期通知
                            workflow.OverdueNotified = true;
                            workflow.OverdueNotifiedAt = DateTime.UtcNow;
                            workflow.OverdueThresholdMinutes = thresholdMinutes;
                            overdueCount++;
                        }
                    }
                    catch (Exception ex)
                    {
                        loggingService.LogError($"處理流程 {workflow.Id} 失敗: {ex.Message}");
                    }
                }

                // 保存所有變更（包括執行記錄）
                await db.SaveChangesAsync();
                if (overdueCount > 0)
                {
                    loggingService.LogInformation($"✅ 逾期檢查完成 - 發送 {overdueCount} 個逾期通知");
                }
                else
                {
                    loggingService.LogInformation("✅ 逾期檢查完成 - 無逾期流程");
                }

                // 記錄執行結果
                var executionEnd = DateTime.UtcNow;
                var duration = (int)(executionEnd - executionStart).TotalMilliseconds;
                // 記錄多個公司的執行結果
                if (runningWorkflows.Any())
                {
                    var companies = runningWorkflows
                        .Where(w => w.WorkflowDefinition?.CompanyId != null)
                        .Select(w => w.WorkflowDefinition.CompanyId)
                        .Distinct()
                        .ToList();
                    
                    foreach (var companyId in companies)
                    {
                        await LogSchedulerExecutionAsync(
                            db, "overdue_monitoring", companyId, null, null,
                            overdueCount > 0 ? "Success" : "Skipped",
                            runningWorkflows.Count, overdueCount, 0,
                            $"處理 {overdueCount} 個逾期流程",
                            null, executionStart, executionEnd, duration);
                    }
                }
            }
            catch (Exception ex)
            {
                loggingService.LogError($"逾期檢查失敗: {ex.Message}");
                loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                
                await LogSchedulerExecutionAsync(
                    db, "overdue_monitoring", Guid.Empty, null, null,
                    "Failed", 0, 0, 1, null, ex.Message, DateTime.UtcNow, DateTime.UtcNow, null);
            }
        }

        /// <summary>
        /// 解析模板變量，將流程變量映射轉換為模板參數
        /// </summary>
        private async Task<Dictionary<string, string>> ResolveTemplateVariablesAsync(
            List<TemplateVariableMapping> templateVariables, 
            WorkflowExecution workflow,
            PurpleRiceDbContext db)
        {
            var loggingService = GetLoggingService();
            var templateParams = new Dictionary<string, string>();
            
            loggingService.LogDebug($"🔍 開始解析模板變量 - 工作流程 {workflow.Id}");
            loggingService.LogDebug($"🔍 模板變量配置數量: {templateVariables?.Count ?? 0}");
            
            if (templateVariables == null || templateVariables.Count == 0)
            {
                loggingService.LogWarning("⚠️ 沒有模板變量配置，返回空參數");
                return templateParams;
            }

            // 解析流程變量值
            var processVariableValues = new Dictionary<string, string>();
            
            // 從 WorkflowExecution.InputJson 中提取流程變量值
            if (!string.IsNullOrEmpty(workflow.InputJson))
            {
                try
                {
                    loggingService.LogDebug($"🔍 InputJson 內容: {workflow.InputJson}");
                    
                    var inputData = JsonSerializer.Deserialize<Dictionary<string, object>>(workflow.InputJson);
                    if (inputData != null)
                    {
                        foreach (var kvp in inputData)
                        {
                            processVariableValues[kvp.Key] = kvp.Value?.ToString() ?? "";
                            loggingService.LogDebug($"🔍 流程變量: {kvp.Key} = {kvp.Value}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    loggingService.LogWarning($"解析流程變量失敗: {ex.Message}");
                }
            }
            else
            {
                loggingService.LogWarning("⚠️ WorkflowExecution.InputJson 為空");
            }

            // 從 ProcessVariableValues 表中獲取流程變量值
            var processVariableDbValues = await db.ProcessVariableValues
                .Where(pv => pv.WorkflowExecutionId == workflow.Id)
                .ToListAsync();

            loggingService.LogDebug($"🔍 從數據庫獲取的流程變量數量: {processVariableDbValues.Count}");
            
            foreach (var pv in processVariableDbValues)
            {
                var value = pv.GetValue()?.ToString() ?? "";
                processVariableValues[pv.VariableName] = value;
                loggingService.LogDebug($"🔍 數據庫流程變量: {pv.VariableName} = {value}");
            }

            // 映射模板變量
            foreach (var mapping in templateVariables)
            {
                loggingService.LogDebug($"🔍 處理模板變量映射: ParameterName={mapping.ParameterName}, ProcessVariableId={mapping.ProcessVariableId}, ProcessVariableName={mapping.ProcessVariableName}");
                
                string variableValue = null;
                
                if (!string.IsNullOrEmpty(mapping.ProcessVariableName))
                {
                    // 優先通過 ProcessVariableName 查找（這是最可靠的方式）
                    if (processVariableValues.ContainsKey(mapping.ProcessVariableName))
                    {
                        variableValue = processVariableValues[mapping.ProcessVariableName];
                        loggingService.LogDebug($"🔍 通過 ProcessVariableName 找到值: {mapping.ProcessVariableName} = {variableValue}");
                    }
                    else
                    {
                        // 從 ProcessVariableValues 表中通過 variable_name 查找
                        var pvRecord = processVariableDbValues.FirstOrDefault(pv => pv.VariableName == mapping.ProcessVariableName);
                        if (pvRecord != null)
                        {
                            variableValue = pvRecord.GetValue()?.ToString();
                            loggingService.LogDebug($"🔍 通過數據庫 ProcessVariableName 找到值: {mapping.ProcessVariableName} = {variableValue}");
                        }
                    }
                }
                
                // 如果通過 ProcessVariableName 沒找到，嘗試通過 ProcessVariableId 查找
                if (string.IsNullOrEmpty(variableValue) && !string.IsNullOrEmpty(mapping.ProcessVariableId))
                {
                    // 先從 InputJson 中查找
                    if (processVariableValues.ContainsKey(mapping.ProcessVariableId))
                    {
                        variableValue = processVariableValues[mapping.ProcessVariableId];
                        loggingService.LogDebug($"🔍 通過 ProcessVariableId (InputJson) 找到值: {mapping.ProcessVariableId} = {variableValue}");
                    }
                    else
                    {
                        // 從 ProcessVariableValues 表中查找
                        var pvRecord = processVariableDbValues.FirstOrDefault(pv => pv.Id.ToString() == mapping.ProcessVariableId);
                        if (pvRecord != null)
                        {
                            variableValue = pvRecord.GetValue()?.ToString();
                            loggingService.LogDebug($"🔍 通過 ProcessVariableId (數據庫) 找到值: {mapping.ProcessVariableId} = {variableValue}");
                        }
                    }
                }

                if (!string.IsNullOrEmpty(variableValue))
                {
                    var paramName = !string.IsNullOrEmpty(mapping.ParameterName) 
                        ? mapping.ParameterName 
                        : mapping.ProcessVariableName ?? mapping.ProcessVariableId;
                    
                    templateParams[paramName] = variableValue;
                    loggingService.LogDebug($"🔍 映射成功: {paramName} = {variableValue}");
                }
                else
                {
                    loggingService.LogWarning($"⚠️ 無法映射模板變量: ProcessVariableId={mapping.ProcessVariableId}, ProcessVariableName={mapping.ProcessVariableName}");
                    loggingService.LogDebug($"🔍 可用的流程變量: {string.Join(", ", processVariableValues.Keys)}");
                }
            }

            loggingService.LogDebug($"🔍 最終模板參數: {JsonSerializer.Serialize(templateParams)}");
            return templateParams;
        }

        /// <summary>
        /// 發送重試訊息
        /// </summary>
        private async Task SendRetryMessageAsync(
            PurpleRiceDbContext db, 
            IServiceProvider serviceProvider,
            WorkflowStepExecution step, 
            RetryMessageConfig messageConfig)
        {
            var loggingService = GetLoggingService();
            try
            {
                var messageSendService = serviceProvider.GetRequiredService<WorkflowMessageSendService>();
                var recipientResolver = serviceProvider.GetRequiredService<RecipientResolverService>();
                var whatsAppService = serviceProvider.GetRequiredService<WhatsAppWorkflowService>();

                // 獲取收件人（從 step.WaitingForUser 或使用流程啟動人）
                var recipients = await ResolveRecipientsForStep(db, step);

                if (recipients == null || recipients.Count == 0)
                {
                    loggingService.LogWarning($"步驟 {step.Id} 無法解析收件人，跳過重試");
                    return;
                }

                // 創建訊息發送記錄
                var messageSendId = await messageSendService.CreateMessageSendAsync(
                    workflowExecutionId: step.WorkflowExecutionId,
                    workflowStepExecutionId: step.Id,
                    nodeId: $"step_{step.StepIndex}",
                    nodeType: step.StepType ?? "waitReply",
                    messageContent: messageConfig?.UseTemplate == false ? messageConfig.Message : null,
                    templateId: messageConfig?.UseTemplate == true ? messageConfig.TemplateId : null,
                    templateName: messageConfig?.UseTemplate == true ? messageConfig.TemplateName : null,
                    messageType: messageConfig?.UseTemplate == true ? "template" : "text",
                    companyId: step.WorkflowExecution.WorkflowDefinition.CompanyId,
                    createdBy: "system_retry"
                );

                // 更新發送原因
                var messageSend = await db.WorkflowMessageSends.FindAsync(messageSendId);
                if (messageSend != null)
                {
                    messageSend.SendReason = SendReason.Retry;
                    messageSend.RelatedStepExecutionId = step.Id;
                    db.WorkflowMessageSends.Update(messageSend); // 明確標記為更新
                    
                    // 先保存 WorkflowMessageSend 記錄
                    await db.SaveChangesAsync();
                    loggingService.LogDebug($"已保存重試訊息記錄: {messageSendId}");
                }

                // 添加收件人
                await messageSendService.AddRecipientsAsync(messageSendId, recipients, "system_retry");

                // 發送訊息並更新狀態
                if (messageConfig?.UseTemplate == true)
                {
                    // 解析模板變量
                    var templateParams = await ResolveTemplateVariablesAsync(
                        messageConfig.TemplateVariables, 
                        step.WorkflowExecution,
                        db);
                    
                    loggingService.LogInformation($"步驟 {step.Id} 重試訊息模板變量: {JsonSerializer.Serialize(templateParams)}");
                    
                    // 使用模板發送
                    foreach (var recipient in recipients)
                    {
                        try
                        {
                            // 獲取收件人記錄
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                // 發送消息並獲取 WhatsApp Message ID
                                var whatsappMessageId = await whatsAppService.SendWhatsAppTemplateMessageAsync(
                                    recipient.PhoneNumber,
                                    messageConfig.TemplateId,
                                    step.WorkflowExecution,
                                    db,
                                    templateParams,  // 使用解析的模板變量
                                    messageConfig.IsMetaTemplate,
                                    messageConfig.TemplateName,
                                    null
                                );
                                
                                // 更新收件人狀態為已發送
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Sent, 
                                    whatsappMessageId);
                                
                                loggingService.LogInformation($"✅ 重試訊息已發送到 {recipient.PhoneNumber}，WhatsApp Message ID: {whatsappMessageId}");
                            }
                        }
                        catch (Exception ex)
                        {
                            loggingService.LogError($"發送重試訊息到 {recipient.PhoneNumber} 失敗: {ex.Message}");
                            
                            // 更新收件人狀態為失敗
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Failed, 
                                    null, 
                                    ex.Message);
                            }
                        }
                    }
                }
                else
                {
                    // 使用直接訊息發送
                    foreach (var recipient in recipients)
                    {
                        try
                        {
                            // 獲取收件人記錄
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                // 發送消息
                                await whatsAppService.SendWhatsAppMessageAsync(
                                    recipient.PhoneNumber,
                                    messageConfig?.Message ?? "請儘快回覆",
                                    step.WorkflowExecution,
                                    db
                                );
                                
                                // 更新收件人狀態為已發送（SendWhatsAppMessageAsync 不返回 Message ID）
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Sent);
                                
                                loggingService.LogInformation($"✅ 重試訊息已發送到 {recipient.PhoneNumber}");
                            }
                        }
                        catch (Exception ex)
                        {
                            loggingService.LogError($"發送重試訊息到 {recipient.PhoneNumber} 失敗: {ex.Message}");
                            
                            // 更新收件人狀態為失敗
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Failed, 
                                    null, 
                                    ex.Message);
                            }
                        }
                    }
                }

                loggingService.LogInformation($"✅ 重試訊息已發送 - 步驟 {step.Id}，收件人 {recipients.Count} 位");
            }
            catch (Exception ex)
            {
                loggingService.LogError($"發送重試訊息失敗 - 步驟 {step.Id}: {ex.Message}");
            }
        }

        /// <summary>
        /// 發送升級通知
        /// </summary>
        private async Task SendEscalationMessageAsync(
            PurpleRiceDbContext db,
            IServiceProvider serviceProvider,
            WorkflowStepExecution step,
            EscalationConfig escalationConfig)
        {
            var loggingService = GetLoggingService();
            try
            {
                var messageSendService = serviceProvider.GetRequiredService<WorkflowMessageSendService>();
                var recipientResolver = serviceProvider.GetRequiredService<RecipientResolverService>();
                var whatsAppService = serviceProvider.GetRequiredService<WhatsAppWorkflowService>();

                // 解析升級通知的收件人
                var recipientDetailsJson = escalationConfig.RecipientDetails != null 
                    ? JsonSerializer.Serialize(escalationConfig.RecipientDetails) 
                    : null;
                    
                var recipients = await recipientResolver.ResolveRecipientsAsync(
                    escalationConfig.Recipients,
                    recipientDetailsJson,
                    step.WorkflowExecutionId,
                    step.WorkflowExecution.WorkflowDefinition.CompanyId
                );

                if (recipients == null || recipients.Count == 0)
                {
                    loggingService.LogWarning($"步驟 {step.Id} 無法解析升級通知收件人，跳過");
                    return;
                }

                // 創建訊息發送記錄
                var messageSendId = await messageSendService.CreateMessageSendAsync(
                    workflowExecutionId: step.WorkflowExecutionId,
                    workflowStepExecutionId: step.Id,
                    nodeId: $"step_{step.StepIndex}_escalation",
                    nodeType: step.StepType ?? "waitReply",
                    messageContent: escalationConfig?.UseTemplate == false ? escalationConfig.Message : null,
                    templateId: escalationConfig?.UseTemplate == true ? escalationConfig.TemplateId : null,
                    templateName: escalationConfig?.UseTemplate == true ? escalationConfig.TemplateName : null,
                    messageType: escalationConfig?.UseTemplate == true ? "template" : "text",
                    companyId: step.WorkflowExecution.WorkflowDefinition.CompanyId,
                    createdBy: "system_escalation"
                );

                // 更新發送原因
                var messageSend = await db.WorkflowMessageSends.FindAsync(messageSendId);
                if (messageSend != null)
                {
                    messageSend.SendReason = SendReason.Escalation;
                    messageSend.RelatedStepExecutionId = step.Id;
                    db.WorkflowMessageSends.Update(messageSend); // 明確標記為更新
                    
                    // 先保存 WorkflowMessageSend 記錄
                    await db.SaveChangesAsync();
                    loggingService.LogDebug($"已保存升級通知記錄: {messageSendId}");
                }

                // 添加收件人
                await messageSendService.AddRecipientsAsync(messageSendId, recipients, "system_escalation");

                // 發送訊息並更新狀態
                var company = await db.Companies.FindAsync(step.WorkflowExecution.WorkflowDefinition.CompanyId);
                if (company == null)
                {
                    loggingService.LogError($"找不到公司 ID: {step.WorkflowExecution.WorkflowDefinition.CompanyId}");
                    return;
                }
                
                if (escalationConfig?.UseTemplate == true)
                {
                    // 解析模板變量
                    var templateParams = await ResolveTemplateVariablesAsync(
                        escalationConfig.TemplateVariables, 
                        step.WorkflowExecution,
                        db);
                    
                    loggingService.LogInformation($"步驟 {step.Id} 升級通知模板變量: {JsonSerializer.Serialize(templateParams)}");
                    
                    foreach (var recipient in recipients)
                    {
                        try
                        {
                            // 獲取收件人記錄
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                // 發送消息並獲取 WhatsApp Message ID
                                var whatsappMessageId = await whatsAppService.SendWhatsAppTemplateMessageAsync(
                                    recipient.PhoneNumber,
                                    escalationConfig.TemplateId,
                                    step.WorkflowExecution,
                                    db,
                                    templateParams,  // 使用解析的模板變量
                                    escalationConfig.IsMetaTemplate,
                                    escalationConfig.TemplateName,
                                    null
                                );
                                
                                // 更新收件人狀態為已發送
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Sent, 
                                    whatsappMessageId);
                                
                                loggingService.LogInformation($"✅ 升級通知已發送到 {recipient.PhoneNumber}，WhatsApp Message ID: {whatsappMessageId}");
                            }
                        }
                        catch (Exception ex)
                        {
                            loggingService.LogError($"發送升級通知到 {recipient.PhoneNumber} 失敗: {ex.Message}");
                            
                            // 更新收件人狀態為失敗
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Failed, 
                                    null, 
                                    ex.Message);
                            }
                        }
                    }
                }
                else
                {
                    var message = escalationConfig?.Message ?? $"步驟 {step.TaskName} 已達重試上限，請協助處理";
                    foreach (var recipient in recipients)
                    {
                        try
                        {
                            // 獲取收件人記錄
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                // 發送消息
                                await whatsAppService.SendWhatsAppMessageAsync(
                                    recipient.PhoneNumber,
                                    message,
                                    step.WorkflowExecution,
                                    db
                                );
                                
                                // 更新收件人狀態為已發送（SendWhatsAppMessageAsync 不返回 Message ID）
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Sent);
                                
                                loggingService.LogInformation($"✅ 升級通知已發送到 {recipient.PhoneNumber}");
                            }
                        }
                        catch (Exception ex)
                        {
                            loggingService.LogError($"發送升級通知到 {recipient.PhoneNumber} 失敗: {ex.Message}");
                            
                            // 更新收件人狀態為失敗
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Failed, 
                                    null, 
                                    ex.Message);
                            }
                        }
                    }
                }

                loggingService.LogInformation($"✅ 升級通知已發送 - 步驟 {step.Id}，收件人 {recipients.Count} 位");
            }
            catch (Exception ex)
            {
                loggingService.LogError($"發送升級通知失敗 - 步驟 {step.Id}: {ex.Message}");
            }
        }

        /// <summary>
        /// 發送逾期通知
        /// </summary>
        private async Task SendOverdueNotificationAsync(
            PurpleRiceDbContext db,
            IServiceProvider serviceProvider,
            WorkflowExecution workflow,
            EscalationConfig escalationConfig)
        {
            var loggingService = GetLoggingService();
            try
            {
                var messageSendService = serviceProvider.GetRequiredService<WorkflowMessageSendService>();
                var recipientResolver = serviceProvider.GetRequiredService<RecipientResolverService>();
                var whatsAppService = serviceProvider.GetRequiredService<WhatsAppWorkflowService>();

                // 解析逾期通知的收件人
                var recipientDetailsJson = escalationConfig.RecipientDetails != null 
                    ? JsonSerializer.Serialize(escalationConfig.RecipientDetails) 
                    : null;
                    
                var recipients = await recipientResolver.ResolveRecipientsAsync(
                    escalationConfig.Recipients,
                    recipientDetailsJson,
                    workflow.Id,
                    workflow.WorkflowDefinition.CompanyId
                );

                if (recipients == null || recipients.Count == 0)
                {
                    loggingService.LogWarning($"流程 {workflow.Id} 無法解析逾期通知收件人，跳過");
                    return;
                }

                // 創建訊息發送記錄
                var messageSendId = await messageSendService.CreateMessageSendAsync(
                    workflowExecutionId: workflow.Id,
                    workflowStepExecutionId: null,
                    nodeId: "start_overdue",
                    nodeType: "start",
                    messageContent: escalationConfig?.UseTemplate == false ? escalationConfig.Message : null,
                    templateId: escalationConfig?.UseTemplate == true ? escalationConfig.TemplateId : null,
                    templateName: escalationConfig?.UseTemplate == true ? escalationConfig.TemplateName : null,
                    messageType: escalationConfig?.UseTemplate == true ? "template" : "text",
                    companyId: workflow.WorkflowDefinition.CompanyId,
                    createdBy: "system_overdue"
                );

                // 更新發送原因
                var messageSend = await db.WorkflowMessageSends.FindAsync(messageSendId);
                if (messageSend != null)
                {
                    messageSend.SendReason = SendReason.Overdue;
                    db.WorkflowMessageSends.Update(messageSend); // 明確標記為更新
                    
                    // 先保存 WorkflowMessageSend 記錄
                    await db.SaveChangesAsync();
                    loggingService.LogDebug($"已保存逾期通知記錄: {messageSendId}");
                }

                // 添加收件人
                await messageSendService.AddRecipientsAsync(messageSendId, recipients, "system_overdue");

                // 發送訊息並更新狀態
                var company = await db.Companies.FindAsync(workflow.WorkflowDefinition.CompanyId);
                if (company == null)
                {
                    loggingService.LogError($"找不到公司 ID: {workflow.WorkflowDefinition.CompanyId}");
                    return;
                }
                
                if (escalationConfig?.UseTemplate == true)
                {
                    // 解析模板變量
                    var templateParams = await ResolveTemplateVariablesAsync(
                        escalationConfig.TemplateVariables, 
                        workflow,
                        db);
                    
                    loggingService.LogInformation($"流程 {workflow.Id} 逾期通知模板變量: {JsonSerializer.Serialize(templateParams)}");
                    
                    foreach (var recipient in recipients)
                    {
                        try
                        {
                            // 獲取收件人記錄
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                // 發送消息並獲取 WhatsApp Message ID
                                var whatsappMessageId = await whatsAppService.SendWhatsAppTemplateMessageAsync(
                                    recipient.PhoneNumber,
                                    escalationConfig.TemplateId,
                                    workflow,
                                    db,
                                    templateParams,  // 使用解析的模板變量
                                    escalationConfig.IsMetaTemplate,
                                    escalationConfig.TemplateName,
                                    null
                                );
                                
                                // 更新收件人狀態為已發送
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Sent, 
                                    whatsappMessageId);
                                
                                loggingService.LogInformation($"✅ 逾期通知已發送到 {recipient.PhoneNumber}，WhatsApp Message ID: {whatsappMessageId}");
                            }
                        }
                        catch (Exception ex)
                        {
                            loggingService.LogError($"發送逾期通知到 {recipient.PhoneNumber} 失敗: {ex.Message}");
                            
                            // 更新收件人狀態為失敗
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Failed, 
                                    null, 
                                    ex.Message);
                            }
                        }
                    }
                }
                else
                {
                    var message = escalationConfig?.Message ?? $"流程 {workflow.WorkflowDefinition?.Name} 已逾期，請盡快處理";
                    foreach (var recipient in recipients)
                    {
                        try
                        {
                            // 獲取收件人記錄
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                // 發送消息
                                await whatsAppService.SendWhatsAppMessageAsync(
                                    recipient.PhoneNumber,
                                    message,
                                    workflow,
                                    db
                                );
                                
                                // 更新收件人狀態為已發送（SendWhatsAppMessageAsync 不返回 Message ID）
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Sent);
                                
                                loggingService.LogInformation($"✅ 逾期通知已發送到 {recipient.PhoneNumber}");
                            }
                        }
                        catch (Exception ex)
                        {
                            loggingService.LogError($"發送逾期通知到 {recipient.PhoneNumber} 失敗: {ex.Message}");
                            
                            // 更新收件人狀態為失敗
                            var recipientRecord = await db.WorkflowMessageRecipients
                                .FirstOrDefaultAsync(r => r.MessageSendId == messageSendId && r.PhoneNumber == recipient.PhoneNumber);
                            
                            if (recipientRecord != null)
                            {
                                await messageSendService.UpdateRecipientStatusAsync(
                                    recipientRecord.Id, 
                                    RecipientStatus.Failed, 
                                    null, 
                                    ex.Message);
                            }
                        }
                    }
                }

                loggingService.LogInformation($"✅ 逾期通知已發送 - 流程 {workflow.Id}，收件人 {recipients.Count} 位");
            }
            catch (Exception ex)
            {
                loggingService.LogError($"發送逾期通知失敗 - 流程 {workflow.Id}: {ex.Message}");
            }
        }

        /// <summary>
        /// 從流程定義中提取 Start 節點的 overdueConfig
        /// </summary>
        private OverdueConfig ExtractOverdueConfigFromDefinition(WorkflowDefinition definition)
        {
            var loggingService = GetLoggingService();
            try
            {
                if (string.IsNullOrEmpty(definition?.Json))
                    return null;

                var workflowData = JsonSerializer.Deserialize<WorkflowDefinitionData>(definition.Json);
                var startNode = workflowData?.Nodes?.FirstOrDefault(n => n.Data?.Type == "start");
                
                return startNode?.Data?.OverdueConfig;
            }
            catch (Exception ex)
            {
                loggingService.LogError($"提取 overdueConfig 失敗: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 檢查需要自動同步的數據集
        /// </summary>
        private async Task CheckDataSetsForAutoSyncAsync(PurpleRiceDbContext db, IServiceProvider serviceProvider)
        {
            var loggingService = GetLoggingService();
            var executionStart = DateTime.UtcNow;
            
            try
            {
                loggingService.LogInformation("--- 開始檢查數據集自動同步 ---");

                // 查詢所有啟用自動更新的數據集
                var autoSyncDataSets = await db.DataSets
                    .Where(ds => ds.IsScheduled == true && ds.UpdateIntervalMinutes > 0)
                    .Include(ds => ds.DataSources)
                    .ToListAsync();

                loggingService.LogInformation($"找到 {autoSyncDataSets.Count} 個啟用自動同步的數據集");

                int syncCount = 0;

                // 順序處理每個數據集，避免重疊同步
                foreach (var dataSet in autoSyncDataSets)
                {
                    try
                    {
                        // 檢查是否需要同步（基於上次同步時間和更新間隔）
                        var needsSync = await ShouldSyncDataSetAsync(db, dataSet);
                        
                        if (needsSync)
                        {
                            loggingService.LogInformation($"🔄 開始自動同步數據集: {dataSet.Name} (ID: {dataSet.Id})");
                            
                            // 設置同步開始狀態
                            dataSet.SyncStatus = "Running";
                            dataSet.SyncStartedAt = DateTime.UtcNow;
                            dataSet.SyncStartedBy = "Scheduler";
                            dataSet.SyncErrorMessage = null;
                            dataSet.TotalRecordsToSync = 0;
                            dataSet.RecordsProcessed = 0;
                            dataSet.RecordsInserted = 0;
                            dataSet.RecordsUpdated = 0;
                            dataSet.RecordsDeleted = 0;
                            dataSet.RecordsSkipped = 0;
                            await db.SaveChangesAsync();
                            
                            // 執行數據同步（同步執行，確保一個一個排隊）
                            var syncResult = await PerformDataSetSyncAsync(db, serviceProvider, dataSet);
                            
                            if (syncResult.Success)
                            {
                                // 設置同步完成狀態
                                dataSet.SyncStatus = "Completed";
                                dataSet.SyncCompletedAt = DateTime.UtcNow;
                                dataSet.SyncStartedAt = null; // 清理同步開始時間
                                dataSet.SyncErrorMessage = null;
                                dataSet.LastDataSyncTime = DateTime.UtcNow;
                                dataSet.LastUpdateTime = DateTime.UtcNow;
                                dataSet.TotalRecords = syncResult.TotalRecords;
                                syncCount++;
                                
                                loggingService.LogInformation($"✅ 數據集 {dataSet.Name} 自動同步成功，處理 {syncResult.TotalRecords} 條記錄");
                            }
                            else
                            {
                                // 設置同步失敗狀態
                                dataSet.SyncStatus = "Failed";
                                dataSet.SyncCompletedAt = DateTime.UtcNow;
                                dataSet.SyncStartedAt = null; // 清理同步開始時間
                                dataSet.SyncErrorMessage = syncResult.ErrorMessage;
                                dataSet.LastDataSyncTime = DateTime.UtcNow;
                                dataSet.LastUpdateTime = DateTime.UtcNow;
                                
                                // 重置進度計數器
                                dataSet.TotalRecordsToSync = 0;
                                dataSet.RecordsProcessed = 0;
                                dataSet.RecordsInserted = 0;
                                dataSet.RecordsUpdated = 0;
                                dataSet.RecordsDeleted = 0;
                                dataSet.RecordsSkipped = 0;
                                
                                loggingService.LogError($"❌ 數據集 {dataSet.Name} 自動同步失敗: {syncResult.ErrorMessage}");
                            }
                        }
                        else
                        {
                            loggingService.LogDebug($"數據集 {dataSet.Name} 尚未到達同步時間");
                        }
                    }
                    catch (Exception ex)
                    {
                        loggingService.LogError($"處理數據集 {dataSet.Name} 自動同步失敗: {ex.Message}");
                        
                        // 記錄錯誤狀態
                        dataSet.LastDataSyncTime = DateTime.UtcNow;
                        dataSet.LastUpdateTime = DateTime.UtcNow;
                    }
                }

                // 保存所有變更（包括執行記錄）
                await db.SaveChangesAsync();
                if (syncCount > 0)
                {
                    loggingService.LogInformation($"✅ 數據集自動同步檢查完成 - 同步了 {syncCount} 個數據集");
                }
                else
                {
                    loggingService.LogInformation("✅ 數據集自動同步檢查完成 - 無需同步的數據集");
                }

                // 記錄執行結果
                var executionEnd = DateTime.UtcNow;
                var duration = (int)(executionEnd - executionStart).TotalMilliseconds;
                // 記錄多個公司的執行結果
                if (autoSyncDataSets.Any())
                {
                    var companies = autoSyncDataSets
                        .Where(ds => ds.CompanyId != null)
                        .Select(ds => ds.CompanyId)
                        .Distinct()
                        .ToList();
                    
                    foreach (var companyId in companies)
                    {
                        await LogSchedulerExecutionAsync(
                            db, "dataset_sync", companyId, null, null,
                            syncCount > 0 ? "Success" : "Skipped",
                            autoSyncDataSets.Count, syncCount, 0,
                            $"同步 {syncCount} 個數據集",
                            null, executionStart, executionEnd, duration);
                    }
                }
            }
            catch (Exception ex)
            {
                loggingService.LogError($"數據集自動同步檢查失敗: {ex.Message}");
                loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                
                await LogSchedulerExecutionAsync(
                    db, "dataset_sync", Guid.Empty, null, null,
                    "Failed", 0, 0, 1, null, ex.Message, DateTime.UtcNow, DateTime.UtcNow, null);
            }
        }

        /// <summary>
        /// 判斷數據集是否需要同步
        /// </summary>
        private async Task<bool> ShouldSyncDataSetAsync(PurpleRiceDbContext db, DataSet dataSet)
        {
            var loggingService = GetLoggingService();
            
            // 檢查是否正在同步中
            if (dataSet.SyncStatus == "Running")
            {
                loggingService.LogDebug($"數據集 {dataSet.Name} 正在同步中，跳過定時同步");
                return false;
            }
            
            // 如果從未同步過，需要同步
            if (dataSet.LastDataSyncTime == null)
            {
                loggingService.LogDebug($"數據集 {dataSet.Name} 從未同步過，需要同步");
                return true;
            }

            // 計算距離上次同步的時間（分鐘）
            var minutesSinceLastSync = (DateTime.UtcNow - dataSet.LastDataSyncTime.Value).TotalMinutes;
            
            // 從 DataSet 中獲取更新間隔
            var updateIntervalMinutes = dataSet.UpdateIntervalMinutes ?? 60; // 默認 60 分鐘

            loggingService.LogDebug($"數據集 {dataSet.Name}: 距上次同步 {minutesSinceLastSync:F1} 分鐘，更新間隔 {updateIntervalMinutes} 分鐘");

            return minutesSinceLastSync >= updateIntervalMinutes;
        }

        /// <summary>
        /// 執行數據集同步
        /// </summary>
        private async Task<SyncResult> PerformDataSetSyncAsync(
            PurpleRiceDbContext db, 
            IServiceProvider serviceProvider, 
            DataSet dataSet)
        {
            var loggingService = GetLoggingService();
            
            try
            {
                loggingService.LogInformation($"開始執行數據集同步: {dataSet.Name} (ID: {dataSet.Id})");
                
                // 創建獨立的 DbContext 實例以避免並發問題
                using var scope = serviceProvider.CreateScope();
                var newDbContext = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                // 重新獲取 DataSet 對象，確保使用 scopedContext
                var scopedDataSet = await newDbContext.DataSets
                    .Include(ds => ds.Columns)
                    .Include(ds => ds.DataSources)
                    .FirstOrDefaultAsync(ds => ds.Id == dataSet.Id);
                
                if (scopedDataSet == null)
                {
                    loggingService.LogError($"找不到對應的 DataSet，DataSet ID: {dataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "找不到對應的 DataSet" };
                }
                
                // 設置同步啟動者為 Scheduler
                scopedDataSet.SyncStartedBy = "Scheduler";
                
                // 重置同步狀態，避免與手動同步衝突
                scopedDataSet.SyncStatus = "Idle";
                scopedDataSet.SyncStartedAt = null;
                scopedDataSet.SyncCompletedAt = null;
                scopedDataSet.SyncErrorMessage = null;
                
                // 重置進度計數器
                scopedDataSet.TotalRecordsToSync = 0;
                scopedDataSet.RecordsProcessed = 0;
                scopedDataSet.RecordsInserted = 0;
                scopedDataSet.RecordsUpdated = 0;
                scopedDataSet.RecordsDeleted = 0;
                scopedDataSet.RecordsSkipped = 0;
                
                await newDbContext.SaveChangesAsync();
                loggingService.LogInformation($"已重置數據集 {dataSet.Name} 的同步狀態");
                
                // 創建 DataSetsController 實例來調用具體的同步方法
                var loggerFactory = serviceProvider.GetRequiredService<ILoggerFactory>();
                var logger = loggerFactory.CreateLogger<DataSetsController>();
                var environment = serviceProvider.GetRequiredService<IWebHostEnvironment>();
                var loggingServiceFactory = serviceProvider.GetRequiredService<Func<string, LoggingService>>();
                var googleSheetsService = serviceProvider.GetRequiredService<IGoogleSheetsService>();
                
                var dataSetsController = new DataSetsController(newDbContext, logger, environment, loggingServiceFactory, googleSheetsService, serviceProvider);
                
                // 獲取數據源
                var dataSource = scopedDataSet.DataSources.FirstOrDefault();
                if (dataSource == null)
                {
                    loggingService.LogError($"未找到數據源配置，數據集ID: {scopedDataSet.Id}");
                    return new SyncResult { Success = false, ErrorMessage = "未找到數據源配置" };
                }
                
                // 設置同步狀態為運行中
                scopedDataSet.SyncStatus = "Running";
                scopedDataSet.SyncStartedAt = DateTime.UtcNow;
                scopedDataSet.SyncStartedBy = "Scheduler";
                scopedDataSet.SyncErrorMessage = null;
                scopedDataSet.SyncCompletedAt = null;
                
                // 重置進度計數器
                scopedDataSet.TotalRecordsToSync = 0;
                scopedDataSet.RecordsProcessed = 0;
                scopedDataSet.RecordsInserted = 0;
                scopedDataSet.RecordsUpdated = 0;
                scopedDataSet.RecordsDeleted = 0;
                scopedDataSet.RecordsSkipped = 0;
                
                await newDbContext.SaveChangesAsync();
                loggingService.LogInformation($"已設置同步狀態為運行中，數據集ID: {scopedDataSet.Id}");
                
                // 直接調用具體的同步方法（同步執行）
                SyncResult result;
                var methodName = dataSource.SourceType.ToUpper() switch
                {
                    "SQL" => "SyncFromSql",
                    "EXCEL" => "SyncFromExcel", 
                    "GOOGLE_DOCS" => "SyncFromGoogleDocs",
                    _ => null
                };
                
                if (methodName == null)
                {
                    loggingService.LogWarning($"不支援的數據源類型，數據集ID: {scopedDataSet.Id}, 數據源類型: {dataSource.SourceType}");
                    return new SyncResult { Success = false, ErrorMessage = "不支援的數據源類型" };
                }
                
                // 使用反射調用具體的同步方法
                var syncMethod = typeof(DataSetsController).GetMethod(methodName, System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                
                if (syncMethod != null)
                {
                    result = await (Task<SyncResult>)syncMethod.Invoke(dataSetsController, new object[] { scopedDataSet, dataSource });
                    loggingService.LogInformation($"數據集 {dataSet.Name} 同步完成，結果: {result.Success}, 記錄數: {result.TotalRecords}");
                    return result;
                }
                else
                {
                    loggingService.LogError($"無法找到 DataSetsController.{methodName} 方法");
                    return new SyncResult { Success = false, ErrorMessage = $"無法找到同步方法 {methodName}" };
                }
            }
            catch (Exception ex)
            {
                loggingService.LogError($"執行數據集同步失敗: {ex.Message}");
                return new SyncResult 
                { 
                    Success = false, 
                    ErrorMessage = ex.Message 
                };
            }
        }


        /// <summary>
        /// 解析步驟的收件人（從 WaitingForUser 或流程啟動人）
        /// </summary>
        private async Task<List<ResolvedRecipient>> ResolveRecipientsForStep(
            PurpleRiceDbContext db,
            WorkflowStepExecution step)
        {
            var loggingService = GetLoggingService();
            try
            {
                var recipients = new List<ResolvedRecipient>();

                // 獲取公司 ID
                var companyId = step.WorkflowExecution?.WorkflowDefinition?.CompanyId ?? Guid.Empty;
                
                // 優先使用 WaitingForUser
                if (!string.IsNullOrEmpty(step.WaitingForUser))
                {
                    recipients.Add(new ResolvedRecipient
                    {
                        Id = Guid.NewGuid(),
                        PhoneNumber = step.WaitingForUser,
                        RecipientType = RecipientType.PhoneNumber,
                        RecipientName = step.WaitingForUser,
                        CompanyId = companyId
                    });
                }
                // 否則使用流程啟動人
                else if (!string.IsNullOrEmpty(step.WorkflowExecution?.InitiatedBy))
                {
                    recipients.Add(new ResolvedRecipient
                    {
                        Id = Guid.NewGuid(),
                        PhoneNumber = step.WorkflowExecution.InitiatedBy,
                        RecipientType = RecipientType.Initiator,
                        RecipientName = "Process Initiator",
                        CompanyId = companyId
                    });
                }

                return recipients;
            }
            catch (Exception ex)
            {
                loggingService.LogError($"解析收件人失敗: {ex.Message}");
                return new List<ResolvedRecipient>();
            }
        }

        /// <summary>
        /// 檢查需要執行的聯絡人匯入排程
        /// </summary>
        private async Task CheckContactImportSchedulesAsync(PurpleRiceDbContext db, IServiceProvider serviceProvider)
        {
            var loggingService = GetLoggingService();
            var executionStart = DateTime.UtcNow;
            
            try
            {
                loggingService.LogInformation("--- 開始檢查聯絡人定時匯入 ---");
                
                var now = DateTime.UtcNow;
                
                // 查詢所有啟用的定時匯入排程
                var scheduledImports = await db.ContactImportSchedules
                    .Where(s => s.IsScheduled && 
                               s.Status == "Active" && 
                               s.IsActive &&
                               s.NextRunAt != null &&
                               s.NextRunAt <= now)
                    .ToListAsync();
                
                loggingService.LogInformation($"找到 {scheduledImports.Count} 個需要執行的匯入排程 (當前時間: {now:yyyy-MM-dd HH:mm:ss})");
                
                // 記錄每個排程的下次執行時間
                foreach (var s in scheduledImports)
                {
                    loggingService.LogInformation($"排程 {s.Name}: 下次執行時間 {s.NextRunAt:yyyy-MM-dd HH:mm:ss}");
                }
                
                int executionCount = 0;
                
                foreach (var schedule in scheduledImports)
                {
                    try
                    {
                        loggingService.LogInformation($"開始執行聯絡人匯入: {schedule.Name} (ID: {schedule.Id})");
                        
                        // 執行匯入
                        var execution = await PerformContactImportAsync(db, serviceProvider, schedule);
                        
                        if (execution != null)
                        {
                            executionCount++;
                            
                            // 更新排程的下次執行時間
                            await UpdateContactImportNextRunTime(db, schedule);
                            
                            loggingService.LogInformation($"✅ 聯絡人匯入完成: {schedule.Name}，下次執行: {schedule.NextRunAt}");
                        }
                    }
                    catch (Exception ex)
                    {
                        loggingService.LogError($"執行聯絡人匯入 {schedule.Id} 失敗: {ex.Message}");
                        loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                        
                        // 記錄失敗
                        var execution = new ContactImportExecution
                        {
                            Id = Guid.NewGuid(),
                            ScheduleId = schedule.Id,
                            CompanyId = schedule.CompanyId,
                            Status = "Failed",
                            TotalRecords = 0,
                            SuccessCount = 0,
                            FailedCount = 0,
                            ErrorMessage = ex.Message,
                            StartedAt = DateTime.UtcNow,
                            CompletedAt = DateTime.UtcNow
                        };
                        
                        db.ContactImportExecutions.Add(execution);
                    }
                }
                
                // 記錄執行結果
                var executionEnd = DateTime.UtcNow;
                var duration = (int)(executionEnd - executionStart).TotalMilliseconds;
                
                if (executionCount > 0)
                {
                    await db.SaveChangesAsync();
                    loggingService.LogInformation($"✅ 聯絡人定時匯入檢查完成 - 執行了 {executionCount} 個匯入");
                    
                    // 記錄多個公司的執行結果
                    var companies = scheduledImports
                        .Where(s => s.CompanyId != Guid.Empty)
                        .Select(s => s.CompanyId)
                        .Distinct()
                        .ToList();
                    
                    foreach (var companyId in companies)
                    {
                        await LogSchedulerExecutionAsync(
                            db, "contact_import", companyId, null, null,
                            "Success", scheduledImports.Count, executionCount, 0,
                            $"執行了 {executionCount} 個匯入",
                            null, executionStart, executionEnd, duration);
                    }
                    await db.SaveChangesAsync();
                }
                else
                {
                    loggingService.LogInformation("✅ 聯絡人定時匯入檢查完成 - 無需執行的排程");
                    
                    // 記錄多個公司的執行結果
                    var companies = scheduledImports
                        .Where(s => s.CompanyId != Guid.Empty)
                        .Select(s => s.CompanyId)
                        .Distinct()
                        .ToList();
                    
                    foreach (var companyId in companies)
                    {
                        await LogSchedulerExecutionAsync(
                            db, "contact_import", companyId, null, null,
                            "Skipped", scheduledImports.Count, 0, 0,
                            "無需執行的排程",
                            null, executionStart, executionEnd, duration);
                    }
                    await db.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                loggingService.LogError($"聯絡人定時匯入檢查失敗: {ex.Message}");
                loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                
                await LogSchedulerExecutionAsync(
                    db, "contact_import", Guid.Empty, null, null,
                    "Failed", 0, 0, 1, null, ex.Message, DateTime.UtcNow, DateTime.UtcNow, null);
                await db.SaveChangesAsync();
            }
        }

        /// <summary>
        /// 執行聯絡人匯入
        /// </summary>
        private async Task<ContactImportExecution> PerformContactImportAsync(
            PurpleRiceDbContext db, 
            IServiceProvider serviceProvider, 
            ContactImportSchedule schedule)
        {
            var loggingService = GetLoggingService();
            
            // 創建執行記錄
            var execution = new ContactImportExecution
            {
                Id = Guid.NewGuid(),
                ScheduleId = schedule.Id,
                CompanyId = schedule.CompanyId,
                Status = "Running",
                TotalRecords = 0,
                SuccessCount = 0,
                FailedCount = 0,
                StartedAt = DateTime.UtcNow
            };
            
            db.ContactImportExecutions.Add(execution);
            await db.SaveChangesAsync();
            
            try
            {
                // 獲取 ContactListService
                var contactListService = serviceProvider.GetRequiredService<ContactListService>();
                
                // 解析配置
                var sourceConfig = JsonSerializer.Deserialize<Dictionary<string, object>>(schedule.SourceConfig);
                var fieldMapping = JsonSerializer.Deserialize<Dictionary<string, string>>(schedule.FieldMapping);
                
                // TODO: 根據匯入類型執行
                // 這裡需要實現具體的匯入邏輯
                // 目前先記錄 TODO
                loggingService.LogWarning($"聯絡人匯入邏輯尚未實現 - 匯入類型: {schedule.ImportType}");
                
                execution.Status = "Success";
                execution.TotalRecords = 0;
                execution.SuccessCount = 0;
                execution.CompletedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
                
                loggingService.LogInformation($"聯絡人匯入完成（佔位）: {schedule.Name}");
                return execution;
            }
            catch (Exception ex)
            {
                execution.Status = "Failed";
                execution.ErrorMessage = ex.Message;
                execution.CompletedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
                
                loggingService.LogError($"聯絡人匯入失敗: {ex.Message}");
                return execution;
            }
        }

        /// <summary>
        /// 更新聯絡人匯入排程的下次執行時間
        /// </summary>
        private async Task UpdateContactImportNextRunTime(PurpleRiceDbContext db, ContactImportSchedule schedule)
        {
            var loggingService = GetLoggingService();
            DateTime? nextRunAt = null;
            
            switch (schedule.ScheduleType?.ToLower())
            {
                case "interval":
                    if (schedule.IntervalMinutes.HasValue)
                    {
                        nextRunAt = DateTime.UtcNow.AddMinutes(schedule.IntervalMinutes.Value);
                        loggingService.LogInformation($"排程 {schedule.Name} 下次執行時間: {nextRunAt} (間隔 {schedule.IntervalMinutes.Value} 分鐘)");
                    }
                    break;
                case "daily":
                    nextRunAt = DateTime.UtcNow.AddDays(1);
                    loggingService.LogInformation($"排程 {schedule.Name} 下次執行時間: {nextRunAt} (每日)");
                    break;
                case "weekly":
                    nextRunAt = DateTime.UtcNow.AddDays(7);
                    loggingService.LogInformation($"排程 {schedule.Name} 下次執行時間: {nextRunAt} (每週)");
                    break;
                case "cron":
                    // TODO: 實現 Cron 表達式解析
                    if (!string.IsNullOrEmpty(schedule.ScheduleCron))
                    {
                        // 使用 NCrontab 或其他 Cron 解析庫
                        nextRunAt = DateTime.UtcNow.AddHours(1); // 臨時方案
                        loggingService.LogInformation($"排程 {schedule.Name} 下次執行時間: {nextRunAt} (Cron)");
                    }
                    break;
            }
            
            schedule.LastRunAt = DateTime.UtcNow;
            schedule.NextRunAt = nextRunAt;
            schedule.UpdatedAt = DateTime.UtcNow;
            schedule.UpdatedBy = "system";
            
            // 使用 ExecuteSqlRaw 以避免 OUTPUT 子句問題
            await db.Database.ExecuteSqlRawAsync(
                "UPDATE contact_import_schedules SET last_run_at = @p0, next_run_at = @p1, updated_at = @p2, updated_by = @p3 WHERE id = @p4",
                schedule.LastRunAt, schedule.NextRunAt, schedule.UpdatedAt, schedule.UpdatedBy, schedule.Id);
            
            loggingService.LogInformation($"已更新排程 {schedule.Name} 的時間戳記");
        }

        public override Task StopAsync(CancellationToken cancellationToken)
        {
            var loggingService = GetLoggingService();
            loggingService.LogInformation("WorkflowMonitoringSchedulerService 正在停止...");
            return base.StopAsync(cancellationToken);
        }
    }

    #region 配置數據結構

    /// <summary>
    /// Validation 配置（從 ValidationConfig JSON 反序列化）
    /// </summary>
    public class ValidationConfig
    {
        public bool? Enabled { get; set; }
        public string ValidatorType { get; set; }
        public int? RetryIntervalDays { get; set; }
        public int? RetryIntervalHours { get; set; }
        public int? RetryIntervalMinutes { get; set; }
        public int? RetryLimit { get; set; }
        public RetryMessageConfig RetryMessageConfig { get; set; }
        public EscalationConfig EscalationConfig { get; set; }
    }

    /// <summary>
    /// 重試訊息配置
    /// </summary>
    public class RetryMessageConfig
    {
        public bool UseTemplate { get; set; }
        public string Message { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public string TemplateName { get; set; } = string.Empty;
        public bool IsMetaTemplate { get; set; }
        public List<TemplateVariableMapping> TemplateVariables { get; set; } = new List<TemplateVariableMapping>();
    }

    /// <summary>
    /// 升級通知配置
    /// </summary>
    public class EscalationConfig
    {
        public string Recipients { get; set; } = string.Empty;
        public RecipientDetailsConfig RecipientDetails { get; set; } = new RecipientDetailsConfig();
        public bool UseTemplate { get; set; }
        public string Message { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public string TemplateName { get; set; } = string.Empty;
        public bool IsMetaTemplate { get; set; }
        public List<TemplateVariableMapping> TemplateVariables { get; set; } = new List<TemplateVariableMapping>();
    }

    /// <summary>
    /// 收件人詳細信息配置
    /// </summary>
    public class RecipientDetailsConfig
    {
        public List<UserRecipient> Users { get; set; } = new List<UserRecipient>();
        public List<ContactRecipient> Contacts { get; set; } = new List<ContactRecipient>();
        public List<string> Groups { get; set; } = new List<string>(); // 改為字符串列表，因為 JSON 中是字符串 ID
        public List<string> Hashtags { get; set; } = new List<string>(); // 改為字符串列表
        public bool UseInitiator { get; set; }
        public List<string> PhoneNumbers { get; set; } = new List<string>();
    }

    public class UserRecipient
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }

    public class ContactRecipient
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
    }

    public class GroupRecipient
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    public class HashtagRecipient
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>
    /// Overdue 配置（從 Start 節點的 overdueConfig 反序列化）
    /// </summary>
    public class OverdueConfig
    {
        public bool Enabled { get; set; }
        public int? Days { get; set; }
        public int? Hours { get; set; }
        public int? Minutes { get; set; }
        public EscalationConfig EscalationConfig { get; set; }
    }

    /// <summary>
    /// 工作流程定義數據（用於解析 WorkflowDefinition.Json）
    /// </summary>
    public class WorkflowDefinitionData
    {
        public List<NodeDefinition> Nodes { get; set; }
        public List<EdgeDefinition> Edges { get; set; }
    }

    public class NodeDefinition
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public NodeData Data { get; set; }
        public Position Position { get; set; }
    }

    public class NodeData
    {
        public string Type { get; set; }
        public string Label { get; set; }
        public string TaskName { get; set; }
        public OverdueConfig OverdueConfig { get; set; }
        // 其他屬性根據需要添加...
    }

    public class Position
    {
        public double X { get; set; }
        public double Y { get; set; }
    }

    public class EdgeDefinition
    {
        public string Id { get; set; }
        public string Source { get; set; }
        public string Target { get; set; }
    }

    /// <summary>
    /// 模板變量映射
    /// </summary>
    public class TemplateVariableMapping
    {
        public string ParameterName { get; set; } = string.Empty;
        public string ProcessVariableId { get; set; } = string.Empty;
        public string ProcessVariableName { get; set; } = string.Empty;
    }

    #endregion
}

