using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

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
                WelcomeMessage = string.IsNullOrWhiteSpace(company.WA_WelcomeMessage) ? defaults.WelcomeMessage : company.WA_WelcomeMessage,
                NoFunctionMessage = string.IsNullOrWhiteSpace(company.WA_NoFunctionMessage) ? defaults.NoFunctionMessage : company.WA_NoFunctionMessage,
                MenuTitle = string.IsNullOrWhiteSpace(company.WA_MenuTitle) ? defaults.MenuTitle : company.WA_MenuTitle,
                MenuFooter = string.IsNullOrWhiteSpace(company.WA_MenuFooter) ? defaults.MenuFooter : company.WA_MenuFooter,
                MenuButton = string.IsNullOrWhiteSpace(company.WA_MenuButton) ? defaults.MenuButton : company.WA_MenuButton,
                SectionTitle = string.IsNullOrWhiteSpace(company.WA_SectionTitle) ? defaults.SectionTitle : company.WA_SectionTitle,
                DefaultOptionDescription = string.IsNullOrWhiteSpace(company.WA_DefaultOptionDescription) ? defaults.DefaultOptionDescription : company.WA_DefaultOptionDescription,
                InputErrorMessage = string.IsNullOrWhiteSpace(company.WA_InputErrorMessage) ? defaults.InputErrorMessage : company.WA_InputErrorMessage,
                FallbackMessage = string.IsNullOrWhiteSpace(company.WA_FallbackMessage) ? defaults.FallbackMessage : company.WA_FallbackMessage,
                SystemErrorMessage = string.IsNullOrWhiteSpace(company.WA_SystemErrorMessage) ? defaults.SystemErrorMessage : company.WA_SystemErrorMessage
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
        private readonly DocumentConverterService _documentConverterService;
        private static readonly JsonSerializerOptions PayloadJsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        public WebhookMessageProcessingService(
            PurpleRiceDbContext context,
            UserSessionService userSessionService,
            IMessageValidator messageValidator,
            WhatsAppWorkflowService whatsAppWorkflowService,
            WorkflowEngine workflowEngine,
            WebhookDuplicateService duplicateService,
            Func<string, LoggingService> loggingServiceFactory,
            IServiceProvider serviceProvider,
            DocumentConverterService documentConverterService)
        {
            _context = context;
            _userSessionService = userSessionService;
            _messageValidator = messageValidator;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _workflowEngine = workflowEngine;
            _duplicateService = duplicateService;
            _loggingService = loggingServiceFactory("WebhookMessageProcessingService");
            _serviceProvider = serviceProvider;
            _documentConverterService = documentConverterService;
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
                string mediaMimeType = null;
                string mediaFileName = null;
                string caption = null;
                
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
                            
                            if (imageData.TryGetProperty("mime_type", out var mimeTypeProperty))
                            {
                                mediaMimeType = mimeTypeProperty.GetString();
                                _loggingService.LogInformation($"圖片 MIME 類型: {mediaMimeType}");
                            }
                            
                            if (imageData.TryGetProperty("caption", out var captionProperty))
                            {
                                messageText = captionProperty.GetString();
                                caption = messageText;
                                _loggingService.LogInformation($"✅ 提取到圖片文字說明（caption）: '{messageText}'");
                            }
                            else
                            {
                                _loggingService.LogInformation($"圖片消息沒有文字說明（caption）");
                            }
                        }
                    }
                    else if (messageType == "document")
                    {
                        _loggingService.LogInformation("檢測到文件訊息，準備提取文件資訊");
                        messageText = "";

                        if (message.TryGetProperty("document", out var documentData))
                        {
                            if (documentData.TryGetProperty("id", out var documentIdProperty))
                            {
                                mediaId = documentIdProperty.GetString();
                                _loggingService.LogInformation($"提取到文件媒體 ID: {mediaId}");
                            }

                            if (documentData.TryGetProperty("mime_type", out var mimeTypeProperty))
                            {
                                mediaMimeType = mimeTypeProperty.GetString();
                                _loggingService.LogInformation($"文件 MIME 類型: {mediaMimeType}");
                            }

                            if (documentData.TryGetProperty("filename", out var filenameProperty))
                            {
                                mediaFileName = filenameProperty.GetString();
                                _loggingService.LogInformation($"文件名稱: {mediaFileName}");
                            }

                            if (documentData.TryGetProperty("caption", out var captionProperty))
                            {
                                messageText = captionProperty.GetString();
                                caption = messageText;
                                _loggingService.LogInformation($"✅ 提取到文件文字說明（caption）: '{messageText}'");
                            }
                        }
                        else
                        {
                            _loggingService.LogWarning("文件訊息缺少 document 區段，無法提取媒體資訊");
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
                    MediaId = mediaId,
                    Caption = caption,
                    MediaMimeType = mediaMimeType,
                    MediaFileName = mediaFileName
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
                
                // 如果是媒體消息，下載並預處理（圖片、文件等）
                string savedMediaPath = null;
                DownloadedMedia? downloadedMedia = null;
                if (!string.IsNullOrEmpty(messageData.MediaId))
                {
                    downloadedMedia = await DownloadWhatsAppMediaAsync(company, messageData.MediaId);
                    if (downloadedMedia == null || downloadedMedia.Content == null || downloadedMedia.Content.Length == 0)
                    {
                        _loggingService.LogWarning($"媒體 {messageData.MediaId} 下載失敗或為空");
                    }
                    else
                    {
                        messageData.MediaMimeType = downloadedMedia.MimeType ?? messageData.MediaMimeType;
                        // 優先使用從原始消息中提取的文件名，如果沒有則使用下載響應中的文件名
                        messageData.MediaFileName = messageData.MediaFileName ?? downloadedMedia.FileName;
                        messageData.MediaContentBase64 = Convert.ToBase64String(downloadedMedia.Content);

                        // 使用最終確定的文件名（優先使用原始消息中的文件名）
                        var finalFileName = messageData.MediaFileName ?? downloadedMedia.FileName;
                        var finalMimeType = messageData.MediaMimeType ?? downloadedMedia.MimeType;

                        // 依不同消息類型作額外處理
                        if (string.Equals(messageData.MessageType, "image", StringComparison.OrdinalIgnoreCase))
                        {
                            savedMediaPath = await SaveWaitReplyImageAsync(execution.Id, downloadedMedia.Content, finalFileName, finalMimeType);
                        }
                        else if (string.Equals(messageData.MessageType, "document", StringComparison.OrdinalIgnoreCase))
                        {
                            savedMediaPath = await SaveWaitReplyDocumentAsync(execution.Id, downloadedMedia.Content, finalFileName, finalMimeType);

                            // 將文件寫入暫存檔供 LibreOffice 解析
                            var extension = Path.GetExtension(finalFileName ?? string.Empty);
                            if (string.IsNullOrWhiteSpace(extension) && !string.IsNullOrWhiteSpace(finalMimeType))
                            {
                                extension = GetFileExtensionFromMimeType(finalMimeType) ?? ".tmp";
                            }

                            var tempFilePath = Path.Combine(Path.GetTempPath(), $"whatsapp_doc_{Guid.NewGuid():N}{extension}");
                            try
                            {
                                await File.WriteAllBytesAsync(tempFilePath, downloadedMedia.Content);
                                if (_documentConverterService.IsSupportedFormat(tempFilePath))
                                {
                                    var parseResult = await _documentConverterService.ParseDocumentAsync(tempFilePath, downloadedMedia.MimeType, downloadedMedia.FileName);
                                    messageData.DocumentPlainText = parseResult.PlainText;
                                    messageData.DocumentStructuredJson = parseResult.ToJson();
                                    if (string.IsNullOrWhiteSpace(messageData.MessageText) && !string.IsNullOrWhiteSpace(parseResult.PlainText))
                                    {
                                        messageData.MessageText = parseResult.PlainText;
                                    }
                                }
                                else
                                {
                                    _loggingService.LogWarning($"文件類型 {extension} 暫不支援 LibreOffice 轉換");
                                }
                            }
                            catch (Exception docEx)
                            {
                                _loggingService.LogError($"解析文件內容時發生錯誤: {docEx.Message}");
                            }
                            finally
                            {
                                try
                                {
                                    if (File.Exists(tempFilePath))
                                    {
                                        File.Delete(tempFilePath);
                                    }
                                    var generatedHtmlPath = Path.Combine(Path.GetDirectoryName(tempFilePath) ?? Path.GetTempPath(), Path.GetFileNameWithoutExtension(tempFilePath) + ".html");
                                    if (File.Exists(generatedHtmlPath))
                                    {
                                        File.Delete(generatedHtmlPath);
                                    }
                                }
                                catch (Exception cleanupEx)
                                {
                                    _loggingService.LogWarning($"清理暫存文件失敗: {cleanupEx.Message}");
                                }
                            }
                        }
                    }
                }
                
                // 獲取步驟執行記錄中的驗證配置（先查詢以獲取正確的 StepIndex）
                var stepExecution = await _context.WorkflowStepExecutions
                    .FirstOrDefaultAsync(s => s.WorkflowExecutionId == execution.Id && s.IsWaiting);
                
                // ✅ 使用 stepExecution.StepIndex 而不是 execution.CurrentWaitingStep
                int stepIndex = stepExecution?.StepIndex ?? execution.CurrentWaitingStep ?? 0;
                
                var rawPayload = BuildRawMessagePayload(messageData);
                if (stepExecution != null)
                {
                    stepExecution.ReceivedPayloadJson = JsonSerializer.Serialize(rawPayload, PayloadJsonOptions);
                }

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
                    MediaUrl = savedMediaPath,
                    CreatedAt = DateTime.UtcNow
                };

                // 執行驗證
                var validationResult = await _messageValidator.ValidateMessageAsync(
                    messageData,
                    execution,
                    stepExecution);

                validation.IsValid = validationResult.IsValid;
                validation.ErrorMessage = validationResult.ErrorMessage;
                validation.ValidatorType = validationResult.ValidatorType ?? "default";

                if (stepExecution != null && validationResult.AdditionalData != null)
                {
                    try
                    {
                        stepExecution.AiResultJson = JsonSerializer.Serialize(validationResult.AdditionalData, PayloadJsonOptions);
                    }
                    catch (Exception serializeEx)
                    {
                        _loggingService.LogError($"序列化 AI 結果失敗: {serializeEx.Message}");
                    }
                }

                if (validationResult.IsValid)
                {
                    if (validationResult.ProcessedData is string processedText)
                    {
                        validation.ProcessedData = processedText;
                    }
                    else if (validationResult.ProcessedData != null)
                    {
                        validation.ProcessedData = JsonSerializer.Serialize(validationResult.ProcessedData);
                    }

                    if (!string.IsNullOrWhiteSpace(validationResult.TargetProcessVariable))
                    {
                        try
                        {
                            using var scope = _serviceProvider.CreateScope();
                            var processVariableService = scope.ServiceProvider.GetRequiredService<IProcessVariableService>();

                            object? valueToStore = validationResult.ProcessedData ?? validationResult.SuggestionMessage ?? messageData.MessageText;
                            if (valueToStore == null || (valueToStore is string s && string.IsNullOrWhiteSpace(s)))
                            {
                                valueToStore = validationResult.AdditionalData ?? BuildFallbackProcessVariablePayload(messageData);
                            }

                            if (valueToStore != null && valueToStore is not string)
                            {
                                valueToStore = JsonSerializer.Serialize(valueToStore, PayloadJsonOptions);
                            }

                            await processVariableService.SetVariableValueAsync(
                                execution.Id,
                                validationResult.TargetProcessVariable,
                                valueToStore ?? string.Empty,
                                setBy: "AIValidator",
                                sourceType: "AIValidation",
                                sourceReference: execution.Id.ToString()
                            );

                            _loggingService.LogInformation($"AI 驗證結果寫入流程變量: {validationResult.TargetProcessVariable}");
                        }
                        catch (Exception pvEx)
                        {
                            _loggingService.LogError($"AI 驗證結果寫入流程變量失敗: {pvEx.Message}", pvEx);
                        }
                    }
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
                
                // 記錄從數據庫讀取的公司設置值（用於調試）
                _loggingService.LogInformation($"=== 公司菜單設置調試信息 ===");
                _loggingService.LogInformation($"WA_WelcomeMessage: '{company.WA_WelcomeMessage ?? "(null)"}'");
                _loggingService.LogInformation($"WA_NoFunctionMessage: '{company.WA_NoFunctionMessage ?? "(null)"}'");
                _loggingService.LogInformation($"WA_MenuTitle: '{company.WA_MenuTitle ?? "(null)"}'");
                _loggingService.LogInformation($"WA_MenuFooter: '{company.WA_MenuFooter ?? "(null)"}'");
                _loggingService.LogInformation($"WA_MenuButton: '{company.WA_MenuButton ?? "(null)"}'");
                _loggingService.LogInformation($"WA_SectionTitle: '{company.WA_SectionTitle ?? "(null)"}'");
                _loggingService.LogInformation($"WA_DefaultOptionDescription: '{company.WA_DefaultOptionDescription ?? "(null)"}'");
                _loggingService.LogInformation($"WA_InputErrorMessage: '{company.WA_InputErrorMessage ?? "(null)"}'");
                _loggingService.LogInformation($"WA_FallbackMessage: '{company.WA_FallbackMessage ?? "(null)"}'");
                _loggingService.LogInformation($"WA_SystemErrorMessage: '{company.WA_SystemErrorMessage ?? "(null)"}'");
                
                // 獲取 WhatsApp 菜單設置
                var menuSettings = WhatsAppMenuSettings.FromCompany(company);
                
                // 記錄最終使用的設置值
                _loggingService.LogInformation($"=== 最終使用的菜單設置 ===");
                _loggingService.LogInformation($"WelcomeMessage: '{menuSettings.WelcomeMessage}'");
                _loggingService.LogInformation($"MenuTitle: '{menuSettings.MenuTitle}'");
                _loggingService.LogInformation($"MenuFooter: '{menuSettings.MenuFooter}'");
                _loggingService.LogInformation($"MenuButton: '{menuSettings.MenuButton}'");
                _loggingService.LogInformation($"SectionTitle: '{menuSettings.SectionTitle}'");
                _loggingService.LogInformation($"=================================");
                
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
        /// 發送 QR Code 訊息（支持模板和直接訊息）
        /// </summary>
        private async Task SendQRCodeMessageAsync(
            Company company, 
            WorkflowExecution execution,
            string waId, 
            QRCodeNodeInfo nodeInfo,
            bool isSuccessMessage)
        {
            try
            {
                string messageMode;
                string message;
                string templateId;
                string templateName;
                bool isMetaTemplate;
                string templateLanguage;
                List<object> templateVariables;

                if (isSuccessMessage)
                {
                    messageMode = nodeInfo.QrCodeSuccessMessageMode ?? "direct";
                    message = nodeInfo.QrCodeSuccessMessage;
                    templateId = nodeInfo.QrCodeSuccessTemplateId;
                    templateName = nodeInfo.QrCodeSuccessTemplateName;
                    isMetaTemplate = nodeInfo.QrCodeSuccessIsMetaTemplate;
                    templateLanguage = nodeInfo.QrCodeSuccessTemplateLanguage;
                    templateVariables = nodeInfo.QrCodeSuccessTemplateVariables;
                }
                else
                {
                    messageMode = nodeInfo.QrCodeErrorMessageMode ?? "direct";
                    message = nodeInfo.QrCodeErrorMessage;
                    templateId = nodeInfo.QrCodeErrorTemplateId;
                    templateName = nodeInfo.QrCodeErrorTemplateName;
                    isMetaTemplate = nodeInfo.QrCodeErrorIsMetaTemplate;
                    templateLanguage = nodeInfo.QrCodeErrorTemplateLanguage;
                    templateVariables = nodeInfo.QrCodeErrorTemplateVariables;
                }

                if (messageMode == "template" && !string.IsNullOrEmpty(templateName))
                {
                    _loggingService.LogInformation($"📝 QR Code {(isSuccessMessage ? "成功" : "錯誤")}訊息使用模板模式: {templateName}");
                    
                    // 處理模板變數
                    Dictionary<string, string> processedVariables = new Dictionary<string, string>();
                    if (templateVariables != null && templateVariables.Any())
                    {
                        using var scope = _serviceProvider.CreateScope();
                        var variableReplacementService = scope.ServiceProvider.GetRequiredService<IVariableReplacementService>();
                        foreach (var tv in templateVariables)
                        {
                            if (tv != null)
                            {
                                try
                                {
                                    var tvJson = JsonSerializer.Serialize(tv);
                                    var tvElement = JsonSerializer.Deserialize<JsonElement>(tvJson);
                                    if (tvElement.TryGetProperty("parameterName", out var paramName) &&
                                        tvElement.TryGetProperty("value", out var value))
                                    {
                                        var paramNameStr = paramName.GetString();
                                        var valueStr = value.GetString() ?? "";
                                        // 替換流程變數
                                        var processedValue = await variableReplacementService.ReplaceVariablesAsync(valueStr, execution.Id);
                                        processedVariables[paramNameStr] = processedValue;
                                    }
                                }
                                catch (Exception ex)
                                {
                                    _loggingService.LogWarning($"處理模板變數時發生錯誤: {ex.Message}");
                                }
                            }
                        }
                    }
                    
                    // 發送模板訊息
                    await _whatsAppWorkflowService.SendWhatsAppTemplateMessageAsync(
                        waId,
                        templateId,
                        execution,
                        _context,
                        processedVariables,
                        isMetaTemplate,
                        templateName,
                        templateLanguage
                    );
                }
                else
                {
                    // 發送直接訊息
                    var finalMessage = !string.IsNullOrEmpty(message) 
                        ? message 
                        : (isSuccessMessage 
                            ? "QR Code 掃描成功！流程將繼續執行。" 
                            : "無法處理您上傳的圖片，請重新上傳。");
                    await SendWhatsAppMessage(company, waId, finalMessage);
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 QR Code {(isSuccessMessage ? "成功" : "錯誤")}訊息失敗: {ex.Message}", ex);
                // 回退到直接訊息
                var fallbackMessage = isSuccessMessage 
                    ? "QR Code 掃描成功！流程將繼續執行。" 
                    : "無法處理您上傳的圖片，請重新上傳。";
                await SendWhatsAppMessage(company, waId, fallbackMessage);
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
                    await SendQRCodeMessageAsync(company, execution, messageData.WaId, nodeInfo, false);
                    return;
                }
                
                // 從 WhatsApp 下載圖片
                var qrMedia = await DownloadWhatsAppMediaAsync(company, messageData.MediaId);
                var imageBytes = qrMedia?.Content;
                if (qrMedia == null || imageBytes == null || imageBytes.Length == 0)
                {
                    _loggingService.LogError("無法下載 WhatsApp 圖片");
                    await SendQRCodeMessageAsync(company, execution, messageData.WaId, nodeInfo, false);
                    return;
                }
                
                _loggingService.LogInformation($"成功下載圖片，大小: {imageBytes.Length} bytes");
                messageData.MediaMimeType = qrMedia.MimeType;
                messageData.MediaFileName = qrMedia.FileName;
                
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
                    await SendQRCodeMessageAsync(company, execution, messageData.WaId, nodeInfo, false);
                    return;
                }
                
                _loggingService.LogInformation($"成功掃描 QR Code: {qrCodeValue}");
                
                // 處理 QR Code 輸入 - 先將 QR Code 值寫入流程變量
                var qrCodeProcessResult = await workflowExecutionService.ProcessQRCodeInputAsync(execution.Id, nodeInfo.NodeId, imageBytes, qrCodeValue);
                if (!qrCodeProcessResult)
                {
                    _loggingService.LogError("QR Code 處理失敗");
                    await SendQRCodeMessageAsync(company, execution, messageData.WaId, nodeInfo, false);
                    return;
                }
                
                _loggingService.LogInformation($"✅ QR Code 值已寫入流程變量: {nodeInfo.QrCodeVariable ?? "qrCodeResult"}");
                
                // 檢查是否有 AI 驗證配置
                var hasAiValidation = nodeInfo.Validation != null && 
                                     (nodeInfo.Validation.AiIsActive == true || 
                                      (nodeInfo.Validation.Enabled == true && 
                                       string.Equals(nodeInfo.Validation.ValidatorType, "ai", StringComparison.OrdinalIgnoreCase)));
                
                if (hasAiValidation && stepExecution != null)
                {
                    _loggingService.LogInformation($"🔍 檢測到 AI 驗證配置，開始驗證 QR Code 變量值");
                    
                    // 創建一個新的 WhatsAppMessageData，將 QR Code 值作為 MessageText
                    var qrCodeMessageData = new WhatsAppMessageData
                    {
                        WaId = messageData.WaId,
                        ContactName = messageData.ContactName,
                        MessageId = messageData.MessageId,
                        MessageText = qrCodeValue, // ✅ 使用 QR Code 值作為驗證內容
                        Timestamp = DateTime.UtcNow,
                        Source = "QRCodeValidation",
                        MessageType = "text", // QR Code 值作為文字驗證
                        MediaId = messageData.MediaId,
                        MediaMimeType = messageData.MediaMimeType,
                        MediaFileName = messageData.MediaFileName
                    };
                    
                    // 執行 AI 驗證
                    var validationResult = await _messageValidator.ValidateMessageAsync(
                        qrCodeMessageData,
                        execution,
                        stepExecution);
                    
                    // 更新驗證記錄
                    validation.IsValid = validationResult.IsValid;
                    validation.ErrorMessage = validationResult.ErrorMessage;
                    validation.ValidatorType = validationResult.ValidatorType ?? "ai";
                    
                    if (stepExecution != null && validationResult.AdditionalData != null)
                    {
                        try
                        {
                            stepExecution.AiResultJson = JsonSerializer.Serialize(validationResult.AdditionalData, PayloadJsonOptions);
                        }
                        catch (Exception serializeEx)
                        {
                            _loggingService.LogError($"序列化 AI 結果失敗: {serializeEx.Message}");
                        }
                    }
                    
                    if (validationResult.IsValid)
                    {
                        if (validationResult.ProcessedData is string processedText)
                        {
                            validation.ProcessedData = processedText;
                        }
                        else if (validationResult.ProcessedData != null)
                        {
                            validation.ProcessedData = JsonSerializer.Serialize(validationResult.ProcessedData);
                        }
                        
                        // 將 AI 驗證結果寫入流程變量（如果配置了）
                        if (!string.IsNullOrWhiteSpace(validationResult.TargetProcessVariable))
                        {
                            try
                            {
                                using var pvScope = _serviceProvider.CreateScope();
                                var processVariableService = pvScope.ServiceProvider.GetRequiredService<IProcessVariableService>();
                                
                                object? valueToStore = validationResult.ProcessedData ?? validationResult.SuggestionMessage ?? qrCodeValue;
                                if (valueToStore == null || (valueToStore is string s && string.IsNullOrWhiteSpace(s)))
                                {
                                    valueToStore = validationResult.AdditionalData ?? qrCodeValue;
                                }
                                
                                if (valueToStore != null && valueToStore is not string)
                                {
                                    valueToStore = JsonSerializer.Serialize(valueToStore, PayloadJsonOptions);
                                }
                                
                                await processVariableService.SetVariableValueAsync(
                                    execution.Id,
                                    validationResult.TargetProcessVariable,
                                    valueToStore ?? string.Empty,
                                    setBy: "AIValidator",
                                    sourceType: "AIValidation",
                                    sourceReference: execution.Id.ToString()
                                );
                                
                                _loggingService.LogInformation($"✅ AI 驗證結果寫入流程變量: {validationResult.TargetProcessVariable}");
                            }
                            catch (Exception pvEx)
                            {
                                _loggingService.LogError($"AI 驗證結果寫入流程變量失敗: {pvEx.Message}", pvEx);
                            }
                        }
                    }
                    
                    await _context.SaveChangesAsync();
                    
                    if (!validationResult.IsValid)
                    {
                        // AI 驗證失敗，發送錯誤訊息並保持等待狀態
                        var errorMessage = validationResult.ErrorMessage ?? 
                                          nodeInfo.Validation?.RetryMessage ?? 
                                          menuSettings.InputErrorMessage;
                        await SendWhatsAppMessage(company, messageData.WaId, errorMessage);
                        _loggingService.LogInformation($"❌ AI 驗證失敗，保持等待狀態: {errorMessage}");
                        return;
                    }
                    
                    _loggingService.LogInformation($"✅ AI 驗證通過，繼續執行流程");
                }
                else
                {
                    _loggingService.LogInformation($"ℹ️ 未配置 AI 驗證，直接繼續流程");
                }
                
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
                
                // 發送成功訊息並繼續執行流程
                await SendQRCodeMessageAsync(company, execution, messageData.WaId, nodeInfo, true);
                
                // 繼續執行流程
                await _workflowEngine.ContinueWorkflowFromWaitReply(execution, messageData);
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
                            QrCodeSuccessMessageMode = waitForQRCodeNode.Data?.QrCodeSuccessMessageMode ?? "direct",
                            QrCodeSuccessTemplateId = waitForQRCodeNode.Data?.QrCodeSuccessTemplateId,
                            QrCodeSuccessTemplateName = waitForQRCodeNode.Data?.QrCodeSuccessTemplateName,
                            QrCodeSuccessIsMetaTemplate = waitForQRCodeNode.Data?.QrCodeSuccessIsMetaTemplate ?? false,
                            QrCodeSuccessTemplateLanguage = waitForQRCodeNode.Data?.QrCodeSuccessTemplateLanguage,
                            QrCodeSuccessTemplateVariables = waitForQRCodeNode.Data?.QrCodeSuccessTemplateVariables,
                            QrCodeErrorMessage = waitForQRCodeNode.Data?.QrCodeErrorMessage,
                            QrCodeErrorMessageMode = waitForQRCodeNode.Data?.QrCodeErrorMessageMode ?? "direct",
                            QrCodeErrorTemplateId = waitForQRCodeNode.Data?.QrCodeErrorTemplateId,
                            QrCodeErrorTemplateName = waitForQRCodeNode.Data?.QrCodeErrorTemplateName,
                            QrCodeErrorIsMetaTemplate = waitForQRCodeNode.Data?.QrCodeErrorIsMetaTemplate ?? false,
                            QrCodeErrorTemplateLanguage = waitForQRCodeNode.Data?.QrCodeErrorTemplateLanguage,
                            QrCodeErrorTemplateVariables = waitForQRCodeNode.Data?.QrCodeErrorTemplateVariables,
                            QrCodeVariable = waitForQRCodeNode.Data?.QrCodeVariable,
                            Validation = waitForQRCodeNode.Data?.Validation
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
            public string QrCodeSuccessMessageMode { get; set; }
            public string QrCodeSuccessTemplateId { get; set; }
            public string QrCodeSuccessTemplateName { get; set; }
            public bool QrCodeSuccessIsMetaTemplate { get; set; }
            public string QrCodeSuccessTemplateLanguage { get; set; }
            public List<object> QrCodeSuccessTemplateVariables { get; set; }
            public string QrCodeErrorMessage { get; set; }
            public string QrCodeErrorMessageMode { get; set; }
            public string QrCodeErrorTemplateId { get; set; }
            public string QrCodeErrorTemplateName { get; set; }
            public bool QrCodeErrorIsMetaTemplate { get; set; }
            public string QrCodeErrorTemplateLanguage { get; set; }
            public List<object> QrCodeErrorTemplateVariables { get; set; }
            public string QrCodeVariable { get; set; }
            public WorkflowValidation Validation { get; set; }
        }

        /// <summary>
        /// 從 WhatsApp 下載媒體文件
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="messageId">訊息 ID</param>
        /// <returns>圖片字節數組</returns>
        private async Task<DownloadedMedia?> DownloadWhatsAppMediaAsync(Company company, string messageId)
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
                        var mediaBytes = await imageResponse.Content.ReadAsByteArrayAsync();
                        _loggingService.LogInformation($"成功下載媒體，大小: {mediaBytes.Length} bytes");
                        mediaInfo.TryGetProperty("mime_type", out var mimeProperty);
                        mediaInfo.TryGetProperty("filename", out var filenameProperty);
                        var mimeType = mimeProperty.ValueKind == JsonValueKind.String ? mimeProperty.GetString() : null;
                        var fileName = filenameProperty.ValueKind == JsonValueKind.String ? filenameProperty.GetString() : null;
                        return new DownloadedMedia(mediaBytes, mimeType, fileName);
                    }
                    else
                    {
                        _loggingService.LogError($"下載媒體失敗: {imageResponse.StatusCode}");
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
                _loggingService.LogError($"下載 WhatsApp 媒體時發生錯誤: {ex.Message}");
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
        private async Task<string> SaveWaitReplyImageAsync(int executionId, byte[] imageData, string? fileName = null, string? mimeType = null)
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

                var extension = GetFileExtensionFromMimeType(mimeType) ?? ".jpg";

                // 生成文件名：使用時間戳和 GUID 確保唯一性
                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                var guid = Guid.NewGuid().ToString("N").Substring(0, 8); // 取前8位
                var savedFileName = $"reply_image_{timestamp}_{guid}{extension}";
                
                var filePath = Path.Combine(uploadsPath, savedFileName);
                _loggingService.LogInformation($"目標文件路徑: {filePath}");

                // 保存圖片文件
                await File.WriteAllBytesAsync(filePath, imageData);
                _loggingService.LogInformation($"圖片保存成功: {filePath}, 大小: {imageData.Length} bytes");
                
                // 保存原始文件名到元數據文件
                if (!string.IsNullOrWhiteSpace(fileName))
                {
                    var metadataFileName = Path.GetFileNameWithoutExtension(savedFileName) + ".metadata.json";
                    var metadataPath = Path.Combine(uploadsPath, metadataFileName);
                    var metadata = new
                    {
                        originalFileName = fileName,
                        savedFileName = savedFileName,
                        mimeType = mimeType,
                        fileSize = imageData.Length,
                        savedAt = DateTime.UtcNow
                    };
                    var metadataJson = System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                    await File.WriteAllTextAsync(metadataPath, metadataJson);
                    _loggingService.LogInformation($"元數據文件保存成功: {metadataPath}");
                }
                
                // ✅ 返回相對 URL 路徑而不是絕對路徑，以便前端可以直接使用
                var relativeUrl = $"/Uploads/Whatsapp_Images/{directoryName}/{savedFileName}";
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

        private async Task<string> SaveWaitReplyDocumentAsync(int executionId, byte[] documentData, string? fileName, string? mimeType)
        {
            _loggingService.LogInformation($"開始保存 waitReply 文件，執行ID: {executionId}");

            try
            {
                if (executionId <= 0)
                {
                    throw new ArgumentException("ExecutionId must be greater than 0", nameof(executionId));
                }

                string directoryName = executionId.ToString();
                var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Whatsapp_Documents", directoryName);
                _loggingService.LogInformation($"文件目錄: {uploadsPath}");

                if (!Directory.Exists(uploadsPath))
                {
                    Directory.CreateDirectory(uploadsPath);
                }

                var extension = Path.GetExtension(fileName ?? string.Empty);
                if (string.IsNullOrWhiteSpace(extension))
                {
                    extension = GetFileExtensionFromMimeType(mimeType) ?? ".dat";
                }

                var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                var baseFileName = string.IsNullOrWhiteSpace(fileName)
                    ? $"reply_document_{timestamp}_{Guid.NewGuid():N}"
                    : Path.GetFileNameWithoutExtension(fileName);

                var invalidChars = Path.GetInvalidFileNameChars();
                baseFileName = new string(baseFileName.Where(ch => !invalidChars.Contains(ch)).ToArray());
                if (string.IsNullOrWhiteSpace(baseFileName))
                {
                    baseFileName = $"reply_document_{timestamp}_{Guid.NewGuid():N}";
                }

                var safeFileName = baseFileName + extension;

                var filePath = Path.Combine(uploadsPath, safeFileName);
                await File.WriteAllBytesAsync(filePath, documentData);
                _loggingService.LogInformation($"文件保存成功: {filePath}, 大小: {documentData.Length} bytes");

                // 保存原始文件名到元數據文件
                if (!string.IsNullOrWhiteSpace(fileName))
                {
                    var metadataFileName = Path.GetFileNameWithoutExtension(safeFileName) + ".metadata.json";
                    var metadataPath = Path.Combine(uploadsPath, metadataFileName);
                    var metadata = new
                    {
                        originalFileName = fileName,
                        savedFileName = safeFileName,
                        mimeType = mimeType,
                        fileSize = documentData.Length,
                        savedAt = DateTime.UtcNow
                    };
                    var metadataJson = System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                    await File.WriteAllTextAsync(metadataPath, metadataJson);
                    _loggingService.LogInformation($"元數據文件保存成功: {metadataPath}");
                }

                var relativeUrl = $"/Uploads/Whatsapp_Documents/{directoryName}/{safeFileName}";
                return relativeUrl;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"保存 waitReply 文件時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                throw;
            }
        }

        private IDictionary<string, object?> BuildRawMessagePayload(WhatsAppMessageData messageData)
        {
            var payload = new Dictionary<string, object?>
            {
                ["messageType"] = messageData.MessageType,
                ["text"] = messageData.MessageText,
                ["caption"] = messageData.Caption,
                ["mediaMimeType"] = messageData.MediaMimeType,
                ["mediaFileName"] = messageData.MediaFileName
            };

            if (!string.IsNullOrWhiteSpace(messageData.MediaContentBase64))
            {
                payload["media"] = new Dictionary<string, object?>
                {
                    ["mimeType"] = messageData.MediaMimeType,
                    ["fileName"] = messageData.MediaFileName,
                    ["base64"] = messageData.MediaContentBase64
                };
            }

            if (!string.IsNullOrWhiteSpace(messageData.DocumentStructuredJson))
            {
                try
                {
                    payload["document"] = JsonSerializer.Deserialize<JsonElement>(messageData.DocumentStructuredJson);
                }
                catch
                {
                    payload["documentJson"] = messageData.DocumentStructuredJson;
                }
            }
            else if (!string.IsNullOrWhiteSpace(messageData.DocumentPlainText))
            {
                payload["documentText"] = messageData.DocumentPlainText;
            }

            return payload;
        }

        private object BuildFallbackProcessVariablePayload(WhatsAppMessageData messageData)
        {
            var raw = BuildRawMessagePayload(messageData);
            var cleaned = new Dictionary<string, object?>();
            foreach (var kv in raw)
            {
                if (kv.Value is null)
                {
                    continue;
                }

                if (kv.Value is string s && string.IsNullOrWhiteSpace(s))
                {
                    continue;
                }

                cleaned[kv.Key] = kv.Value;
            }

            return cleaned;
        }

        private string? GetFileExtensionFromMimeType(string? mimeType)
        {
            if (string.IsNullOrWhiteSpace(mimeType))
            {
                return null;
            }

            mimeType = mimeType.Trim().ToLowerInvariant();

            return mimeType switch
            {
                "image/png" => ".png",
                "image/jpeg" or "image/jpg" => ".jpg",
                "image/gif" => ".gif",
                "image/webp" => ".webp",
                "application/pdf" => ".pdf",
                "application/msword" => ".doc",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => ".docx",
                "application/vnd.ms-excel" => ".xls",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => ".xlsx",
                "application/vnd.ms-powerpoint" => ".ppt",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" => ".pptx",
                "text/plain" => ".txt",
                "application/octet-stream" => ".bin",
                _ => null
            };
        }

        private class DownloadedMedia
        {
            public byte[] Content { get; }
            public string? MimeType { get; }
            public string? FileName { get; }

            public DownloadedMedia(byte[] content, string? mimeType, string? fileName)
            {
                Content = content;
                MimeType = mimeType;
                FileName = fileName;
            }
        }
    }
}
