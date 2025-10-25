using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System.Linq;
using System.Text.Json;

namespace PurpleRice.Services.WebhookServices
{
    /// <summary>
    /// WhatsApp 菜單設置類
    /// 用於管理 WhatsApp 菜單的自定義文字和默認值
    /// </summary>
    public class WhatsAppMenuSettings
    {
        public string WelcomeMessage { get; set; }
        public string NoFunctionMessage { get; set; }
        public string MenuTitle { get; set; }
        public string MenuFooter { get; set; }
        public string MenuButton { get; set; }
        public string SectionTitle { get; set; }
        public string DefaultOptionDescription { get; set; }
        public string InputErrorMessage { get; set; }
        public string FallbackMessage { get; set; }
        public string SystemErrorMessage { get; set; }

        /// <summary>
        /// 獲取默認的 WhatsApp 菜單設置
        /// </summary>
        public static WhatsAppMenuSettings GetDefaults()
        {
            return new WhatsAppMenuSettings
            {
                WelcomeMessage = "歡迎使用我們的服務！\n\n請選擇您需要的功能：",
                NoFunctionMessage = "歡迎使用我們的服務！\n\n目前沒有可用的功能，請聯繫管理員。",
                MenuTitle = "服務選單",
                MenuFooter = "請選擇您需要的服務",
                MenuButton = "查看選項",
                SectionTitle = "服務選項",
                DefaultOptionDescription = "點擊選擇此服務",
                InputErrorMessage = "輸入不正確，請重新輸入。",
                FallbackMessage = "\n\n回覆數字選擇功能，或輸入「選單」重新顯示選單。",
                SystemErrorMessage = "系統錯誤：無法找到 QR Code 節點配置。"
            };
        }

        /// <summary>
        /// 從公司設置創建菜單設置，如果公司設置為空則使用默認值
        /// </summary>
        public static WhatsAppMenuSettings FromCompany(Company company)
        {
            var defaults = GetDefaults();
            return new WhatsAppMenuSettings
            {
                WelcomeMessage = company.WA_WelcomeMessage ?? defaults.WelcomeMessage,
                NoFunctionMessage = company.WA_NoFunctionMessage ?? defaults.NoFunctionMessage,
                MenuTitle = company.WA_MenuTitle ?? defaults.MenuTitle,
                MenuFooter = company.WA_MenuFooter ?? defaults.MenuFooter,
                MenuButton = company.WA_MenuButton ?? defaults.MenuButton,
                SectionTitle = company.WA_SectionTitle ?? defaults.SectionTitle,
                DefaultOptionDescription = company.WA_DefaultOptionDescription ?? defaults.DefaultOptionDescription,
                InputErrorMessage = company.WA_InputErrorMessage ?? defaults.InputErrorMessage,
                FallbackMessage = company.WA_FallbackMessage ?? defaults.FallbackMessage,
                SystemErrorMessage = company.WA_SystemErrorMessage ?? defaults.SystemErrorMessage
            };
        }
    }

    /// <summary>
    /// Webhook 消息處理服務
    /// 負責處理 Meta Webhook 的消息提取和業務邏輯處理
    /// </summary>
    public class WebhookMessageProcessingService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly UserSessionService _userSessionService;
        private readonly IMessageValidator _messageValidator;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly WorkflowEngine _workflowEngine;
        private readonly WebhookDuplicateService _duplicateService;
        private readonly LoggingService _loggingService;
        private readonly IServiceProvider _serviceProvider;

        public WebhookMessageProcessingService(
            PurpleRiceDbContext context,
            UserSessionService userSessionService,
            IMessageValidator messageValidator,
            WhatsAppWorkflowService whatsAppWorkflowService,
            WorkflowEngine workflowEngine,
            WebhookDuplicateService duplicateService,
            Func<string, LoggingService> loggingServiceFactory,
            IServiceProvider serviceProvider)
        {
            _context = context;
            _userSessionService = userSessionService;
            _messageValidator = messageValidator;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _workflowEngine = workflowEngine;
            _duplicateService = duplicateService;
            _loggingService = loggingServiceFactory("WebhookMessageProcessingService");
            _serviceProvider = serviceProvider;
        }

        /// <summary>
        /// 處理 Webhook 消息
        /// </summary>
        /// <param name="companyToken">公司 Token</param>
        /// <param name="payload">Webhook 數據</param>
        /// <returns>處理結果</returns>
        public async Task<object> ProcessWebhookAsync(string companyToken, object payload)
        {
            WhatsAppMessageData? messageData = null;
            
            try
            {
                // 記錄原始 payload
                var json = payload.ToString();
                _loggingService.LogInformation($"=== 開始處理 Webhook ===");
                _loggingService.LogInformation($"時間: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"Payload 長度: {json.Length}");
                _loggingService.LogInformation($"公司 Token: {companyToken}");
                _loggingService.LogInformation($"Payload: {json}");
                _loggingService.LogInformation($"=================================");

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // 提取 WhatsApp 訊息數據
                messageData = await ExtractWhatsAppMessageData(root);
                if (messageData == null)
                {
                    _loggingService.LogInformation("無法提取有效的訊息數據或檢測到狀態更新，跳過處理");
                    return new { success = true, message = "No valid message data" };
                }

                // 檢查消息去重
                if (await _duplicateService.IsMessageAlreadyProcessed(messageData.MessageId))
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
                await _duplicateService.MarkMessageAsProcessed(messageData.MessageId);
                
                // 處理用戶消息
                return await ProcessUserMessage(company, messageData);
            }
            catch (Exception ex)
            {
                // 如果處理失敗，可能需要取消消息標記
                if (messageData != null)
                {
                    await _duplicateService.UnmarkMessageAsProcessed(messageData.MessageId);
                }
                _loggingService.LogError($"Webhook 處理失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                return new { success = false, error = ex.Message };
            }
        }

        /// <summary>
        /// 提取 WhatsApp 訊息數據
        /// </summary>
        /// <param name="root">JSON 根元素</param>
        /// <returns>消息數據</returns>
        private async Task<WhatsAppMessageData> ExtractWhatsAppMessageData(JsonElement root)
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
                    _loggingService.LogInformation("檢測到狀態更新，處理消息狀態變更");
                    // ✅ 處理狀態更新（sent, delivered, read, failed）
                    await ProcessStatusUpdateAsync(statuses);
                    return null; // 返回 null 表示這是狀態更新，已處理完成
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
                string messageType = "text";
                string interactiveType = "";
                string mediaId = "";
                
                if (value.TryGetProperty("messages", out var messages))
                {
                    _loggingService.LogInformation($"找到訊息數據，數量: {messages.GetArrayLength()}");
                    var message = messages[0];
                    messageId = message.GetProperty("id").GetString();
                    _loggingService.LogInformation($"提取到訊息ID: {messageId}");
                    
                    // 檢查訊息類型
                    messageType = message.GetProperty("type").GetString();
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
                            interactiveType = interactive.GetProperty("type").GetString();
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
                    else if (messageType == "image")
                    {
                        _loggingService.LogInformation($"檢測到圖片訊息，將檢查是否需要 QR Code 掃描");
                        // 預設為空，如果有 caption 則會被覆蓋
                        messageText = "";
                        
                        // 提取媒體 ID 和 caption
                        if (message.TryGetProperty("image", out var imageData))
                        {
                            if (imageData.TryGetProperty("id", out var mediaIdProperty))
                            {
                                mediaId = mediaIdProperty.GetString();
                                _loggingService.LogInformation($"提取到媒體 ID: {mediaId}");
                            }
                            
                            // ✅ 提取圖片的文字說明（caption）
                            if (imageData.TryGetProperty("caption", out var captionProperty))
                            {
                                messageText = captionProperty.GetString();
                                _loggingService.LogInformation($"✅ 提取到圖片文字說明（caption）: '{messageText}'");
                            }
                            else
                            {
                                _loggingService.LogInformation($"圖片消息沒有文字說明（caption）");
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
                    Timestamp = DateTime.UtcNow,
                    Source = "MetaWebhook",
                    MessageType = messageType,
                    InteractiveType = interactiveType,
                    MediaId = mediaId
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

        /// <summary>
        /// 處理用戶消息
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="messageData">消息數據</param>
        /// <returns>處理結果</returns>
        private async Task<object> ProcessUserMessage(Company company, WhatsAppMessageData messageData)
        {
            // 臨時調試：檢查特定用戶的等待流程
            _loggingService.LogInformation($"=== 調試：檢查用戶 {messageData.WaId} 的等待流程 ===");
            var userWaitingWorkflows = await _context.WorkflowExecutions
                .Where(w => w.WaitingForUser == messageData.WaId && w.IsWaiting && w.Status == "Waiting")
                .ToListAsync();
            _loggingService.LogInformation($"用戶 {messageData.WaId} 的等待流程數量: {userWaitingWorkflows.Count}");
            foreach (var wf in userWaitingWorkflows)
            {
                _loggingService.LogInformation($"用戶等待流程: ID={wf.Id}, 狀態={wf.Status}, 是否等待={wf.IsWaiting}, 等待時間={wf.WaitingSince}");
            }
            
            // 強制調試：直接查詢所有 WorkflowExecutions 表
            _loggingService.LogInformation($"=== 強制調試：直接查詢 WorkflowExecutions 表 ===");
            var allExecutions = await _context.WorkflowExecutions
                .Where(w => w.WaitingForUser != null)
                .ToListAsync();
            _loggingService.LogInformation($"所有有 WaitingForUser 的流程數量: {allExecutions.Count}");
            foreach (var exec in allExecutions)
            {
                _loggingService.LogInformation($"流程: ID={exec.Id}, WaitingForUser={exec.WaitingForUser}, Status={exec.Status}, IsWaiting={exec.IsWaiting}, WaitingSince={exec.WaitingSince}");
            }
            
            // 檢查用戶是否有正在等待的流程
            _loggingService.LogInformation($"檢查用戶 {messageData.WaId} 是否有正在等待的流程...");
            var currentWorkflow = await _userSessionService.GetCurrentUserWorkflowAsync(messageData.WaId);
            if (currentWorkflow != null && currentWorkflow.IsWaiting)
            {
                _loggingService.LogInformation($"用戶 {messageData.WaId} 有正在等待的流程，狀態: {currentWorkflow.Status}");
                
                // 確保 WorkflowDefinition 已加載
                if (currentWorkflow.WorkflowDefinition == null)
                {
                    _loggingService.LogInformation($"重新加載 WorkflowDefinition，執行 ID: {currentWorkflow.Id}");
                    currentWorkflow = await _context.WorkflowExecutions
                        .Include(e => e.WorkflowDefinition)
                        .FirstOrDefaultAsync(e => e.Id == currentWorkflow.Id);
                }
                
                // 檢查是否是 QR Code 等待流程
                if (currentWorkflow.Status == "WaitingForQRCode" && messageData.MessageType == "image")
                {
                    _loggingService.LogInformation($"檢測到 QR Code 等待流程，處理圖片訊息");
                    await HandleQRCodeWorkflowReply(company, currentWorkflow, messageData);
                    return new { success = true, message = "QR Code workflow reply processed" };
                }
                else
                {
                    _loggingService.LogInformation($"處理一般等待流程回覆");
                    await HandleWaitingWorkflowReply(company, currentWorkflow, messageData);
                    return new { success = true, message = "Waiting workflow reply processed" };
                }
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
                await SendWhatsAppMenu(company, messageData.WaId);
                return new { success = true, message = "Menu sent" };
            }

            // 根據用戶選擇啟動對應流程
            _loggingService.LogInformation($"用戶選擇: '{userMessage}'，公司ID: {company.Id}");
            var selectedWorkflow = await GetWorkflowByUserChoice(userMessage, company.Id);
            if (selectedWorkflow == null)
            {
                // 如果沒有找到對應流程，重新發送選單
                _loggingService.LogInformation($"未找到對應流程，重新發送選單");
                await SendWhatsAppMenu(company, messageData.WaId);
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
                StartedAt = DateTime.UtcNow,
                CreatedBy = "MetaWebhook",
                InitiatedBy = messageData.WaId // 記錄觸發的 WhatsApp 用戶電話號碼
            };

            _context.WorkflowExecutions.Add(execution);
            await _context.SaveChangesAsync();

            // 更新用戶會話
            await _userSessionService.UpdateUserSessionWorkflowAsync(messageData.WaId, execution.Id);

            // 執行流程，傳入用戶ID
            await _workflowEngine.ExecuteWorkflowAsync(execution, messageData.WaId);

            return new { 
                success = true, 
                executionId = execution.Id,
                message = "Workflow started successfully" 
            };
        }

        /// <summary>
        /// 處理等待流程的回覆
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <param name="messageData">消息數據</param>
        private async Task HandleWaitingWorkflowReply(Company company, WorkflowExecution execution, WhatsAppMessageData messageData)
        {
            try
            {
                _loggingService.LogInformation($"處理等待流程回覆，執行ID: {execution.Id}，步驟: {execution.CurrentWaitingStep}");
                _loggingService.LogInformation($"消息類型: {messageData.MessageType}, MediaId: {messageData.MediaId}");
                
                // 如果是圖片消息，下載並保存圖片
                string savedImagePath = null;
                if (messageData.MessageType == "image" && !string.IsNullOrEmpty(messageData.MediaId))
                {
                    try
                    {
                        _loggingService.LogInformation($"檢測到圖片消息，開始下載並保存圖片");
                        var imageBytes = await DownloadWhatsAppImage(company, messageData.MediaId);
                        
                        if (imageBytes != null && imageBytes.Length > 0)
                        {
                            savedImagePath = await SaveWaitReplyImageAsync(execution.Id, imageBytes);
                            _loggingService.LogInformation($"圖片已保存到: {savedImagePath}");
                        }
                        else
                        {
                            _loggingService.LogWarning($"圖片下載失敗或為空");
                        }
                    }
                    catch (Exception imgEx)
                    {
                        _loggingService.LogError($"下載或保存圖片時發生錯誤: {imgEx.Message}");
                        // 繼續處理，不因圖片保存失敗而中斷流程
                    }
                }
                
                // 獲取步驟執行記錄中的驗證配置（先查詢以獲取正確的 StepIndex）
                var stepExecution = await _context.WorkflowStepExecutions
                    .FirstOrDefaultAsync(s => s.WorkflowExecutionId == execution.Id && s.IsWaiting);
                
                // ✅ 使用 stepExecution.StepIndex 而不是 execution.CurrentWaitingStep
                int stepIndex = stepExecution?.StepIndex ?? execution.CurrentWaitingStep ?? 0;
                
                _loggingService.LogInformation($"📊 保存消息驗證記錄 - StepIndex: {stepIndex}");

                // 記錄驗證（包含媒體信息）
                var validation = new MessageValidation
                {
                    WorkflowExecutionId = execution.Id,
                    StepIndex = stepIndex, // ✅ 使用實際的 StepIndex
                    UserWaId = messageData.WaId,
                    UserMessage = messageData.MessageText,
                    MessageType = messageData.MessageType, // ✅ 保存消息類型
                    MediaId = messageData.MediaId, // ✅ 保存媒體 ID
                    MediaUrl = savedImagePath, // ✅ 保存圖片本地路徑
                    CreatedAt = DateTime.UtcNow
                };

                // 執行驗證
                var validationResult = await _messageValidator.ValidateMessageAsync(
                    messageData.MessageText, execution, execution.CurrentWaitingStep ?? 0);

                validation.IsValid = validationResult.IsValid;
                validation.ErrorMessage = validationResult.ErrorMessage;
                validation.ValidatorType = "default";

                if (validationResult.IsValid)
                {
                    validation.ProcessedData = JsonSerializer.Serialize(validationResult.ProcessedData);
                }

                _context.MessageValidations.Add(validation);
                await _context.SaveChangesAsync();

                if (!validationResult.IsValid)
                {
                    // 驗證失敗，發送錯誤訊息並保持等待狀態
                    var menuSettings = WhatsAppMenuSettings.FromCompany(company);
                    var errorMessage = validationResult.ErrorMessage ?? menuSettings.InputErrorMessage;
                    await SendWhatsAppMessage(company, messageData.WaId, errorMessage);
                    _loggingService.LogInformation($"驗證失敗，保持等待狀態: {errorMessage}");
                    return;
                }

                // 驗證通過，繼續執行流程
                _loggingService.LogInformation($"驗證通過，繼續執行流程");
                execution.IsWaiting = false;
                execution.WaitingSince = null;
                execution.LastUserActivity = DateTime.UtcNow;
                execution.Status = "Running";

                // ✅ 重要：不要在這裡更新 stepExecution.IsWaiting 和 Status
                // 讓 WorkflowEngine 的 ContinueFromWaitReply 方法來查找並更新
                // 否則引擎無法找到當前等待的步驟（因為 IsWaiting 已經是 false）
                
                await _context.SaveChangesAsync();

                // 繼續執行流程 - 直接調用 WorkflowEngine
                // WorkflowEngine 會查找 IsWaiting == true 的步驟並標記為 Completed
                _loggingService.LogInformation($"調用 WorkflowEngine.ContinueWorkflowFromWaitReply（IsWaiting 仍為 true，由引擎更新）...");
                await _workflowEngine.ContinueWorkflowFromWaitReply(execution, messageData);
                _loggingService.LogInformation($"WorkflowEngine.ContinueWorkflowFromWaitReply 調用完成");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理等待流程回覆時發生錯誤: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                // 不向用戶發送錯誤消息，只記錄到日誌
            }
        }





        /// <summary>
        /// 檢查並繼續等待表單審批的流程
        /// </summary>
        /// <param name="formInstanceId">表單實例ID</param>
        /// <param name="newStatus">新的表單狀態</param>
        public async Task ContinueWorkflowAfterFormApprovalAsync(Guid formInstanceId, string newStatus)
        {
            try
            {
                _loggingService.LogInformation($"=== 檢查表單審批後的流程繼續 ===");
                _loggingService.LogInformation($"表單實例ID: {formInstanceId}");
                _loggingService.LogInformation($"新狀態: {newStatus}");
                _loggingService.LogInformation($"調用時間: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}");

                // 查找對應的流程執行記錄
                var formInstance = await _context.EFormInstances
                    .Include(f => f.WorkflowExecution)
                    .ThenInclude(w => w.WorkflowDefinition)
                    .FirstOrDefaultAsync(f => f.Id == formInstanceId);

                if (formInstance == null)
                {
                    _loggingService.LogWarning($"找不到表單實例: {formInstanceId}");
                    return;
                }

                var execution = formInstance.WorkflowExecution;
                if (execution == null)
                {
                    _loggingService.LogWarning($"表單實例 {formInstanceId} 沒有關聯的流程執行記錄");
                    return;
                }

                // 確保 WorkflowDefinition 已加載
                if (execution.WorkflowDefinition == null)
                {
                    _loggingService.LogWarning($"流程執行記錄 {execution.Id} 沒有加載 WorkflowDefinition，嘗試重新加載");
                    execution = await _context.WorkflowExecutions
                        .Include(w => w.WorkflowDefinition)
                        .FirstOrDefaultAsync(w => w.Id == execution.Id);
                    
                    if (execution?.WorkflowDefinition == null)
                    {
                        _loggingService.LogError($"無法加載流程執行記錄 {execution?.Id} 的 WorkflowDefinition");
                        return;
                    }
                }

                _loggingService.LogInformation($"找到流程執行記錄，ID: {execution.Id}");
                _loggingService.LogInformation($"當前流程狀態: {execution.Status}");
                _loggingService.LogInformation($"流程定義名稱: {execution.WorkflowDefinition.Name}");

                // 檢查流程是否在等待表單審批
                if (execution.Status != "WaitingForFormApproval")
                {
                    _loggingService.LogInformation($"流程不在等待表單審批狀態，當前狀態: {execution.Status}");
                    return;
                }

                // 更新表單狀態
                formInstance.Status = newStatus;
                formInstance.UpdatedAt = DateTime.UtcNow;

                // 將審批結果寫入流程變量
                await SetApprovalResultToProcessVariable(execution, newStatus);

                // 重要：不要提前改變流程狀態，讓 ContinueWorkflowFromWaitReply 來處理
                // 這樣可以確保狀態檢查正確
                _loggingService.LogInformation($"表單狀態已更新為: {newStatus}");
                _loggingService.LogInformation($"當前流程狀態: {execution.Status}");

                // 保存表單狀態更改
                await _context.SaveChangesAsync();

                // 繼續執行流程
                _loggingService.LogInformation($"開始繼續執行流程...");
                await _workflowEngine.ContinueWorkflowFromWaitReply(execution, null);

                _loggingService.LogInformation($"=== 表單審批後流程繼續完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"繼續表單審批後流程失敗: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// 將審批結果寫入流程變量
        /// </summary>
        /// <param name="execution">工作流執行記錄</param>
        /// <param name="approvalStatus">審批狀態 (Approved/Rejected)</param>
        private async Task SetApprovalResultToProcessVariable(WorkflowExecution execution, string approvalStatus)
        {
            try
            {
                _loggingService.LogInformation($"=== 開始設置審批結果到流程變量 ===");
                _loggingService.LogInformation($"工作流執行ID: {execution.Id}");
                _loggingService.LogInformation($"審批狀態: {approvalStatus}");

                // 解析工作流定義
                if (string.IsNullOrEmpty(execution.WorkflowDefinition?.Json))
                {
                    _loggingService.LogWarning("工作流定義 JSON 為空，無法解析 e-Form 節點配置");
                    return;
                }

                var workflowJson = JsonSerializer.Deserialize<Dictionary<string, object>>(execution.WorkflowDefinition.Json);
                if (workflowJson == null || !workflowJson.ContainsKey("nodes"))
                {
                    _loggingService.LogWarning("工作流定義中沒有找到 nodes 數據");
                    return;
                }

                // 解析節點數據
                var nodesJson = JsonSerializer.Serialize(workflowJson["nodes"]);
                var nodes = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(nodesJson);
                
                if (nodes == null)
                {
                    _loggingService.LogWarning("無法解析工作流節點數據");
                    return;
                }

                // 查找 e-Form 節點
                _loggingService.LogInformation($"開始查找 e-Form 節點，節點數量: {nodes.Count}");
                
                // 先記錄所有節點的類型，用於調試
                foreach (var node in nodes)
                {
                    var nodeType = node.ContainsKey("type") ? node["type"]?.ToString() : "null";
                    _loggingService.LogInformation($"節點頂層類型: {nodeType}");
                    
                    if (node.ContainsKey("data"))
                    {
                        var nodeDataObj = node["data"];
                        _loggingService.LogInformation($"節點 data 對象類型: {nodeDataObj?.GetType().Name}");
                        _loggingService.LogInformation($"節點 data 對象內容: {JsonSerializer.Serialize(nodeDataObj)}");
                        
                        if (nodeDataObj is Dictionary<string, object> data)
                        {
                            var dataType = data.ContainsKey("type") ? data["type"]?.ToString() : "null";
                            _loggingService.LogInformation($"節點 data.type: {dataType}");
                            
                            if (data.ContainsKey("approvalResultVariable"))
                            {
                                var approvalVar = data["approvalResultVariable"]?.ToString();
                                _loggingService.LogInformation($"找到審批結果變量配置: {approvalVar}");
                            }
                        }
                        else if (nodeDataObj is JsonElement jsonElement)
                        {
                            _loggingService.LogInformation($"節點 data 是 JsonElement，嘗試解析...");
                            if (jsonElement.TryGetProperty("type", out var typeProperty))
                            {
                                var dataType = typeProperty.GetString();
                                _loggingService.LogInformation($"節點 data.type (JsonElement): {dataType}");
                                
                                if (jsonElement.TryGetProperty("approvalResultVariable", out var approvalVarProperty))
                                {
                                    var approvalVar = approvalVarProperty.GetString();
                                    _loggingService.LogInformation($"找到審批結果變量配置 (JsonElement): {approvalVar}");
                                }
                            }
                        }
                    }
                }
                
                var eFormNode = nodes.FirstOrDefault(node => 
                {
                    // 檢查 data.type 字段
                    if (node.ContainsKey("data"))
                    {
                        var nodeDataObj = node["data"];
                        
                        if (nodeDataObj is Dictionary<string, object> data)
                        {
                            var nodeType = data.ContainsKey("type") ? data["type"]?.ToString() : "null";
                            _loggingService.LogInformation($"檢查節點 data.type (Dictionary): {nodeType}");
                            return data.ContainsKey("type") && 
                                   (data["type"]?.ToString() == "sendEForm" || 
                                    data["type"]?.ToString() == "sendeform");
                        }
                        else if (nodeDataObj is JsonElement jsonElement)
                        {
                            if (jsonElement.TryGetProperty("type", out var typeProperty))
                            {
                                var nodeType = typeProperty.GetString();
                                _loggingService.LogInformation($"檢查節點 data.type (JsonElement): {nodeType}");
                                return nodeType == "sendEForm" || nodeType == "sendeform";
                            }
                        }
                    }
                    
                    // 也檢查頂層 type 字段（以防萬一）
                    var topLevelType = node.ContainsKey("type") ? node["type"]?.ToString() : "null";
                    _loggingService.LogInformation($"檢查節點頂層 type: {topLevelType}");
                    return node.ContainsKey("type") && 
                           (node["type"]?.ToString() == "sendEForm" || 
                            node["type"]?.ToString() == "sendeform");
                });

                if (eFormNode == null)
                {
                    _loggingService.LogWarning("工作流中沒有找到 e-Form 節點");
                    return;
                }

                // 獲取 e-Form 節點的數據
                var dataObj = eFormNode["data"];
                Dictionary<string, object> nodeData = null;
                
                if (dataObj is Dictionary<string, object> dictData)
                {
                    nodeData = dictData;
                }
                else if (dataObj is JsonElement jsonElement)
                {
                    // 將 JsonElement 轉換為 Dictionary
                    nodeData = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonElement.GetRawText());
                }
                
                if (nodeData == null)
                {
                    _loggingService.LogWarning("e-Form 節點數據為空或無法解析");
                    _loggingService.LogInformation($"e-Form 節點 data 對象類型: {dataObj?.GetType().Name}");
                    return;
                }

                _loggingService.LogInformation($"e-Form 節點數據: {JsonSerializer.Serialize(nodeData)}");

                // 檢查是否配置了審批結果變量
                if (!nodeData.ContainsKey("approvalResultVariable") || 
                    string.IsNullOrEmpty(nodeData["approvalResultVariable"]?.ToString()))
                {
                    _loggingService.LogInformation("e-Form 節點沒有配置審批結果變量，跳過設置");
                    _loggingService.LogInformation($"可用的節點數據字段: {string.Join(", ", nodeData.Keys)}");
                    return;
                }

                var approvalResultVariable = nodeData["approvalResultVariable"].ToString();
                _loggingService.LogInformation($"找到審批結果變量配置: {approvalResultVariable}");

                // 獲取 ProcessVariableService
                using var scope = _serviceProvider.CreateScope();
                var processVariableService = scope.ServiceProvider.GetRequiredService<IProcessVariableService>();

                // 設置審批結果到流程變量
                await processVariableService.SetVariableValueAsync(
                    execution.Id,
                    approvalResultVariable,
                    approvalStatus,
                    setBy: "System",
                    sourceType: "EFormApproval",
                    sourceReference: execution.Id.ToString()
                );

                _loggingService.LogInformation($"審批結果已成功寫入流程變量: {approvalResultVariable} = {approvalStatus}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"設置審批結果到流程變量失敗: {ex.Message}", ex);
                // 不拋出異常，避免影響主流程
            }
        }

        /// <summary>
        /// 發送 WhatsApp 選單 (使用 List Messages 支援多於3個選項)
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="waId">用戶 WhatsApp ID</param>
        private async Task SendWhatsAppMenu(Company company, string waId)
        {
            try
            {
                _loggingService.LogInformation($"開始發送選單給用戶 {waId}，公司: {company.Name}");
                
                // 獲取 WhatsApp 菜單設置
                var menuSettings = WhatsAppMenuSettings.FromCompany(company);
                
                // 獲取當前公司的所有啟用的 webhook 流程
                var allEnabledWorkflows = await _context.WorkflowDefinitions
                    .Where(w => w.Status == "Enabled" && w.CompanyId == company.Id)
                    .ToListAsync();
                
                // 過濾出 webhook 流程
                _loggingService.LogInformation($"所有啟用流程數量: {allEnabledWorkflows.Count}");
                foreach (var workflow in allEnabledWorkflows)
                {
                    _loggingService.LogInformation($"流程: {workflow.Name} (ID: {workflow.Id})");
                    _loggingService.LogInformation($"JSON 包含 activationType: {workflow.Json.Contains("\"activationType\":\"webhook\"")}");
                    _loggingService.LogInformation($"JSON 片段: {workflow.Json.Substring(0, Math.Min(200, workflow.Json.Length))}...");
                }
                
                var webhookWorkflows = allEnabledWorkflows.Where(w => 
                    w.Json.Contains("\"activationType\":\"webhook\"")).ToList();

                _loggingService.LogInformation($"找到 {webhookWorkflows.Count} 個啟用的 webhook 流程");

                if (!webhookWorkflows.Any())
                {
                    // 如果沒有 webhook 流程，發送預設消息
                    _loggingService.LogInformation("沒有找到啟用的 webhook 流程，發送預設消息");
                    await SendWhatsAppMessage(company, waId, menuSettings.NoFunctionMessage);
                    return;
                }

                // 構建選單消息
                _loggingService.LogInformation($"選單文字: {menuSettings.WelcomeMessage}");
                
                // 使用 List Messages 支援多達 10 個選項
                await SendWhatsAppListMessage(company, waId, menuSettings.WelcomeMessage, webhookWorkflows, menuSettings);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送選單失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// 根據用戶選擇獲取對應流程
        /// </summary>
        /// <param name="userChoice">用戶選擇</param>
        /// <param name="companyId">公司 ID</param>
        /// <returns>工作流程定義</returns>
        private async Task<WorkflowDefinition> GetWorkflowByUserChoice(string userChoice, Guid companyId)
        {
            try
            {
                _loggingService.LogInformation($"開始查找流程，用戶選擇: '{userChoice}'，公司ID: {companyId}");
                
                // 獲取所有啟用的 webhook 流程
                var allEnabledWorkflows = await _context.WorkflowDefinitions
                    .Where(w => w.Status == "Enabled" && w.CompanyId == companyId)
                    .ToListAsync();
                
                // 過濾出 webhook 流程
                var webhookWorkflows = allEnabledWorkflows.Where(w => 
                    w.Json.Contains("\"activationType\":\"webhook\"")).ToList();

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

        /// <summary>
        /// 發送 WhatsApp 消息
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="waId">用戶 WhatsApp ID</param>
        /// <param name="message">消息內容</param>
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

                var url = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "text",
                    text = new { body = message }
                };

                _loggingService.LogInformation($"請求 URL: {url}");
                _loggingService.LogInformation($"請求 Payload: {JsonSerializer.Serialize(payload)}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                
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

        /// <summary>
        /// 發送 WhatsApp Button 消息
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="waId">用戶 WhatsApp ID</param>
        /// <param name="message">消息內容</param>
        /// <param name="buttons">按鈕列表</param>
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

                var url = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
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
                _loggingService.LogInformation($"請求 Payload: {JsonSerializer.Serialize(payload)}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"響應狀態碼: {response.StatusCode}");
                _loggingService.LogInformation($"響應內容: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"發送 WhatsApp Button 消息失敗: {response.StatusCode} - {responseContent}");
                    // 如果 Button 發送失敗，回退到純文字
                    _loggingService.LogInformation("回退到純文字消息");
                    var menuSettings = WhatsAppMenuSettings.FromCompany(company);
                    await SendWhatsAppMessage(company, waId, message + menuSettings.FallbackMessage);
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
                var menuSettings = WhatsAppMenuSettings.FromCompany(company);
                await SendWhatsAppMessage(company, waId, message + menuSettings.FallbackMessage);
            }
        }

        /// <summary>
        /// 發送 WhatsApp List 消息 (支援多達 10 個選項)
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="waId">用戶 WhatsApp ID</param>
        /// <param name="message">消息內容</param>
        /// <param name="workflows">工作流程列表</param>
        /// <param name="menuSettings">菜單設置</param>
        private async Task SendWhatsAppListMessage(Company company, string waId, string message, List<WorkflowDefinition> workflows, WhatsAppMenuSettings menuSettings)
        {
            try
            {
                _loggingService.LogInformation($"開始發送 WhatsApp List 消息");
                _loggingService.LogInformation($"收件人: {waId}");
                _loggingService.LogInformation($"消息內容: {message}");
                _loggingService.LogInformation($"工作流程數量: {workflows.Count}");

                var url = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";

                // 將工作流程分組到不同的區段中，每個區段最多 10 個選項
                var sections = new List<object>();
                var currentSection = new List<object>();
                var sectionTitle = menuSettings.SectionTitle;
                var sectionIndex = 1;

                for (int i = 0; i < workflows.Count && i < 10; i++) // WhatsApp List 最多支援 10 個選項
                {
                    var workflow = workflows[i];
                    var workflowName = workflow.Name ?? "未命名流程";
                    var optionId = $"option_{i + 1}";
                    var optionTitle = $"{i + 1}. {workflowName}";
                    var optionDescription = workflow.Description ?? menuSettings.DefaultOptionDescription;

                    // WhatsApp 選項標題限制最多 24 個字符
                    if (optionTitle.Length > 24)
                    {
                        optionTitle = optionTitle.Substring(0, 21) + "...";
                    }

                    // WhatsApp 選項描述限制最多 72 個字符
                    if (optionDescription.Length > 72)
                    {
                        optionDescription = optionDescription.Substring(0, 69) + "...";
                    }

                    currentSection.Add(new
                    {
                        id = optionId,
                        title = optionTitle,
                        description = optionDescription
                    });

                    _loggingService.LogInformation($"添加選項 {i + 1}: {optionTitle} (ID: {optionId})");
                }

                // 添加當前區段
                if (currentSection.Any())
                {
                    sections.Add(new
                    {
                        title = sectionTitle,
                        rows = currentSection.ToArray()
                    });
                }

                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "interactive",
                    interactive = new
                    {
                        type = "list",
                        header = new
                        {
                            type = "text",
                            text = menuSettings.MenuTitle
                        },
                        body = new { text = message },
                        footer = new { text = menuSettings.MenuFooter },
                        action = new
                        {
                            button = menuSettings.MenuButton,
                            sections = sections.ToArray()
                        }
                    }
                };

                _loggingService.LogInformation($"請求 URL: {url}");
                _loggingService.LogInformation($"請求 Payload: {JsonSerializer.Serialize(payload)}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"響應狀態碼: {response.StatusCode}");
                _loggingService.LogInformation($"響應內容: {responseContent}");

                if (!response.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"發送 WhatsApp List 消息失敗: {response.StatusCode} - {responseContent}");
                    // 如果 List 發送失敗，回退到純文字
                    _loggingService.LogInformation("回退到純文字消息");
                    await SendWhatsAppMessage(company, waId, message + menuSettings.FallbackMessage);
                }
                else
                {
                    _loggingService.LogInformation($"成功發送 List 選單到 {waId}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp List 消息失敗: {ex.Message}");
                _loggingService.LogDebug($"堆疊追蹤: {ex.StackTrace}");
                // 如果 List 發送失敗，回退到純文字
                _loggingService.LogInformation("回退到純文字消息");
                await SendWhatsAppMessage(company, waId, message + menuSettings.FallbackMessage);
            }
        }

        /// <summary>
        /// 處理 QR Code 等待流程的圖片回覆
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="execution">流程執行記錄</param>
        /// <param name="messageData">消息數據</param>
        private async Task HandleQRCodeWorkflowReply(Company company, WorkflowExecution execution, WhatsAppMessageData messageData)
        {
            try
            {
                _loggingService.LogInformation($"=== 處理 QR Code 等待流程回覆 ===");
                _loggingService.LogInformation($"執行ID: {execution.Id}");
                _loggingService.LogInformation($"訊息ID: {messageData.MessageId}");
                _loggingService.LogInformation($"媒體ID: {messageData.MediaId}");
                _loggingService.LogInformation($"訊息類型: {messageData.MessageType}");
                
                // 獲取 WhatsApp 菜單設置
                var menuSettings = WhatsAppMenuSettings.FromCompany(company);
                
                // 從工作流程定義中獲取 waitForQRCode 節點信息
                var nodeInfo = await GetWaitForQRCodeNodeInfo(execution);
                if (nodeInfo == null)
                {
                    _loggingService.LogError("無法找到 waitForQRCode 節點");
                    await SendWhatsAppMessage(company, messageData.WaId, menuSettings.SystemErrorMessage);
                    return;
                }
                
                _loggingService.LogInformation($"找到 waitForQRCode 節點: {nodeInfo.NodeId}");
                
                // 檢查是否有媒體 ID
                if (string.IsNullOrEmpty(messageData.MediaId))
                {
                    _loggingService.LogError("沒有找到媒體 ID");
                    var errorMessage = !string.IsNullOrEmpty(nodeInfo.QrCodeErrorMessage) 
                        ? nodeInfo.QrCodeErrorMessage 
                        : "無法獲取圖片信息，請重新上傳。";
                    await SendWhatsAppMessage(company, messageData.WaId, errorMessage);
                    return;
                }
                
                // 從 WhatsApp 下載圖片
                var imageBytes = await DownloadWhatsAppImage(company, messageData.MediaId);
                if (imageBytes == null || imageBytes.Length == 0)
                {
                    _loggingService.LogError("無法下載 WhatsApp 圖片");
                    var errorMessage = !string.IsNullOrEmpty(nodeInfo.QrCodeErrorMessage) 
                        ? nodeInfo.QrCodeErrorMessage 
                        : "無法處理您上傳的圖片，請重新上傳。";
                    await SendWhatsAppMessage(company, messageData.WaId, errorMessage);
                    return;
                }
                
                _loggingService.LogInformation($"成功下載圖片，大小: {imageBytes.Length} bytes");
                
                // 調用 QRCodeController 的處理邏輯
                using var scope = _serviceProvider.CreateScope();
                var qrCodeService = scope.ServiceProvider.GetRequiredService<IQRCodeService>();
                var workflowExecutionService = scope.ServiceProvider.GetRequiredService<IWorkflowExecutionService>();
                
                // 掃描 QR Code 並保存圖片
                string qrCodeValue = null;
                string savedImagePath = null;
                try
                {
                    var (scannedValue, imagePath) = await qrCodeService.ScanQRCodeAndSaveImageWithResultAsync(imageBytes, execution.Id);
                    qrCodeValue = scannedValue;
                    savedImagePath = imagePath;
                    _loggingService.LogInformation($"圖片已保存: {savedImagePath}");
                }
                catch (Exception scanEx)
                {
                    _loggingService.LogError($"掃描和保存 QR Code 圖片時發生錯誤: {scanEx.Message}");
                    // 即使保存失敗，也要嘗試掃描
                    qrCodeValue = await qrCodeService.ScanQRCodeAsync(imageBytes);
                }
                
                // ✅ 先查詢當前等待的步驟執行記錄以獲取正確的 StepIndex
                var stepExecution = await _context.WorkflowStepExecutions
                    .FirstOrDefaultAsync(s => s.WorkflowExecutionId == execution.Id && s.IsWaiting);
                
                int stepIndex = stepExecution?.StepIndex ?? execution.CurrentWaitingStep ?? 0;
                _loggingService.LogInformation($"📊 保存 QR Code 驗證記錄 - StepIndex: {stepIndex}");
                
                // ✅ 記錄到 message_validations 表（無論是否掃描成功）
                var validation = new MessageValidation
                {
                    WorkflowExecutionId = execution.Id,
                    StepIndex = stepIndex, // ✅ 使用實際的 StepIndex
                    UserWaId = messageData.WaId,
                    UserMessage = qrCodeValue ?? "", // QR Code 掃描結果
                    MessageType = messageData.MessageType, // "image"
                    MediaId = messageData.MediaId,
                    MediaUrl = savedImagePath, // 圖片保存路徑
                    IsValid = !string.IsNullOrEmpty(qrCodeValue), // 掃描成功則有效
                    ErrorMessage = string.IsNullOrEmpty(qrCodeValue) ? "無法識別 QR Code" : null,
                    ValidatorType = "qrcode",
                    ProcessedData = !string.IsNullOrEmpty(qrCodeValue) 
                        ? System.Text.Json.JsonSerializer.Serialize(new { 
                            qrCodeValue, 
                            savedImagePath, 
                            caption = messageData.MessageText // ✅ 保存圖片的文字說明
                        }) 
                        : System.Text.Json.JsonSerializer.Serialize(new { 
                            savedImagePath, 
                            caption = messageData.MessageText // ✅ 即使掃描失敗也保存 caption
                        }),
                    CreatedAt = DateTime.UtcNow
                };
                
                _context.MessageValidations.Add(validation);
                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"✅ QR Code 回覆已記錄到 message_validations，IsValid: {validation.IsValid}");
                
                if (string.IsNullOrEmpty(qrCodeValue))
                {
                    _loggingService.LogWarning("無法從圖片中掃描到 QR Code");
                    var scanErrorMessage = !string.IsNullOrEmpty(nodeInfo.QrCodeErrorMessage) 
                        ? nodeInfo.QrCodeErrorMessage 
                        : "無法識別圖片中的 QR Code，請確保圖片清晰且包含有效的 QR Code。";
                    await SendWhatsAppMessage(company, messageData.WaId, scanErrorMessage);
                    return;
                }
                
                _loggingService.LogInformation($"成功掃描 QR Code: {qrCodeValue}");
                
                // ✅ 更新步驟執行記錄狀態為 Completed（stepExecution 已在上面查詢過）
                if (stepExecution != null)
                {
                    stepExecution.IsWaiting = false;
                    stepExecution.Status = "Completed";
                    stepExecution.EndedAt = DateTime.UtcNow;
                    _loggingService.LogInformation($"✅ 更新 waitForQRCode 步驟狀態為 Completed，步驟索引: {stepExecution.StepIndex}");
                }
                else
                {
                    _loggingService.LogWarning($"⚠️ 找不到 waitForQRCode 的等待步驟執行記錄");
                }
                
                // 更新流程執行狀態
                execution.IsWaiting = false;
                execution.WaitingSince = null;
                execution.LastUserActivity = DateTime.UtcNow;
                execution.Status = "Running";
                
                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"✅ 流程執行狀態已更新為 Running");
                
                // 處理 QR Code 輸入
                var result = await workflowExecutionService.ProcessQRCodeInputAsync(execution.Id, nodeInfo.NodeId, imageBytes, qrCodeValue);
                if (result)
                {
                    _loggingService.LogInformation($"QR Code 處理成功，繼續執行流程");
                    var successMessage = !string.IsNullOrEmpty(nodeInfo.QrCodeSuccessMessage) 
                        ? nodeInfo.QrCodeSuccessMessage 
                        : "QR Code 掃描成功！流程將繼續執行。";
                    await SendWhatsAppMessage(company, messageData.WaId, successMessage);
                    
                    // 繼續執行流程
                    await _workflowEngine.ContinueWorkflowFromWaitReply(execution, messageData);
                }
                else
                {
                    _loggingService.LogError("QR Code 處理失敗");
                    var errorMessage = !string.IsNullOrEmpty(nodeInfo.QrCodeErrorMessage) 
                        ? nodeInfo.QrCodeErrorMessage 
                        : "QR Code 處理失敗，請重新上傳。";
                    await SendWhatsAppMessage(company, messageData.WaId, errorMessage);
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 QR Code 等待流程回覆時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                await SendWhatsAppMessage(company, messageData.WaId, "處理您的 QR Code 時發生錯誤，請稍後再試。");
            }
        }

        /// <summary>
        /// 從工作流程定義中獲取 waitForQRCode 節點 ID
        /// </summary>
        /// <param name="execution">流程執行記錄</param>
        /// <returns>節點 ID</returns>
        private async Task<QRCodeNodeInfo> GetWaitForQRCodeNodeInfo(WorkflowExecution execution)
        {
            try
            {
                if (execution.WorkflowDefinition == null || string.IsNullOrEmpty(execution.WorkflowDefinition.Json))
                {
                    return null;
                }
                
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var flowData = JsonSerializer.Deserialize<WorkflowGraph>(execution.WorkflowDefinition.Json, options);
                
                if (flowData?.Nodes != null)
                {
                    var waitForQRCodeNode = flowData.Nodes.FirstOrDefault(n => 
                        n.Data?.Type == "waitForQRCode" || n.Data?.Type == "waitforqrcode");
                    
                    if (waitForQRCodeNode != null)
                    {
                        return new QRCodeNodeInfo
                        {
                            NodeId = waitForQRCodeNode.Id,
                            QrCodeSuccessMessage = waitForQRCodeNode.Data?.QrCodeSuccessMessage,
                            QrCodeErrorMessage = waitForQRCodeNode.Data?.QrCodeErrorMessage
                        };
                    }
                }
                
                return null;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 waitForQRCode 節點信息時發生錯誤: {ex.Message}");
                return null;
            }
        }
        
        private class QRCodeNodeInfo
        {
            public string NodeId { get; set; }
            public string QrCodeSuccessMessage { get; set; }
            public string QrCodeErrorMessage { get; set; }
        }

        /// <summary>
        /// 從 WhatsApp 下載圖片
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="messageId">訊息 ID</param>
        /// <returns>圖片字節數組</returns>
        private async Task<byte[]> DownloadWhatsAppImage(Company company, string messageId)
        {
            try
            {
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                // 獲取媒體 URL - 使用正確的 WhatsApp Business API 端點
                var mediaUrl = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{messageId}";
                _loggingService.LogInformation($"嘗試獲取媒體 URL: {mediaUrl}");
                
                var response = await httpClient.GetAsync(mediaUrl);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"媒體 API 回應狀態: {response.StatusCode}");
                _loggingService.LogInformation($"媒體 API 回應內容: {responseContent}");
                
                if (!response.IsSuccessStatusCode)
                {
                    _loggingService.LogError($"獲取媒體 URL 失敗: {response.StatusCode}, 內容: {responseContent}");
                    return null;
                }
                
                var mediaInfo = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                if (mediaInfo.TryGetProperty("url", out var urlProperty))
                {
                    var imageUrl = urlProperty.GetString();
                    _loggingService.LogInformation($"獲取到圖片 URL: {imageUrl}");
                    
                    // 下載圖片
                    var imageResponse = await httpClient.GetAsync(imageUrl);
                    if (imageResponse.IsSuccessStatusCode)
                    {
                        var imageBytes = await imageResponse.Content.ReadAsByteArrayAsync();
                        _loggingService.LogInformation($"成功下載圖片，大小: {imageBytes.Length} bytes");
                        return imageBytes;
                    }
                    else
                    {
                        _loggingService.LogError($"下載圖片失敗: {imageResponse.StatusCode}");
                    }
                }
                else
                {
                    _loggingService.LogError($"媒體回應中沒有找到 URL 屬性");
                }
                
                return null;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"下載 WhatsApp 圖片時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                return null;
            }
        }

        /// <summary>
        /// 保存 waitReply 節點的圖片到 Uploads\Whatsapp_Images\{executionId} 目錄
        /// </summary>
        /// <param name="executionId">工作流程執行 ID</param>
        /// <param name="imageData">圖片數據</param>
        /// <returns>保存的圖片路徑</returns>
        private async Task<string> SaveWaitReplyImageAsync(int executionId, byte[] imageData)
        {
            _loggingService.LogInformation($"開始保存 waitReply 圖片，執行ID: {executionId}");
            
            try
            {
                // 創建目錄結構：Uploads\Whatsapp_Images\{executionId}
                if (executionId <= 0)
                {
                    throw new ArgumentException("ExecutionId must be greater than 0", nameof(executionId));
                }
                
                string directoryName = executionId.ToString();
                var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Images", directoryName);
                _loggingService.LogInformation($"目標目錄: {uploadsPath}");
                
                if (!Directory.Exists(uploadsPath))
                {
                    Directory.CreateDirectory(uploadsPath);
                    _loggingService.LogInformation($"已創建目錄: {uploadsPath}");
                }
                else
                {
                    _loggingService.LogInformation($"目錄已存在: {uploadsPath}");
                }

                // 生成文件名：使用時間戳和 GUID 確保唯一性
                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                var guid = Guid.NewGuid().ToString("N").Substring(0, 8); // 取前8位
                var fileName = $"reply_image_{timestamp}_{guid}.jpg";
                
                var filePath = Path.Combine(uploadsPath, fileName);
                _loggingService.LogInformation($"目標文件路徑: {filePath}");

                // 保存圖片文件
                await File.WriteAllBytesAsync(filePath, imageData);
                _loggingService.LogInformation($"圖片保存成功: {filePath}, 大小: {imageData.Length} bytes");
                
                // ✅ 返回相對 URL 路徑而不是絕對路徑，以便前端可以直接使用
                var relativeUrl = $"/Uploads/Whatsapp_Images/{directoryName}/{fileName}";
                _loggingService.LogInformation($"返回相對 URL: {relativeUrl}");
                return relativeUrl;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"保存 waitReply 圖片時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                throw;
            }
        }

        /// <summary>
        /// 處理 WhatsApp 消息狀態更新
        /// </summary>
        private async Task ProcessStatusUpdateAsync(JsonElement statuses)
        {
            try
            {
                _loggingService.LogInformation("=== 開始處理消息狀態更新 ===");
                
                foreach (var statusElement in statuses.EnumerateArray())
                {
                    // 提取狀態信息
                    var messageId = statusElement.GetProperty("id").GetString();
                    var status = statusElement.GetProperty("status").GetString();
                    
                    // 處理 timestamp 欄位，可能是字串或數字格式
                    long timestamp;
                    if (statusElement.GetProperty("timestamp").ValueKind == JsonValueKind.String)
                    {
                        var timestampStr = statusElement.GetProperty("timestamp").GetString();
                        if (!long.TryParse(timestampStr, out timestamp))
                        {
                            _loggingService.LogWarning($"無法解析 timestamp 字串: {timestampStr}");
                            continue;
                        }
                    }
                    else
                    {
                        timestamp = statusElement.GetProperty("timestamp").GetInt64();
                    }
                    
                    var recipientId = statusElement.GetProperty("recipient_id").GetString();
                    
                    _loggingService.LogInformation($"消息ID: {messageId}, 狀態: {status}, 收件人: {recipientId}");
                    
                    // 查找對應的收件人記錄
                    var recipient = await _context.WorkflowMessageRecipients
                        .FirstOrDefaultAsync(r => r.WhatsAppMessageId == messageId && r.PhoneNumber == recipientId);
                    
                    if (recipient == null)
                    {
                        _loggingService.LogWarning($"找不到對應的收件人記錄，WhatsApp MessageId: {messageId}");
                        continue;
                    }
                    
                    _loggingService.LogInformation($"找到收件人記錄，ID: {recipient.Id}, 當前狀態: {recipient.Status}");
                    
                    // 更新狀態
                    var statusChanged = false;
                    var statusTime = DateTimeOffset.FromUnixTimeSeconds(timestamp).DateTime;
                    
                    switch (status.ToLower())
                    {
                        case "sent":
                            if (recipient.Status == "Pending")
                            {
                                recipient.Status = "Sent";
                                recipient.SentAt = statusTime;
                                statusChanged = true;
                                _loggingService.LogInformation($"✅ 狀態更新: Pending → Sent");
                            }
                            break;
                            
                        case "delivered":
                            if (recipient.Status == "Pending" || recipient.Status == "Sent")
                            {
                                recipient.Status = "Delivered";
                                recipient.DeliveredAt = statusTime;
                                if (recipient.SentAt == null)
                                {
                                    recipient.SentAt = statusTime;
                                }
                                statusChanged = true;
                                _loggingService.LogInformation($"✅ 狀態更新: {recipient.Status} → Delivered");
                            }
                            break;
                            
                        case "read":
                            recipient.Status = "Read";
                            recipient.ReadAt = statusTime;
                            if (recipient.DeliveredAt == null)
                            {
                                recipient.DeliveredAt = statusTime;
                            }
                            if (recipient.SentAt == null)
                            {
                                recipient.SentAt = statusTime;
                            }
                            statusChanged = true;
                            _loggingService.LogInformation($"✅ 狀態更新: {recipient.Status} → Read");
                            break;
                            
                        case "failed":
                            recipient.Status = "Failed";
                            recipient.FailedAt = statusTime;
                            
                            // 提取錯誤信息
                            if (statusElement.TryGetProperty("errors", out var errors) && errors.GetArrayLength() > 0)
                            {
                                var error = errors[0];
                                if (error.TryGetProperty("code", out var errorCode))
                                {
                                    // 處理錯誤代碼，可能是字串或數字格式
                                    if (errorCode.ValueKind == JsonValueKind.String)
                                    {
                                        recipient.ErrorCode = errorCode.GetString();
                                    }
                                    else
                                    {
                                        recipient.ErrorCode = errorCode.GetInt32().ToString();
                                    }
                                }
                                if (error.TryGetProperty("title", out var errorTitle))
                                {
                                    recipient.ErrorMessage = errorTitle.GetString();
                                }
                            }
                            statusChanged = true;
                            _loggingService.LogInformation($"❌ 狀態更新: {recipient.Status} → Failed");
                            break;
                    }
                    
                    if (statusChanged)
                    {
                        recipient.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                        _loggingService.LogInformation($"✅ 收件人狀態已更新並保存到數據庫");
                        
                        // 更新 WorkflowMessageSend 的統計數據
                        await UpdateMessageSendStatisticsAsync(recipient.MessageSendId);
                    }
                }
                
                _loggingService.LogInformation("=== 消息狀態更新處理完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理消息狀態更新時發生錯誤: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// 更新 WorkflowMessageSend 的統計數據
        /// </summary>
        private async Task UpdateMessageSendStatisticsAsync(Guid messageSendId)
        {
            try
            {
                var messageSend = await _context.WorkflowMessageSends
                    .Include(ms => ms.Recipients)
                    .FirstOrDefaultAsync(ms => ms.Id == messageSendId);
                
                if (messageSend == null)
                {
                    _loggingService.LogWarning($"找不到消息發送記錄: {messageSendId}");
                    return;
                }
                
                // 重新計算統計數據
                var recipients = messageSend.Recipients.ToList();
                messageSend.TotalRecipients = recipients.Count;
                messageSend.SuccessCount = recipients.Count(r => r.Status == "Sent" || r.Status == "Delivered" || r.Status == "Read");
                messageSend.FailedCount = recipients.Count(r => r.Status == "Failed");
                
                // 更新整體狀態
                if (messageSend.FailedCount > 0 && messageSend.SuccessCount > 0)
                {
                    messageSend.Status = "PartiallyFailed";
                }
                else if (messageSend.FailedCount == messageSend.TotalRecipients)
                {
                    messageSend.Status = "Failed";
                }
                else if (messageSend.SuccessCount == messageSend.TotalRecipients)
                {
                    messageSend.Status = "Completed";
                    messageSend.CompletedAt = DateTime.UtcNow;
                }
                
                messageSend.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                
                _loggingService.LogInformation($"✅ 消息發送統計已更新: Total={messageSend.TotalRecipients}, Success={messageSend.SuccessCount}, Failed={messageSend.FailedCount}, Status={messageSend.Status}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新消息發送統計時發生錯誤: {ex.Message}");
            }
        }
    }
}
