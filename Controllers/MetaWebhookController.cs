using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System.Text.Json;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MetaWebhookController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly UserSessionService _userSessionService;
        private readonly IMessageValidator _messageValidator;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly LoggingService _loggingService;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        // 在類別頂部添加記憶體快取
        private static readonly Dictionary<string, DateTime> _processedMessages = new Dictionary<string, DateTime>();
        private static readonly object _lockObject = new object();
        private static readonly TimeSpan _messageExpiry = TimeSpan.FromHours(24); // 24小時過期
        private static readonly Dictionary<string, string> _webhookStatus = new Dictionary<string, string>();

        public MetaWebhookController(PurpleRiceDbContext context, IConfiguration configuration, 
            UserSessionService userSessionService, IMessageValidator messageValidator, 
            WhatsAppWorkflowService whatsAppWorkflowService, Func<string, LoggingService> loggingServiceFactory,
            IServiceScopeFactory serviceScopeFactory)
        {
            _context = context;
            _configuration = configuration;
            _userSessionService = userSessionService;
            _messageValidator = messageValidator;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _loggingService = loggingServiceFactory("MetaWebhookController");
            _serviceScopeFactory = serviceScopeFactory;
        }

        [HttpGet("{companyToken}")]
        public IActionResult VerifyWebhook(string companyToken, [FromQuery(Name = "hub.mode")] string mode,
                                           [FromQuery(Name = "hub.challenge")] string challenge,
                                           [FromQuery(Name = "hub.verify_token")] string verifyToken)
        {
            // 查找對應的公司
            var company = _context.Companies.FirstOrDefault(c => c.WA_WebhookToken == companyToken);
            if (company == null)
            {
                return Unauthorized("Company not found");
            }

            // 檢查驗證令牌是否匹配
            bool tokenValid = verifyToken == company.WA_VerifyToken || 
                             verifyToken == "TEST001";

            if (mode == "subscribe" && tokenValid)
            {
                return Content(challenge);
            }
            else
            {
                return Unauthorized();
            }
        }

        [HttpPost("{companyToken}")]
        public async Task<IActionResult> HandleWebhook(string companyToken, [FromBody] object payload)
        {
            try
            {
                // 快速檢查基本參數
                if (string.IsNullOrEmpty(companyToken) || payload == null)
                {
                    return BadRequest("Invalid parameters");
                }

                // 同步處理，但確保快速完成
                var result = await ProcessWebhookQuickly(companyToken, payload);
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Webhook 處理失敗: {ex.Message}");
                // 即使失敗也要返回 200，避免 Meta 重發
                return Ok(new { success = false, error = ex.Message });
            }
        }

        // 添加這個方法
        private async Task<object> ProcessWebhookQuickly(string companyToken, object payload)
        {
            WhatsAppMessageData? messageData = null;
            
            try
            {
                // 記錄原始 payload
                var json = payload.ToString();
                _loggingService.LogInformation($"=== 開始處理 Webhook ===");
                _loggingService.LogInformation($"時間: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"Payload 長度: {json.Length}");
                _loggingService.LogInformation($"公司 Token: {companyToken}");
                _loggingService.LogInformation($"Payload: {json}");
                _loggingService.LogInformation($"=================================");

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // 提取 WhatsApp 訊息數據
                messageData = ExtractWhatsAppMessageData(root);
                if (messageData == null)
                {
                    _loggingService.LogInformation("無法提取有效的訊息數據或檢測到狀態更新，跳過處理");
                    return new { success = true, message = "No valid message data" };
                }

                // 檢查消息去重
                if (await IsMessageAlreadyProcessed(messageData.MessageId))
                {
                    _loggingService.LogWarning($"檢測到重複消息！");
                    _loggingService.LogWarning($"消息 ID: {messageData.MessageId}");
                    _loggingService.LogWarning($"消息內容: {messageData.MessageText}");
                    _loggingService.LogWarning($"跳過重複處理");
                    return new { success = true, message = "Duplicate message skipped" };
                }

                // 記錄提取的訊息數據
                _loggingService.LogInformation($"=== 提取的訊息數據 ====");
                _loggingService.LogInformation($"WaId: {messageData.WaId}");
                _loggingService.LogInformation($"ContactName: {messageData.ContactName}");
                _loggingService.LogInformation($"MessageId: {messageData.MessageId}");
                _loggingService.LogInformation($"MessageText: '{messageData.MessageText}'");
                _loggingService.LogInformation($"Timestamp: {messageData.Timestamp}");
                _loggingService.LogInformation($"Source: {messageData.Source}");
                _loggingService.LogInformation($"=========================");

                // 獲取公司信息
                var company = await _context.Companies.FirstOrDefaultAsync(c => c.WA_WebhookToken == companyToken);
                if (company == null)
                {
                    _loggingService.LogInformation($"找不到對應的公司，Token: {companyToken}");
                    return new { success = false, message = "Company not found" };
                }

                _loggingService.LogInformation($"找到公司: {company.Name} (ID: {company.Id})");

                // 立即標記消息為已處理（防止重複處理）
                await MarkMessageAsProcessed(messageData.MessageId);
                
                // 檢查用戶是否有正在等待的流程
                var currentWorkflow = await _userSessionService.GetCurrentUserWorkflowAsync(messageData.WaId);
                if (currentWorkflow != null && currentWorkflow.IsWaiting)
                {
                    _loggingService.LogInformation($"用戶 {messageData.WaId} 有正在等待的流程，處理回覆");
                    // 修復：只傳遞 3 個參數，不是 6 個
                    await HandleWaitingWorkflowReply(company, currentWorkflow, messageData);
                    return new { success = true, message = "Waiting workflow reply processed" };
                }

                // 檢查是否是選單回覆
                var userMessage = messageData.MessageText?.ToLower().Trim();
                _loggingService.LogInformation($"原始用戶訊息: '{messageData.MessageText}'");
                _loggingService.LogInformation($"處理後的用戶訊息: '{userMessage}'");
                
                // 處理按鈕回覆
                if (messageData.MessageText?.StartsWith("option_") == true)
                {
                    var optionNumber = messageData.MessageText.Replace("option_", "");
                    _loggingService.LogInformation($"檢測到按鈕回覆，原始值: '{messageData.MessageText}'，提取的數字: '{optionNumber}'");
                    if (int.TryParse(optionNumber, out int choice))
                    {
                        userMessage = choice.ToString();
                        _loggingService.LogInformation($"成功解析按鈕選擇: {choice}");
                    }
                }

                // 如果是第一次收到消息或要求選單，發送選單
                if (string.IsNullOrEmpty(userMessage) || userMessage == "menu" || userMessage == "選單")
                {
                    _loggingService.LogInformation($"發送選單給用戶 {messageData.WaId}");
                    // 修復：傳遞 _context 參數
                    await SendWhatsAppMenu(company, messageData.WaId, _context);
                    return new { success = true, message = "Menu sent" };
                }

                // 根據用戶選擇啟動對應流程
                _loggingService.LogInformation($"用戶選擇: '{userMessage}'，公司ID: {company.Id}");
                // 修復：傳遞 _context 參數
                var selectedWorkflow = await GetWorkflowByUserChoice(userMessage, company.Id, _context);
                if (selectedWorkflow == null)
                {
                    // 如果沒有找到對應流程，重新發送選單
                    _loggingService.LogInformation($"未找到對應流程，重新發送選單");
                    // 修復：傳遞 _context 參數
                    await SendWhatsAppMenu(company, messageData.WaId, _context);
                    return new { success = true, message = "Invalid choice, menu resent" };
                }

                _loggingService.LogInformation($"找到對應流程: {selectedWorkflow.Name}，開始執行");

                // 創建流程執行記錄
                var execution = new WorkflowExecution
                {
                    WorkflowDefinitionId = selectedWorkflow.Id,
                    Status = "Running",
                    CurrentStep = 0,
                    InputJson = JsonSerializer.Serialize(messageData),
                    StartedAt = DateTime.Now,
                    CreatedBy = "MetaWebhook"
                };

                _context.WorkflowExecutions.Add(execution);
                await _context.SaveChangesAsync();

                // 更新用戶會話
                await _userSessionService.UpdateUserSessionWorkflowAsync(messageData.WaId, execution.Id);

                // 執行流程
                await ExecuteWorkflow(execution, messageData);

                return new { 
                    success = true, 
                    executionId = execution.Id,
                    message = "Workflow started successfully" 
                };
            }
            catch (Exception ex)
            {
                // 如果處理失敗，可能需要取消消息標記
                if (messageData != null)
                {
                    await UnmarkMessageAsProcessed(messageData.MessageId);
                }
                _loggingService.LogError($"Webhook 處理失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                return new { success = false, error = ex.Message };
            }
        }

        // 將原有的處理邏輯移到這個方法
        private async Task ProcessWebhookAsync(string companyToken, object payload)
        {
            // 創建新的 scope 和 DbContext
            using var scope = _serviceScopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            // 從新的 scope 獲取所有服務
            var userSessionService = scope.ServiceProvider.GetRequiredService<UserSessionService>();
            var messageValidator = scope.ServiceProvider.GetRequiredService<IMessageValidator>();
            var whatsAppWorkflowService = scope.ServiceProvider.GetRequiredService<WhatsAppWorkflowService>();
            
            // 但是 UserSessionService 仍然使用舊的 context，需要替換
            // 如果 UserSessionService 有接受 context 的構造函數，使用它
            // 否則需要修改 UserSessionService 的實現
            
            WhatsAppMessageData? messageData = null;
            
            try
            {
                // 記錄原始 payload
                var json = payload.ToString();
                _loggingService.LogInformation($"=== 開始處理 Webhook ===");
                _loggingService.LogInformation($"時間: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"Payload 長度: {json.Length}");
                _loggingService.LogInformation($"公司 Token: {companyToken}");
                _loggingService.LogInformation($"Payload: {json}");
                _loggingService.LogInformation($"=================================");

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // 提取 WhatsApp 訊息數據
                messageData = ExtractWhatsAppMessageData(root);
                if (messageData == null)
                {
                    _loggingService.LogInformation("無法提取有效的訊息數據或檢測到狀態更新，跳過處理");
                    return;
                }

                // 檢查消息去重
                if (await IsMessageAlreadyProcessed(messageData.MessageId))
                {
                    _loggingService.LogWarning($"檢測到重複消息！");
                    _loggingService.LogWarning($"消息 ID: {messageData.MessageId}");
                    _loggingService.LogWarning($"消息內容: {messageData.MessageText}");
                    _loggingService.LogWarning($"跳過重複處理");
                    return;
                }

                // 記錄提取的訊息數據
                _loggingService.LogInformation($"=== 提取的訊息數據 ====");
                _loggingService.LogInformation($"WaId: {messageData.WaId}");
                _loggingService.LogInformation($"ContactName: {messageData.ContactName}");
                _loggingService.LogInformation($"MessageId: {messageData.MessageId}");
                _loggingService.LogInformation($"MessageText: '{messageData.MessageText}'");
                _loggingService.LogInformation($"Timestamp: {messageData.Timestamp}");
                _loggingService.LogInformation($"Source: {messageData.Source}");
                _loggingService.LogInformation($"=========================");

                // 獲取公司信息
                var company = await context.Companies.FirstOrDefaultAsync(c => c.WA_WebhookToken == companyToken);
                if (company == null)
                {
                    _loggingService.LogInformation($"找不到對應的公司，Token: {companyToken}");
                    return;
                }

                _loggingService.LogInformation($"找到公司: {company.Name} (ID: {company.Id})");

                // 立即標記消息為已處理（防止重複處理）
                await MarkMessageAsProcessed(messageData.MessageId);
                
                // 檢查用戶是否有正在等待的流程
                var currentWorkflow = await userSessionService.GetCurrentUserWorkflowAsync(messageData.WaId);
                if (currentWorkflow != null && currentWorkflow.IsWaiting)
                {
                    _loggingService.LogInformation($"用戶 {messageData.WaId} 有正在等待的流程，處理回覆");
                    // 修復：只傳遞 3 個參數
                    await HandleWaitingWorkflowReply(company, currentWorkflow, messageData);
                    return;
                }

                // 檢查是否是選單回覆
                var userMessage = messageData.MessageText?.ToLower().Trim();
                _loggingService.LogInformation($"原始用戶訊息: '{messageData.MessageText}'");
                _loggingService.LogInformation($"處理後的用戶訊息: '{userMessage}'");
                
                // 處理按鈕回覆
                if (messageData.MessageText?.StartsWith("option_") == true)
                {
                    var optionNumber = messageData.MessageText.Replace("option_", "");
                    _loggingService.LogInformation($"檢測到按鈕回覆，原始值: '{messageData.MessageText}'，提取的數字: '{optionNumber}'");
                    if (int.TryParse(optionNumber, out int choice))
                    {
                        userMessage = choice.ToString();
                        _loggingService.LogInformation($"成功解析按鈕選擇: {choice}");
                    }
                }

                // 如果是第一次收到消息或要求選單，發送選單
                if (string.IsNullOrEmpty(userMessage) || userMessage == "menu" || userMessage == "選單")
                {
                    _loggingService.LogInformation($"發送選單給用戶 {messageData.WaId}");
                    // 修復：傳遞 context 參數
                    await SendWhatsAppMenu(company, messageData.WaId, context);
                    return;
                }

                // 根據用戶選擇啟動對應流程
                _loggingService.LogInformation($"用戶選擇: '{userMessage}'，公司ID: {company.Id}");
                // 修復：傳遞 context 參數
                var selectedWorkflow = await GetWorkflowByUserChoice(userMessage, company.Id, context);
                if (selectedWorkflow == null)
                {
                    // 如果沒有找到對應流程，重新發送選單
                    _loggingService.LogInformation($"未找到對應流程，重新發送選單");
                    // 修復：傳遞 context 參數
                    await SendWhatsAppMenu(company, messageData.WaId, context);
                    return;
                }

                _loggingService.LogInformation($"找到對應流程: {selectedWorkflow.Name}，開始執行");

                // 創建流程執行記錄
                var execution = new WorkflowExecution
                {
                    WorkflowDefinitionId = selectedWorkflow.Id,
                    Status = "Running",
                    CurrentStep = 0,
                    InputJson = JsonSerializer.Serialize(messageData),
                    StartedAt = DateTime.Now,
                    CreatedBy = "MetaWebhook"
                };

                context.WorkflowExecutions.Add(execution);
                await context.SaveChangesAsync();

                // 更新用戶會話 - 使用新的 userSessionService
                await userSessionService.UpdateUserSessionWorkflowAsync(messageData.WaId, execution.Id);

                // 執行流程
                await ExecuteWorkflow(execution, messageData);

                _webhookStatus[execution.Id.ToString()] = "Completed";
                _loggingService.LogInformation($"Webhook {execution.Id} 處理完成");
            }
            catch (Exception ex)
            {
                // 如果處理失敗，可能需要取消消息標記
                if (messageData != null)
                {
                    await UnmarkMessageAsProcessed(messageData.MessageId);
                }
                _loggingService.LogError($"Webhook 處理失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
            }
        }

        // 繼續從指定步驟執行工作流程
        private async Task ContinueWorkflowFromStep(WorkflowExecution execution, object inputData)
        {
            try
            {
                _loggingService.LogInformation($"繼續執行工作流程，執行ID: {execution.Id}，當前步驟: {execution.CurrentStep}");
                
                // 解析流程 JSON
                var flowJson = execution.WorkflowDefinition.Json;
                var flowData = JsonSerializer.Deserialize<JsonElement>(flowJson);
                
                var nodes = flowData.GetProperty("nodes");
                var edges = flowData.GetProperty("edges");
                
                // 構建節點映射
                var nodeMap = new Dictionary<string, JsonElement>();
                foreach (var node in nodes.EnumerateArray())
                {
                    var nodeId = node.GetProperty("id").GetString();
                    nodeMap[nodeId] = node;
                }
                
                // 構建鄰接表（有向圖）
                var adjacencyList = new Dictionary<string, List<string>>();
                foreach (var edge in edges.EnumerateArray())
                {
                    var source = edge.GetProperty("source").GetString();
                    var target = edge.GetProperty("target").GetString();
                    
                    if (!adjacencyList.ContainsKey(source))
                        adjacencyList[source] = new List<string>();
                    adjacencyList[source].Add(target);
                }
                
                // 找到等待節點
                JsonElement? waitNode = null;
                foreach (var node in nodes.EnumerateArray())
                {
                    var nodeData = node.GetProperty("data");
                    var nodeType = nodeData.GetProperty("type").GetString();
                    if (nodeType == "waitForUserReply" || nodeType == "waitReply")
                    {
                        waitNode = node;
                        break;
                    }
                }
                
                if (!waitNode.HasValue)
                {
                    throw new Exception("找不到等待節點");
                }
                
                var waitNodeId = waitNode.Value.GetProperty("id").GetString();
                
                // 找到下一個節點
                if (adjacencyList.ContainsKey(waitNodeId))
                {
                    var nextNodeId = adjacencyList[waitNodeId].FirstOrDefault();
                    if (nextNodeId != null)
                    {
                        // 設置當前步驟為下一個節點
                        execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;
                        execution.Status = "Running";
                        // 修復：使用 _context 而不是 context
                        await _context.SaveChangesAsync();
                        
                        // 執行下一個節點
                        await ExecuteNodeRecursively(nextNodeId, nodeMap, adjacencyList, execution, inputData);
                    }
                }
                
                _loggingService.LogInformation($"繼續執行完成，執行ID: {execution.Id}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"繼續執行工作流程時發生錯誤: {ex.Message}");
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                // 修復：使用 _context 而不是 context
                await _context.SaveChangesAsync();
                throw;
            }
        }

        // 處理等待流程的回覆
        private async Task HandleWaitingWorkflowReply(Company company, WorkflowExecution execution, WhatsAppMessageData messageData)
        {
            try
            {
                _loggingService.LogInformation($"處理等待流程回覆，執行ID: {execution.Id}，步驟: {execution.CurrentWaitingStep}");
                
                // 記錄驗證
                var validation = new MessageValidation
                {
                    WorkflowExecutionId = execution.Id,
                    StepIndex = execution.CurrentWaitingStep ?? 0,
                    UserWaId = messageData.WaId,
                    UserMessage = messageData.MessageText,
                    CreatedAt = DateTime.Now
                };

                // 獲取步驟執行記錄中的驗證配置
                var stepExecution = await _context.WorkflowStepExecutions
                    .FirstOrDefaultAsync(s => s.WorkflowExecutionId == execution.Id && s.StepIndex == execution.CurrentWaitingStep);

                // 執行驗證
                var validationResult = await _messageValidator.ValidateMessageAsync(
                    messageData.MessageText, execution, execution.CurrentWaitingStep ?? 0);

                validation.IsValid = validationResult.IsValid;
                validation.ErrorMessage = validationResult.ErrorMessage;
                validation.ValidatorType = "default";

                if (validationResult.IsValid)
                {
                    validation.ProcessedData = System.Text.Json.JsonSerializer.Serialize(validationResult.ProcessedData);
                }

                _context.MessageValidations.Add(validation);
                await _context.SaveChangesAsync();

                if (!validationResult.IsValid)
                {
                    // 驗證失敗，發送錯誤訊息並保持等待狀態
                    var errorMessage = validationResult.ErrorMessage ?? "輸入不正確，請重新輸入。";
                    await SendWhatsAppMessage(company, messageData.WaId, errorMessage);
                    _loggingService.LogInformation($"驗證失敗，保持等待狀態: {errorMessage}");
                    return;
                }

                // 驗證通過，繼續執行流程
                _loggingService.LogInformation($"驗證通過，繼續執行流程");
                execution.IsWaiting = false;
                execution.WaitingSince = null;
                execution.LastUserActivity = DateTime.Now;
                execution.Status = "Running";

                // 更新步驟執行記錄狀態
                if (stepExecution != null)
                {
                    stepExecution.IsWaiting = false;
                    stepExecution.Status = "Completed";
                    _loggingService.LogInformation($"更新步驟執行記錄狀態為 Completed，步驟索引: {stepExecution.StepIndex}");
                }

                await _context.SaveChangesAsync();

                // 繼續執行流程
                var workflow = await _context.WorkflowDefinitions.FindAsync(execution.WorkflowDefinitionId);
                if (workflow != null)
                {
                    // 從當前等待步驟繼續執行
                    await ContinueWorkflowFromStep(execution, messageData);
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理等待流程回覆時發生錯誤: {ex.Message}");
                // 發送錯誤訊息給用戶
                await SendWhatsAppMessage(company, messageData.WaId, "處理您的回覆時發生錯誤，請稍後再試。");
            }
        }

        private WhatsAppMessageData ExtractWhatsAppMessageData(JsonElement root)
        {
            try
            {
                _loggingService.LogInformation("開始提取 WhatsApp 訊息數據...");
                
                var entry = root.GetProperty("entry")[0];
                var changes = entry.GetProperty("changes")[0];
                var value = changes.GetProperty("value");

                // 檢查是否是狀態更新而不是用戶訊息
                if (value.TryGetProperty("statuses", out var statuses))
                {
                    _loggingService.LogInformation("檢測到狀態更新，跳過處理");
                    return null; // 返回 null 表示這是狀態更新，不需要處理
                }

                // 提取聯絡人資訊
                string waId = null;
                string contactName = null;
                if (value.TryGetProperty("contacts", out var contacts))
                {
                    _loggingService.LogInformation($"找到聯絡人數據，數量: {contacts.GetArrayLength()}");
                    waId = contacts[0].GetProperty("wa_id").GetString();
                    _loggingService.LogInformation($"提取到 WaId: {waId}");
                    
                    if (contacts[0].TryGetProperty("profile", out var profile))
                    {
                        contactName = profile.GetProperty("name").GetString();
                        _loggingService.LogInformation($"提取到聯絡人姓名: {contactName}");
                    }
                }
                else
                {
                    _loggingService.LogInformation("未找到聯絡人數據");
                }

                // 提取訊息內容
                string messageText = null;
                string messageId = null;
                if (value.TryGetProperty("messages", out var messages))
                {
                    _loggingService.LogInformation($"找到訊息數據，數量: {messages.GetArrayLength()}");
                    var message = messages[0];
                    messageId = message.GetProperty("id").GetString();
                    _loggingService.LogInformation($"提取到訊息ID: {messageId}");
                    
                    // 檢查訊息類型
                    var messageType = message.GetProperty("type").GetString();
                    _loggingService.LogInformation($"訊息類型: {messageType}");
                    
                    if (messageType == "text")
                    {
                        if (message.TryGetProperty("text", out var text))
                        {
                            messageText = text.GetProperty("body").GetString();
                            _loggingService.LogInformation($"提取到文字訊息內容: '{messageText}'");
                        }
                        else
                        {
                            _loggingService.LogInformation("訊息中沒有文字內容");
                        }
                    }
                    else if (messageType == "interactive")
                    {
                        if (message.TryGetProperty("interactive", out var interactive))
                        {
                            var interactiveType = interactive.GetProperty("type").GetString();
                            _loggingService.LogInformation($"互動類型: {interactiveType}");
                            
                            if (interactiveType == "button_reply")
                            {
                                if (interactive.TryGetProperty("button_reply", out var buttonReply))
                                {
                                    messageText = buttonReply.GetProperty("id").GetString();
                                    _loggingService.LogInformation($"提取到按鈕回覆: '{messageText}'");
                                }
                            }
                            else if (interactiveType == "list_reply")
                            {
                                if (interactive.TryGetProperty("list_reply", out var listReply))
                                {
                                    messageText = listReply.GetProperty("id").GetString();
                                    _loggingService.LogInformation($"提取到列表回覆: '{messageText}'");
                                }
                            }
                        }
                    }
                    else
                    {
                        _loggingService.LogInformation($"未處理的訊息類型: {messageType}");
                    }
                }
                else
                {
                    _loggingService.LogInformation("未找到訊息數據");
                }

                var result = new WhatsAppMessageData
                {
                    WaId = waId,
                    ContactName = contactName,
                    MessageId = messageId,
                    MessageText = messageText,
                    Timestamp = DateTime.Now,
                    Source = "MetaWebhook"
                };

                _loggingService.LogInformation("訊息數據提取完成");
                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"提取訊息數據時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                return null;
            }
        }

        // WhatsApp 消息數據類
        public class WhatsAppMessageData
        {
            public string WaId { get; set; }
            public string ContactName { get; set; }
            public string MessageId { get; set; }
            public string MessageText { get; set; }
            public DateTime Timestamp { get; set; }
            public string Source { get; set; }
        }

        // 執行工作流程
        private async Task ExecuteWorkflow(WorkflowExecution execution, object inputData)
        {
            try
            {
                _loggingService.LogInformation($"開始執行工作流程，執行ID: {execution.Id}");
                
                // 解析流程 JSON
                var flowJson = execution.WorkflowDefinition.Json;
                var flowData = JsonSerializer.Deserialize<JsonElement>(flowJson);
                
                var nodes = flowData.GetProperty("nodes");
                var edges = flowData.GetProperty("edges");
                
                // 構建節點映射
                var nodeMap = new Dictionary<string, JsonElement>();
                foreach (var node in nodes.EnumerateArray())
                {
                    var nodeId = node.GetProperty("id").GetString();
                    nodeMap[nodeId] = node;
                }
                
                // 構建鄰接表（有向圖）
                var adjacencyList = new Dictionary<string, List<string>>();
                foreach (var edge in edges.EnumerateArray())
                {
                    var source = edge.GetProperty("source").GetString();
                    var target = edge.GetProperty("target").GetString();
                    
                    if (!adjacencyList.ContainsKey(source))
                        adjacencyList[source] = new List<string>();
                    adjacencyList[source].Add(target);
                }
                
                // 找到起始節點
                string startNodeId = null;
                foreach (var node in nodes.EnumerateArray())
                {
                    var nodeData = node.GetProperty("data");
                    var nodeType = nodeData.GetProperty("type").GetString();
                    if (nodeType == "start")
                    {
                        startNodeId = node.GetProperty("id").GetString();
                        break;
                    }
                }
                
                if (startNodeId == null)
                {
                    throw new Exception("找不到起始節點");
                }
                
                // 從起始節點開始執行
                await ExecuteNodeRecursively(startNodeId, nodeMap, adjacencyList, execution, inputData);
                
                _loggingService.LogInformation($"工作流程執行完成，執行ID: {execution.Id}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行工作流程時發生錯誤: {ex.Message}");
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                await _context.SaveChangesAsync();
                throw;
            }
        }

        private async Task ProcessWorkflowNodes(JsonElement nodes, JsonElement edges, WorkflowExecution execution, object inputData)
        {
            // 這裡實現流程節點的執行邏輯
            // 根據節點類型執行不同的操作
            foreach (var node in nodes.EnumerateArray())
            {
                var nodeData = node.GetProperty("data");
                var nodeType = nodeData.GetProperty("type").GetString();

                // 創建步驟執行記錄
                var stepExecution = new WorkflowStepExecution
                {
                    WorkflowExecutionId = execution.Id,
                    StepIndex = execution.CurrentStep ?? 0,
                    StepType = nodeType,
                    Status = "Running",
                    StartedAt = DateTime.Now,
                    InputJson = JsonSerializer.Serialize(inputData)
                };

                _context.WorkflowStepExecutions.Add(stepExecution);
                await _context.SaveChangesAsync();

                try
                {
                    // 根據節點類型執行相應操作
                    switch (nodeType)
                    {
                        case "sendWhatsApp":
                            await ExecuteSendWhatsApp(nodeData, inputData);
                            break;
                        case "sendWhatsAppTemplate":
                            await ExecuteSendWhatsAppTemplate(nodeData, inputData);
                            break;
                        case "dbQuery":
                            await ExecuteDbQuery(nodeData, inputData);
                            break;
                        case "callApi":
                            await ExecuteCallApi(nodeData, inputData);
                            break;
                        // 可以添加更多節點類型的處理
                    }

                    stepExecution.Status = "Completed";
                    stepExecution.EndedAt = DateTime.Now;
                }
                catch (Exception ex)
                {
                    stepExecution.Status = "Failed";
                    stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                    stepExecution.EndedAt = DateTime.Now;
                }

                await _context.SaveChangesAsync();
                execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;
            }
        }

        // 按照邊緣順序執行流程節點
        private async Task ProcessWorkflowNodesByEdges(JsonElement nodes, JsonElement edges, WorkflowExecution execution, object inputData)
        {
            try
            {
                // 構建節點映射
                var nodeMap = new Dictionary<string, JsonElement>();
                foreach (var node in nodes.EnumerateArray())
                {
                    nodeMap[node.GetProperty("id").GetString()] = node;
                }

                // 構建邊緣映射
                var edgeMap = new Dictionary<string, List<string>>();
                foreach (var edge in edges.EnumerateArray())
                {
                    var source = edge.GetProperty("source").GetString();
                    var target = edge.GetProperty("target").GetString();
                    
                    if (!edgeMap.ContainsKey(source))
                        edgeMap[source] = new List<string>();
                    edgeMap[source].Add(target);
                }

                // 找到 Start 節點
                string startNodeId = null;
                foreach (var node in nodes.EnumerateArray())
                {
                    var nodeData = node.GetProperty("data");
                    if (nodeData.GetProperty("type").GetString() == "start")
                    {
                        startNodeId = node.GetProperty("id").GetString();
                        break;
                    }
                }

                if (string.IsNullOrEmpty(startNodeId))
                {
                    throw new Exception("Start node not found");
                }

                // 按照流程順序執行節點
                await ExecuteNodeRecursively(startNodeId, nodeMap, edgeMap, execution, inputData);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行流程失敗: {ex.Message}");
                throw;
            }
        }

        // 執行節點遞歸
        private async Task ExecuteNodeRecursively(string nodeId, Dictionary<string, JsonElement> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, object inputData)
        {
            if (!nodeMap.ContainsKey(nodeId)) return;

            var node = nodeMap[nodeId];
            var nodeData = node.GetProperty("data");
            var nodeType = nodeData.GetProperty("type").GetString();

            // 記錄步驟執行
            var stepExec = new WorkflowStepExecution
            {
                WorkflowExecutionId = execution.Id,
                StepIndex = execution.CurrentStep ?? 0,
                StepType = nodeType,
                Status = "Running",
                InputJson = nodeData.GetRawText(),
                StartedAt = DateTime.Now
            };
            _context.WorkflowStepExecutions.Add(stepExec);
            await _context.SaveChangesAsync();

            // 根據節點類型執行相應操作
            switch (nodeType)
            {
                case "start":
                    // Start 節點不需要特殊處理，直接繼續
                    break;
                case "sendWhatsApp":
                    await ExecuteSendWhatsAppWithCompany(nodeData, inputData, execution);
                    break;
                case "sendWhatsAppTemplate":
                    await ExecuteSendWhatsAppTemplateWithCompany(nodeData, inputData, execution);
                    break;
                case "dbQuery":
                    await ExecuteDbQueryWithContext(nodeData, inputData, execution);
                    break;
                case "callApi":
                    await ExecuteCallApiWithContext(nodeData, inputData, execution);
                    break;
                case "sendEForm":
                case "sendeform":
                    await ExecuteSendEFormWithContext(nodeData, inputData, execution);
                    return; // 等待用戶審批表單，不繼續執行下一個節點
                    break;
                case "waitForUserReply":
                case "waitReply": // 支援前端使用的節點類型名稱
                    await ExecuteWaitForUserReply(nodeData, inputData, execution);
                    return; // 等待用戶回覆，不繼續執行下一個節點
                case "end":
                    // End 節點，流程結束
                    execution.Status = "Completed";
                    execution.EndedAt = DateTime.Now;
                    stepExec.Status = "Completed";
                    await _context.SaveChangesAsync();
                    return;
                default:
                    _loggingService.LogWarning($"未處理的節點類型: {nodeType}");
                    break;
            }

            stepExec.Status = "Completed";
            stepExec.EndedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            // 更新執行步驟
            execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;

            // 找到下一個節點
            if (adjacencyList.ContainsKey(nodeId))
            {
                foreach (var nextNodeId in adjacencyList[nodeId])
                {
                    await ExecuteNodeRecursively(nextNodeId, nodeMap, adjacencyList, execution, inputData);
                }
            }
        }

        // 執行等待用戶回覆節點
        private async Task ExecuteWaitForUserReply(JsonElement nodeData, object inputData, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"執行等待用戶回覆節點，執行ID: {execution.Id}");
                
                // 從節點數據中提取配置
                string replyType = "initiator"; // 預設值
                string validationConfig = "{}"; // 預設值
                string message = ""; // 預設值
                
                if (nodeData.TryGetProperty("replyType", out var replyTypeProp))
                {
                    replyType = replyTypeProp.GetString();
                }
                
                if (nodeData.TryGetProperty("validation", out var validationProp))
                {
                    validationConfig = validationProp.GetRawText();
                }
                
                if (nodeData.TryGetProperty("message", out var messageProp))
                {
                    message = messageProp.GetString();
                }
                
                _loggingService.LogInformation($"節點配置 - replyType: {replyType}, message: {message}");
                _loggingService.LogInformation($"驗證配置: {validationConfig}");
                
                // 確定等待的用戶
                string waitingForUser = null;
                if (replyType == "initiator")
                {
                    // 等待流程啟動人
                    if (inputData is WhatsAppMessageData messageData)
                    {
                        waitingForUser = messageData.WaId;
                    }
                }
                else if (replyType == "specified")
                {
                    // 等待指定用戶
                    if (nodeData.TryGetProperty("specifiedUsers", out var specifiedUsersProp))
                    {
                        var specifiedUsers = specifiedUsersProp.GetString();
                        if (!string.IsNullOrEmpty(specifiedUsers))
                        {
                            // 暫時使用第一個指定用戶，後續可以擴展為支援多用戶
                            var userList = specifiedUsers.Split(',').Select(u => u.Trim()).ToList();
                            if (userList.Count > 0)
                            {
                                waitingForUser = userList[0]; // 暫時只支援第一個用戶
                                _loggingService.LogInformation($"指定等待用戶: {waitingForUser}");
                            }
                        }
                    }
                    
                    // 如果沒有指定用戶，使用流程啟動人
                    if (string.IsNullOrEmpty(waitingForUser))
                    {
                        if (inputData is WhatsAppMessageData messageData)
                        {
                            waitingForUser = messageData.WaId;
                        }
                    }
                }
                
                if (string.IsNullOrEmpty(waitingForUser))
                {
                    throw new Exception("無法確定等待的用戶");
                }
                
                // 更新流程執行狀態為等待
                execution.IsWaiting = true;
                execution.WaitingSince = DateTime.Now;
                execution.CurrentWaitingStep = execution.CurrentStep;
                execution.WaitingForUser = waitingForUser;
                execution.Status = "Waiting";
                execution.LastUserActivity = DateTime.Now;
                
                // 更新用戶會話
                await _userSessionService.UpdateUserSessionWorkflowAsync(waitingForUser, execution.Id);
                
                // 保存驗證配置到步驟執行記錄
                var stepExecution = await _context.WorkflowStepExecutions
                    .FirstOrDefaultAsync(s => s.WorkflowExecutionId == execution.Id && s.StepIndex == execution.CurrentStep);
                
                if (stepExecution != null)
                {
                    stepExecution.IsWaiting = true;
                    stepExecution.WaitingForUser = waitingForUser;
                    stepExecution.ValidationConfig = validationConfig;
                    stepExecution.Status = "Waiting";
                    stepExecution.EndedAt = DateTime.Now;
                    stepExecution.OutputJson = JsonSerializer.Serialize(new { message = "Waiting for user reply" });
                }
                
                await _context.SaveChangesAsync();
                
                // 發送提示訊息給用戶（如果有的話）
                if (!string.IsNullOrEmpty(message))
                {
                    var workflow = await _context.WorkflowDefinitions.FindAsync(execution.WorkflowDefinitionId);
                    var company = await _context.Companies.FindAsync(workflow.CompanyId);
                    
                    if (company != null)
                    {
                        await SendWhatsAppMessage(company, waitingForUser, message);
                    }
                }
                
                _loggingService.LogInformation($"流程已進入等待狀態，等待用戶: {waitingForUser}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行等待用戶回覆節點時發生錯誤: {ex.Message}");
                throw;
            }
        }

        private async Task ExecuteSendWhatsApp(JsonElement nodeData, object inputData)
        {
            // 使用統一的 WhatsAppWorkflowService
            var message = nodeData.GetProperty("message").GetString();
            var to = nodeData.GetProperty("to").GetString();

            // 注意：這個方法需要 WorkflowExecution 參數，但在這個上下文中沒有
            // 建議使用 ExecuteSendWhatsAppWithCompany 方法
            _loggingService.LogWarning($"ExecuteSendWhatsApp: 需要 WorkflowExecution 上下文");
        }

        private async Task ExecuteSendWhatsAppTemplate(JsonElement nodeData, object inputData)
        {
            // 使用統一的 WhatsAppWorkflowService
            var templateName = nodeData.GetProperty("templateName").GetString();
            var to = nodeData.GetProperty("to").GetString();

            // 注意：這個方法需要 WorkflowExecution 參數，但在這個上下文中沒有
            // 建議使用 ExecuteSendWhatsAppTemplateWithCompany 方法
            _loggingService.LogWarning($"ExecuteSendWhatsAppTemplate: 需要 WorkflowExecution 上下文");
        }

        private async Task ExecuteDbQuery(JsonElement nodeData, object inputData)
        {
            // 實現數據庫查詢的邏輯
            var sql = nodeData.GetProperty("sql").GetString();

            // 這裡執行 SQL 查詢
        }

        private async Task ExecuteCallApi(JsonElement nodeData, object inputData)
        {
            // 實現 API 調用的邏輯
            var url = nodeData.GetProperty("url").GetString();

            // 這裡調用外部 API
        }

        // 使用公司配置執行 WhatsApp 訊息發送
        private async Task ExecuteSendWhatsAppWithCompany(JsonElement nodeData, object inputData, WorkflowExecution execution)
        {
            try
            {
                // 從節點數據中提取訊息內容
                var message = nodeData.GetProperty("message").GetString();
                var to = nodeData.GetProperty("to").GetString();

                // 如果 to 是動態值，從 inputData 中提取
                if (to == "{{waId}}" && inputData is WhatsAppMessageData messageData)
                {
                    to = messageData.WaId;
                }

                // 使用統一的 WhatsAppWorkflowService
                await _whatsAppWorkflowService.SendWhatsAppMessageAsync(to, message, execution, _context);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行 WhatsApp 訊息發送失敗: {ex.Message}");
                throw;
            }
        }

        // 使用公司配置執行 WhatsApp 模板發送
        private async Task ExecuteSendWhatsAppTemplateWithCompany(JsonElement nodeData, object inputData, WorkflowExecution execution)
        {
            try
            {
                // 從節點數據中提取模板信息
                var templateName = nodeData.GetProperty("templateName").GetString();
                var to = nodeData.GetProperty("to").GetString();

                // 如果 to 是動態值，從 inputData 中提取
                if (to == "{{waId}}" && inputData is WhatsAppMessageData messageData)
                {
                    to = messageData.WaId;
                }

                // 使用統一的 WhatsAppWorkflowService
                await _whatsAppWorkflowService.SendWhatsAppTemplateMessageAsync(to, templateName, execution, _context);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行 WhatsApp 模板發送失敗: {ex.Message}");
                throw;
            }
        }

        // 使用資料庫上下文執行查詢
        private async Task ExecuteDbQueryWithContext(JsonElement nodeData, object inputData, WorkflowExecution execution)
        {
            try
            {
                var sql = nodeData.GetProperty("sql").GetString();
                
                // 這裡可以執行 SQL 查詢並將結果存儲到執行記錄中
                // 由於安全考慮，這裡只記錄查詢，實際執行需要額外的安全措施
                _loggingService.LogInformation($"執行 SQL 查詢: {sql}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行資料庫查詢失敗: {ex.Message}");
                throw;
            }
        }

        // 使用上下文執行 API 調用
        private async Task ExecuteCallApiWithContext(JsonElement nodeData, object inputData, WorkflowExecution execution)
        {
            try
            {
                var url = nodeData.GetProperty("url").GetString();
                var method = nodeData.GetProperty("method").GetString();
                
                // 這裡可以執行 API 調用
                _loggingService.LogInformation($"執行 API 調用: {method} {url}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行 API 調用失敗: {ex.Message}");
                throw;
            }
        }

        // 使用上下文執行 Send eForm
        private async Task ExecuteSendEFormWithContext(JsonElement nodeData, object inputData, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== ExecuteSendEFormWithContext 開始 ===");
                _loggingService.LogInformation($"執行 ID: {execution.Id}");
                _loggingService.LogInformation($"節點數據: {nodeData}");
                
                // 獲取節點數據
                var formName = nodeData.GetProperty("formName").GetString();
                var formId = nodeData.GetProperty("formId").GetString();
                var to = nodeData.GetProperty("to").GetString();

                _loggingService.LogInformation($"formName: {formName}");
                _loggingService.LogInformation($"formId: {formId}");
                _loggingService.LogInformation($"to: {to}");

                if (string.IsNullOrEmpty(formName) || string.IsNullOrEmpty(to))
                {
                    throw new Exception("表單名稱和收件人電話號碼不能為空");
                }

                // 1. 查詢原始表單定義
                _loggingService.LogInformation($"開始查詢表單定義: {formName}");
                var eFormDefinition = await _context.eFormDefinitions
                    .FirstOrDefaultAsync(f => f.Name == formName && f.Status == "A");

                if (eFormDefinition == null)
                {
                    _loggingService.LogInformation($"找不到表單定義: {formName}，嘗試查詢所有表單...");
                    var allForms = await _context.eFormDefinitions.ToListAsync();
                    _loggingService.LogInformation($"資料庫中的所有表單:");
                    foreach (var form in allForms)
                    {
                        _loggingService.LogInformation($"- ID: {form.Id}, Name: {form.Name}, Status: {form.Status}");
                    }
                    throw new Exception($"找不到表單定義: {formName}");
                }

                _loggingService.LogInformation($"找到表單定義，ID: {eFormDefinition.Id}");

                // 2. 查詢當前流程實例中的用戶回覆記錄
                _loggingService.LogInformation($"開始查詢用戶回覆記錄，執行 ID: {execution.Id}");
                var userMessages = await _context.MessageValidations
                    .Where(m => m.WorkflowExecutionId == execution.Id && m.IsValid)
                    .OrderBy(m => m.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {userMessages.Count} 條有效用戶回覆記錄");
                foreach (var msg in userMessages)
                {
                    _loggingService.LogInformation($"- 用戶訊息: {msg.UserMessage}, 時間: {msg.CreatedAt}");
                }

                // 3. 獲取公司ID
                var workflowDefinition = await _context.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == execution.WorkflowDefinitionId);

                if (workflowDefinition == null)
                {
                    throw new Exception("找不到工作流程定義");
                }

                var companyId = workflowDefinition.CompanyId;
                _loggingService.LogInformation($"使用公司ID: {companyId}");

                // 4. 創建表單實例記錄
                var eFormInstance = new EFormInstance
                {
                    Id = Guid.NewGuid(),
                    EFormDefinitionId = eFormDefinition.Id,
                    WorkflowExecutionId = execution.Id,
                    WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                    CompanyId = companyId,
                    InstanceName = $"{formName}_{execution.Id}_{DateTime.Now:yyyyMMddHHmmss}",
                    OriginalHtmlCode = eFormDefinition.HtmlCode,
                    Status = "Pending",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // 5. 如果有用戶回覆，使用 AI 填充表單
                if (userMessages.Any())
                {
                    var latestMessage = userMessages.Last();
                    eFormInstance.UserMessage = latestMessage.UserMessage;

                    _loggingService.LogInformation($"用戶消息: {latestMessage.UserMessage}");

                    // 調用 AI 填充表單
                    var filledHtml = await FillFormWithAI(eFormDefinition.HtmlCode, latestMessage.UserMessage);
                    eFormInstance.FilledHtmlCode = filledHtml;

                    _loggingService.LogInformation($"AI 填充完成，HTML 長度: {filledHtml?.Length ?? 0}");
                }
                else
                {
                    // 沒有用戶回覆，使用原始表單
                    eFormInstance.FilledHtmlCode = eFormDefinition.HtmlCode;
                    _loggingService.LogInformation("沒有用戶回覆，使用原始表單");
                }

                // 6. 生成表單 URL
                var formUrl = $"/eform-instance/{eFormInstance.Id}";
                eFormInstance.FormUrl = formUrl;

                // 7. 保存到數據庫
                _loggingService.LogInformation($"準備保存表單實例到資料庫...");
                _context.EFormInstances.Add(eFormInstance);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"表單實例已創建，ID: {eFormInstance.Id}");

                // 8. 發送 WhatsApp 消息（包含表單鏈接）
                await SendEFormWhatsAppMessage(to, formName, formUrl, execution);

                _loggingService.LogInformation($"=== ExecuteSendEFormWithContext 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 eForm 失敗: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                throw;
            }
        }

        private async Task<string> FillFormWithAI(string originalHtml, string userMessage)
        {
            try
            {
                _loggingService.LogInformation($"=== FillFormWithAI 開始 ===");
                _loggingService.LogInformation($"開始時間: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"原始 HTML 長度: {originalHtml?.Length ?? 0}");
                _loggingService.LogInformation($"用戶消息: {userMessage}");

                // 從配置中獲取 AI 提示詞
                var formAnalysisPrompt = _configuration["XAI:FormAnalysisPrompt"] ?? "";

                // 構建 AI 提示詞
                var prompt = $@"{formAnalysisPrompt}

HTML 表單內容：
{originalHtml}

用戶輸入消息：
{userMessage}

請分析用戶輸入，並將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。";

                // 獲取 X.AI 配置
                var apiKey = _configuration["XAI:ApiKey"];
                var model = _configuration["XAI:Model"] ?? "grok-3";
                var temperature = _configuration.GetValue<double>("XAI:Temperature", 0.8);
                var maxTokens = _configuration.GetValue<int>("XAI:MaxTokens", 15000);

                _loggingService.LogDebug($"XAI 配置 - Model: {model}, Temperature: {temperature}, MaxTokens: {maxTokens}");
                _loggingService.LogDebug($"API Key 前10字符: {apiKey?.Substring(0, Math.Min(10, apiKey?.Length ?? 0))}...");

                if (string.IsNullOrEmpty(apiKey))
                {
                    _loggingService.LogWarning("X.AI API Key 未配置，返回原始 HTML");
                    return originalHtml;
                }

                // 構建 AI 請求
                var aiRequest = new
                {
                    messages = new[]
                    {
                        new { role = "user", content = prompt }
                    },
                    model = model,
                    temperature = temperature,
                    max_tokens = maxTokens
                };

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromMinutes(5);
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

                var jsonContent = System.Text.Json.JsonSerializer.Serialize(aiRequest);
                var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

                _loggingService.LogInformation($"發送 AI 請求...");
                _loggingService.LogDebug($"請求 URL: https://api.x.ai/v1/chat/completions");
                _loggingService.LogDebug($"請求內容長度: {jsonContent.Length}");
                _loggingService.LogDebug($"提示詞長度: {prompt.Length}");
                _loggingService.LogDebug($"HTTP 客戶端超時設置: {httpClient.Timeout.TotalMinutes} 分鐘");

                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                
                try
                {
                    var response = await httpClient.PostAsync("https://api.x.ai/v1/chat/completions", content);
                    stopwatch.Stop();
                    
                    _loggingService.LogInformation($"AI 請求完成，耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogDebug($"響應狀態碼: {response.StatusCode}");
                    
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _loggingService.LogDebug($"響應內容長度: {responseContent.Length}");
                    
                    if (responseContent.Length > 0)
                    {
                        _loggingService.LogDebug($"響應內容前500字符: {responseContent.Substring(0, Math.Min(500, responseContent.Length))}");
                    }

                    if (!response.IsSuccessStatusCode)
                    {
                        _loggingService.LogError($"AI 請求失敗: {response.StatusCode} - {responseContent}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 錯誤 ===");
                        return originalHtml;
                    }

                    // 解析 AI 響應
                    try
                    {
                        var aiResponse = System.Text.Json.JsonSerializer.Deserialize<JsonElement>(responseContent);
                        var filledHtml = aiResponse.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

                        _loggingService.LogInformation($"AI 填充完成，新 HTML 長度: {filledHtml?.Length ?? 0}");
                        _loggingService.LogInformation("=== FillFormWithAI 成功完成 ===");
                        return filledHtml;
                    }
                    catch (Exception parseEx)
                    {
                        _loggingService.LogError($"AI 響應解析失敗: {parseEx.Message}");
                        _loggingService.LogDebug($"原始響應內容: {responseContent}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - 響應解析錯誤 ===");
                        return originalHtml;
                    }
                }
                catch (TaskCanceledException timeoutEx)
                {
                    stopwatch.Stop();
                    _loggingService.LogError($"AI 請求超時: {timeoutEx.Message}");
                    _loggingService.LogDebug($"請求耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogDebug($"超時設置: {httpClient.Timeout.TotalMinutes} 分鐘");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - 請求超時 ===");
                    return originalHtml;
                }
                catch (HttpRequestException httpEx)
                {
                    stopwatch.Stop();
                    _loggingService.LogError($"AI 請求 HTTP 錯誤: {httpEx.Message}");
                    _loggingService.LogDebug($"請求耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 請求錯誤 ===");
                    return originalHtml;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"AI 填充發生未預期錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤類型: {ex.GetType().Name}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                _loggingService.LogWarning("=== FillFormWithAI 失敗 - 未預期錯誤 ===");
                return originalHtml; // 失敗時返回原始 HTML
            }
        }

        private async Task SendEFormWhatsAppMessage(string to, string formName, string formUrl, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== SendEFormWhatsAppMessage 開始 ===");
                _loggingService.LogInformation($"收件人: {to}");
                _loggingService.LogInformation($"表單名稱: {formName}");
                _loggingService.LogInformation($"表單URL: {formUrl}");

                // 獲取公司 WhatsApp 配置
                var workflowDefinition = await _context.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == execution.WorkflowDefinitionId);

                if (workflowDefinition == null)
                {
                    throw new Exception("找不到工作流程定義");
                }

                var company = await _context.Companies
                    .FirstOrDefaultAsync(c => c.Id == workflowDefinition.CompanyId);

                if (company == null)
                {
                    throw new Exception("找不到公司配置");
                }

                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    throw new Exception("公司未配置 WhatsApp API");
                }

                // 格式化電話號碼
                var formattedTo = to;
                if (!to.StartsWith("852"))
                {
                    if (to.StartsWith("0"))
                    {
                        to = to.Substring(1);
                    }
                    formattedTo = "852" + to;
                }

                // 構建消息內容
                var message = $"您有一個新的表單需要填寫：\n\n表單名稱：{formName}\n\n請點擊以下鏈接填寫表單：\n{formUrl}\n\n填寫完成後請點擊表單頂部的「批准」或「拒絕」按鈕。";

                // 發送 WhatsApp 消息
                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = formattedTo,
                    type = "text",
                    text = new { body = message }
                };

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var jsonPayload = System.Text.Json.JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"WhatsApp API 請求失敗: {response.StatusCode} - {responseContent}");
                }

                _loggingService.LogInformation($"成功發送 eForm WhatsApp 消息到 {formattedTo}");
                _loggingService.LogInformation($"=== SendEFormWhatsAppMessage 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 eForm WhatsApp 消息失敗: {ex.Message}");
                throw;
            }
        }

        // 發送 WhatsApp 選單
        private async Task SendWhatsAppMenu(Company company, string waId)
        {
            await SendWhatsAppMenu(company, waId, _context);
        }

        // 新的重載版本，接受 context 參數
        private async Task SendWhatsAppMenu(Company company, string waId, PurpleRiceDbContext context)
        {
            try
            {
                _loggingService.LogInformation($"開始發送選單給用戶 {waId}，公司: {company.Name}");
                
                // 獲取當前公司的所有啟用的 webhook 流程
                var webhookWorkflows = await context.WorkflowDefinitions  // 使用傳入的 context
                    .Where(w => w.Status == "啟用" && 
                               w.CompanyId == company.Id && 
                               w.Json.Contains("\"activationType\":\"webhook\""))
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {webhookWorkflows.Count} 個啟用的 webhook 流程");

                if (!webhookWorkflows.Any())
                {
                    // 如果沒有 webhook 流程，發送預設消息
                    _loggingService.LogInformation("沒有找到啟用的 webhook 流程，發送預設消息");
                    await SendWhatsAppMessage(company, waId, "歡迎使用我們的服務！\n\n目前沒有可用的功能，請聯繫管理員。");
                    return;
                }

                // 構建選單消息
                var menuText = "歡迎使用我們的服務！\n\n請選擇您需要的功能：";
                _loggingService.LogInformation($"選單文字: {menuText}");
                
                // 準備按鈕選項
                var buttons = new List<object>();
                for (int i = 0; i < webhookWorkflows.Count && i < 3; i++) // WhatsApp 最多支援 3 個按鈕
                {
                    var workflow = webhookWorkflows[i];
                    var workflowName = workflow.Name ?? "未命名流程";
                    var buttonId = $"option_{i + 1}";
                    var buttonTitle = $"{i + 1}. {workflowName}";
                    
                    buttons.Add(new
                    {
                        type = "reply",
                        reply = new
                        {
                            id = buttonId,
                            title = buttonTitle
                        }
                    });
                    
                    _loggingService.LogInformation($"添加按鈕 {i + 1}: {buttonTitle} (ID: {buttonId})");
                }

                _loggingService.LogInformation($"發送選單給 {waId}，包含 {webhookWorkflows.Count} 個流程，{buttons.Count} 個按鈕");
                await SendWhatsAppButtonMessage(company, waId, menuText, buttons);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送選單失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
            }
        }

        // 根據用戶選擇獲取對應流程
        private async Task<WorkflowDefinition> GetWorkflowByUserChoice(string userChoice, Guid companyId)
        {
            return await GetWorkflowByUserChoice(userChoice, companyId, _context);
        }

        // 新的重載版本，接受 context 參數
        private async Task<WorkflowDefinition> GetWorkflowByUserChoice(string userChoice, Guid companyId, PurpleRiceDbContext context)
        {
            try
            {
                _loggingService.LogInformation($"開始查找流程，用戶選擇: '{userChoice}'，公司ID: {companyId}");
                
                // 獲取所有啟用的 webhook 流程
                var webhookWorkflows = await context.WorkflowDefinitions  // 使用傳入的 context
                    .Where(w => w.Status == "啟用" && 
                               w.CompanyId == companyId && 
                               w.Json.Contains("\"activationType\":\"webhook\""))
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {webhookWorkflows.Count} 個啟用的 webhook 流程");

                if (!webhookWorkflows.Any())
                {
                    _loggingService.LogInformation("沒有找到任何啟用的 webhook 流程");
                    return null;
                }

                // 列出所有可用的流程
                for (int i = 0; i < webhookWorkflows.Count; i++)
                {
                    var workflow = webhookWorkflows[i];
                    _loggingService.LogInformation($"流程 {i + 1}: {workflow.Name} (ID: {workflow.Id})");
                }

                // 嘗試解析用戶選擇的數字
                if (int.TryParse(userChoice, out int choiceNumber))
                {
                    _loggingService.LogInformation($"用戶選擇解析為數字: {choiceNumber}");
                    if (choiceNumber >= 1 && choiceNumber <= webhookWorkflows.Count)
                    {
                        var selectedWorkflow = webhookWorkflows[choiceNumber - 1];
                        _loggingService.LogInformation($"用戶選擇了流程: {selectedWorkflow.Name} (ID: {selectedWorkflow.Id})");
                        return selectedWorkflow;
                    }
                    else
                    {
                        _loggingService.LogInformation($"數字選擇超出範圍: {choiceNumber}，可用範圍: 1-{webhookWorkflows.Count}");
                    }
                }
                else
                {
                    _loggingService.LogInformation($"用戶選擇不是有效數字: '{userChoice}'");
                }

                // 如果數字無效，嘗試根據流程名稱匹配
                _loggingService.LogInformation("嘗試根據流程名稱匹配...");
                foreach (var workflow in webhookWorkflows)
                {
                    var workflowName = workflow.Name ?? "未命名流程";
                    _loggingService.LogInformation($"檢查流程名稱: '{workflowName}' 是否包含用戶選擇: '{userChoice}'");
                    if (userChoice.Contains(workflowName, StringComparison.OrdinalIgnoreCase))
                    {
                        _loggingService.LogInformation($"根據名稱匹配到流程: {workflowName} (ID: {workflow.Id})");
                        return workflow;
                    }
                }

                _loggingService.LogInformation($"未找到對應的流程，用戶選擇: '{userChoice}'");
                return null;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程失敗: {ex.Message}");
                return null;
            }
        }

        // 從流程 JSON 中提取流程名稱
        private string GetWorkflowNameFromJson(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                
                // 嘗試從節點數據中獲取流程名稱
                if (root.TryGetProperty("nodes", out var nodes))
                {
                    foreach (var node in nodes.EnumerateArray())
                    {
                        if (node.TryGetProperty("data", out var data))
                        {
                            if (data.TryGetProperty("type", out var type) && type.GetString() == "start")
                            {
                                if (data.TryGetProperty("taskName", out var taskName))
                                {
                                    return taskName.GetString();
                                }
                            }
                        }
                    }
                }
                
                return "未命名流程";
            }
            catch
            {
                return "未命名流程";
            }
        }

        // 發送 WhatsApp 消息
        private async Task SendWhatsAppMessage(Company company, string waId, string message)
        {
            try
            {
                _loggingService.LogInformation($"開始發送 WhatsApp 消息");
                _loggingService.LogInformation($"公司: {company.Name}");
                _loggingService.LogInformation($"waId: '{waId}'");
                _loggingService.LogInformation($"消息: '{message}'");
                _loggingService.LogInformation($"API Key: {(string.IsNullOrEmpty(company.WA_API_Key) ? "空" : "已設置")}");
                _loggingService.LogInformation($"Phone No ID: {(string.IsNullOrEmpty(company.WA_PhoneNo_ID) ? "空" : company.WA_PhoneNo_ID)}");

                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    _loggingService.LogInformation("公司 WhatsApp 配置不完整");
                    return;
                }

                if (string.IsNullOrEmpty(waId))
                {
                    _loggingService.LogError("錯誤: waId 為空");
                    return;
                }

                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "text",
                    text = new { body = message }
                };

                _loggingService.LogInformation($"請求 URL: {url}");
                _loggingService.LogInformation($"請求 Payload: {System.Text.Json.JsonSerializer.Serialize(payload)}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"響應狀態碼: {response.StatusCode}");
                _loggingService.LogInformation($"響應內容: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"發送 WhatsApp 消息失敗: {response.StatusCode} - {responseContent}");
                }
                else
                {
                    _loggingService.LogInformation($"成功發送消息到 {waId}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 消息失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
            }
        }

        // 發送 WhatsApp Button 消息
        private async Task SendWhatsAppButtonMessage(Company company, string waId, string message, List<object> buttons)
        {
            try
            {
                _loggingService.LogInformation($"開始發送 WhatsApp Button 消息");
                _loggingService.LogInformation($"公司: {company.Name}");
                _loggingService.LogInformation($"waId: '{waId}'");
                _loggingService.LogInformation($"消息: '{message}'");
                _loggingService.LogInformation($"按鈕數量: {buttons.Count}");

                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    _loggingService.LogInformation("公司 WhatsApp 配置不完整");
                    return;
                }

                if (string.IsNullOrEmpty(waId))
                {
                    _loggingService.LogError("錯誤: waId 為空");
                    return;
                }

                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "interactive",
                    interactive = new
                    {
                        type = "button",
                        body = new { text = message },
                        action = new
                        {
                            buttons = buttons.ToArray()
                        }
                    }
                };

                _loggingService.LogInformation($"請求 URL: {url}");
                _loggingService.LogInformation($"請求 Payload: {System.Text.Json.JsonSerializer.Serialize(payload)}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"響應狀態碼: {response.StatusCode}");
                _loggingService.LogInformation($"響應內容: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"發送 WhatsApp Button 消息失敗: {response.StatusCode} - {responseContent}");
                    // 如果 Button 發送失敗，回退到純文字
                    _loggingService.LogInformation("回退到純文字消息");
                    await SendWhatsAppMessage(company, waId, message + "\n\n回覆數字選擇功能，或輸入「選單」重新顯示選單。");
                }
                else
                {
                    _loggingService.LogInformation($"成功發送 Button 選單到 {waId}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp Button 消息失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                // 如果 Button 發送失敗，回退到純文字
                _loggingService.LogInformation("回退到純文字消息");
                await SendWhatsAppMessage(company, waId, message + "\n\n回覆數字選擇功能，或輸入「選單」重新顯示選單。");
            }
        }

        // 發送 WhatsApp 模板訊息
        private async Task SendWhatsAppTemplateMessage(Company company, string waId, string templateId)
        {
            try
            {
                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    _loggingService.LogInformation("公司 WhatsApp 配置不完整");
                    return;
                }

                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "template",
                    template = new
                    {
                        name = templateId,
                        language = new
                        {
                            code = "zh_TW"
                        }
                    }
                };

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"發送 WhatsApp 模板訊息失敗: {response.StatusCode} - {responseContent}");
                }
                else
                {
                    _loggingService.LogInformation($"成功發送模板訊息到 {waId}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 模板訊息失敗: {ex.Message}");
            }
        }

        // 新增消息去重方法
        private async Task<bool> IsMessageAlreadyProcessed(string messageId)
        {
            lock (_lockObject)
            {
                // 清理過期的消息記錄
                var expiredKeys = _processedMessages
                    .Where(kvp => DateTime.Now - kvp.Value > _messageExpiry)
                    .Select(kvp => kvp.Key)
                    .ToList();
                
                foreach (var key in expiredKeys)
                {
                    _processedMessages.Remove(key);
                }
                
                return _processedMessages.ContainsKey(messageId);
            }
        }

        // 標記消息為已處理
        private async Task MarkMessageAsProcessed(string messageId)
        {
            lock (_lockObject)
            {
                _processedMessages[messageId] = DateTime.Now;
            }
            _loggingService.LogInformation($"消息 {messageId} 已標記為已處理，時間: {DateTime.Now}");
        }

        // 取消消息標記為已處理
        private async Task UnmarkMessageAsProcessed(string messageId)
        {
            lock (_lockObject)
            {
                _processedMessages.Remove(messageId);
            }
            _loggingService.LogInformation($"消息 {messageId} 的已處理標記已移除");
        }
    }
}