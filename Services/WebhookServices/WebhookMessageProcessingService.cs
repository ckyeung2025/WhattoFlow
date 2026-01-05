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

                // 檢查是否是 Flow 狀態變更等非訊息事件
                if (value.TryGetProperty("event", out var eventProperty))
                {
                    var eventType = eventProperty.GetString();
                    _loggingService.LogInformation($"檢測到非訊息事件: {eventType}");
                    
                    // 如果是 FLOW_STATUS_CHANGE 或其他非訊息事件，直接返回 null
                    if (eventType == "FLOW_STATUS_CHANGE" || 
                        eventType == "FLOW_PUBLISHED" || 
                        eventType == "FLOW_UNPUBLISHED" ||
                        eventType == "FLOW_DELETED")
                    {
                        _loggingService.LogInformation($"跳過處理非訊息事件: {eventType}");
                        return null; // 返回 null 表示這是非訊息事件，不需要處理
                    }
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
                string contextFrom = null;
                string contextId = null;
                
                if (value.TryGetProperty("messages", out var messages))
                {
                    _loggingService.LogInformation($"找到訊息數據，數量: {messages.GetArrayLength()}");
                    var message = messages[0];
                    messageId = message.GetProperty("id").GetString();
                    _loggingService.LogInformation($"提取到訊息ID: {messageId}");
                    
                    // 提取 context（用於 Flow 回覆關聯）
                    if (message.TryGetProperty("context", out var context))
                    {
                        if (context.TryGetProperty("from", out var contextFromProp))
                        {
                            contextFrom = contextFromProp.GetString();
                            _loggingService.LogInformation($"提取到 context.from: {contextFrom}");
                        }
                        if (context.TryGetProperty("id", out var contextIdProp))
                        {
                            contextId = contextIdProp.GetString();
                            _loggingService.LogInformation($"提取到 context.id: {contextId}");
                        }
                    }
                    
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
                            else if (interactiveType == "nfm_reply")
                            {
                                // Flow 回覆檢測
                                if (interactive.TryGetProperty("nfm_reply", out var nfmReply))
                                {
                                    var nfmName = nfmReply.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
                                    if (nfmName == "flow")
                                    {
                                        _loggingService.LogInformation($"✅ 檢測到 Flow 回覆 (nfm_reply)");
                                        
                                        // 提取 response_json（JSON 字符串）
                                        if (nfmReply.TryGetProperty("response_json", out var responseJsonProp))
                                        {
                                            var responseJsonString = responseJsonProp.GetString();
                                            _loggingService.LogInformation($"提取到 response_json: {responseJsonString?.Substring(0, Math.Min(200, responseJsonString?.Length ?? 0))}...");
                                            
                                            // 將 response_json 保存到 messageText（臨時，後續會解析）
                                            messageText = responseJsonString;
                                            messageType = "flow_response"; // 設置特殊類型標識
                                        }
                                        
                                        // 提取 context（如果存在）
                                        // 注意：context 在 messages 層級，不在 interactive 層級
                                    }
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
                    MediaFileName = mediaFileName,
                    ContextFrom = contextFrom,
                    ContextId = contextId
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
            // 檢查是否是 Flow 回覆
            if (messageData.MessageType == "flow_response")
            {
                _loggingService.LogInformation($"✅ 檢測到 Flow 回覆消息");
                return await HandleFlowResponseAsync(company, messageData);
            }

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

                // 保存驗證記錄
                if (validationResult.ProcessedData is string processedText)
                {
                    validation.ProcessedData = processedText;
                }
                else if (validationResult.ProcessedData != null)
                {
                    validation.ProcessedData = JsonSerializer.Serialize(validationResult.ProcessedData);
                }
                _context.MessageValidations.Add(validation);
                await _context.SaveChangesAsync();

                // 獲取節點信息以發送正確的訊息
                var nodeInfo = await GetWaitReplyNodeInfo(execution, stepExecution);
                
                // 使用公共方法處理 AI 驗證結果
                var shouldAbort = await ProcessAiValidationResultAsync(
                    validationResult,
                    execution,
                    stepExecution,
                    messageData,
                    fallbackText: messageData.MessageText,
                    onValidationFailed: async (result) =>
                    {
                        // 驗證失敗，發送錯誤訊息並保持等待狀態
                        if (nodeInfo != null)
                        {
                            // 使用節點配置的錯誤訊息
                            await SendWaitReplyMessageAsync(company, execution, messageData.WaId, nodeInfo, false);
                        }
                        else
                        {
                            // 回退到默認錯誤訊息
                            var menuSettings = WhatsAppMenuSettings.FromCompany(company);
                            var errorMessage = result.ErrorMessage ?? menuSettings.InputErrorMessage;
                            await SendWhatsAppMessage(company, messageData.WaId, errorMessage);
                        }
                        _loggingService.LogInformation($"驗證失敗，保持等待狀態");
                        return true; // 中斷處理
                    });

                if (shouldAbort)
                {
                    return; // 驗證失敗，已發送 retry 訊息，保持等待狀態
                }

                // 驗證通過，發送成功訊息並繼續執行流程
                _loggingService.LogInformation($"驗證通過，繼續執行流程");
                
                // 發送成功訊息（如果配置了）
                if (nodeInfo != null)
                {
                    _loggingService.LogInformation($"發送 Wait Reply 成功訊息");
                    await SendWaitReplyMessageAsync(company, execution, messageData.WaId, nodeInfo, true);
                }
                else
                {
                    _loggingService.LogWarning($"無法獲取 Wait Reply 節點信息，跳過成功訊息發送");
                }
                
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
                // ✅ 修復：傳遞 formInstanceId 確保找到正確的 sendEForm 節點
                await _workflowEngine.ContinueWorkflowFromWaitReply(execution, null, formInstanceId);

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
                
                // ✅ 簡化：完全依賴 aiIsActive，與 waitReply 節點保持一致
                // 優先使用 aiIsActive，如果為 null 則回退到檢查 validatorType（向後兼容）
                var hasAiValidation = nodeInfo.Validation != null && 
                                     (nodeInfo.Validation.AiIsActive == true || 
                                      (nodeInfo.Validation.AiIsActive == null && 
                                       nodeInfo.Validation.Enabled == true && 
                                       !string.IsNullOrWhiteSpace(nodeInfo.Validation.ValidatorType) &&
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
                                    // ✅ 修改：當使用 AdditionalData 時，只提取 ai 部分，排除 original（包含 base64）
                                    valueToStore = ExtractAiResultFromAdditionalData(validationResult.AdditionalData) 
                                        ?? qrCodeValue;
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
                execution.WaitingForUser = null; // ✅ 修復：清除 WaitingForUser，避免影響後續 waitReply 節點
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
        /// 從工作流程定義中獲取 waitReply 節點信息
        /// </summary>
        /// <param name="execution">流程執行記錄</param>
        /// <param name="stepExecution">步驟執行記錄</param>
        /// <returns>節點信息</returns>
        private async Task<WaitReplyNodeInfo> GetWaitReplyNodeInfo(WorkflowExecution execution, WorkflowStepExecution stepExecution)
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
                    // ✅ 修復：根據 stepExecution 的 TaskName 來匹配正確的節點
                    // 如果流程中有多個 waitReply 節點，需要找到當前正在等待的那個
                    WorkflowNode waitReplyNode = null;
                    
                    if (stepExecution != null && !string.IsNullOrEmpty(stepExecution.TaskName))
                    {
                        // 優先通過 TaskName 匹配
                        waitReplyNode = flowData.Nodes.FirstOrDefault(n => 
                            (n.Data?.Type == "waitReply" || n.Data?.Type == "waitForUserReply") &&
                            n.Data?.TaskName == stepExecution.TaskName);
                    }
                    
                    // 如果 TaskName 匹配失敗，嘗試通過 StepType 匹配
                    if (waitReplyNode == null && stepExecution != null && !string.IsNullOrEmpty(stepExecution.StepType))
                    {
                        waitReplyNode = flowData.Nodes.FirstOrDefault(n => 
                            (n.Data?.Type == "waitReply" || n.Data?.Type == "waitForUserReply") &&
                            (n.Data?.Type == stepExecution.StepType || 
                             (stepExecution.StepType == "waitReply" && n.Data?.Type == "waitForUserReply") ||
                             (stepExecution.StepType == "waitForUserReply" && n.Data?.Type == "waitReply")));
                    }
                    
                    // 如果還是找不到，使用第一個 waitReply 節點（向後兼容）
                    if (waitReplyNode == null)
                    {
                        waitReplyNode = flowData.Nodes.FirstOrDefault(n => 
                            n.Data?.Type == "waitReply" || n.Data?.Type == "waitForUserReply");
                    }
                    
                    if (waitReplyNode != null)
                    {
                        return new WaitReplyNodeInfo
                        {
                            NodeId = waitReplyNode.Id,
                            WaitReplySuccessMessage = waitReplyNode.Data?.WaitReplySuccessMessage,
                            WaitReplySuccessMessageMode = waitReplyNode.Data?.WaitReplySuccessMessageMode ?? "direct",
                            WaitReplySuccessTemplateId = waitReplyNode.Data?.WaitReplySuccessTemplateId,
                            WaitReplySuccessTemplateName = waitReplyNode.Data?.WaitReplySuccessTemplateName,
                            WaitReplySuccessIsMetaTemplate = waitReplyNode.Data?.WaitReplySuccessIsMetaTemplate ?? false,
                            WaitReplySuccessTemplateLanguage = waitReplyNode.Data?.WaitReplySuccessTemplateLanguage,
                            WaitReplySuccessTemplateVariables = waitReplyNode.Data?.WaitReplySuccessTemplateVariables,
                            WaitReplyErrorMessage = waitReplyNode.Data?.WaitReplyErrorMessage,
                            WaitReplyErrorMessageMode = waitReplyNode.Data?.WaitReplyErrorMessageMode ?? "direct",
                            WaitReplyErrorTemplateId = waitReplyNode.Data?.WaitReplyErrorTemplateId,
                            WaitReplyErrorTemplateName = waitReplyNode.Data?.WaitReplyErrorTemplateName,
                            WaitReplyErrorIsMetaTemplate = waitReplyNode.Data?.WaitReplyErrorIsMetaTemplate ?? false,
                            WaitReplyErrorTemplateLanguage = waitReplyNode.Data?.WaitReplyErrorTemplateLanguage,
                            WaitReplyErrorTemplateVariables = waitReplyNode.Data?.WaitReplyErrorTemplateVariables,
                            Validation = waitReplyNode.Data?.Validation
                        };
                    }
                }
                
                return null;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 waitReply 節點信息時發生錯誤: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 獲取 sendEForm 節點信息
        /// </summary>
        private async Task<SendEFormNodeInfo> GetSendEFormNodeInfo(WorkflowExecution execution, int? stepExecutionId)
        {
            try
            {
                if (execution.WorkflowDefinition == null || string.IsNullOrEmpty(execution.WorkflowDefinition.Json))
                {
                    return null;
                }
                
                // 先處理 maxRetries 字段（可能為字符串），轉換為整數
                string processedJson = execution.WorkflowDefinition.Json;
                try
                {
                    using var doc = JsonDocument.Parse(execution.WorkflowDefinition.Json);
                    var root = doc.RootElement;
                    
                    if (root.TryGetProperty("nodes", out var nodesElement))
                    {
                        var nodesList = new List<System.Text.Json.Nodes.JsonNode>();
                        foreach (var node in nodesElement.EnumerateArray())
                        {
                            var nodeJson = node.GetRawText();
                            var nodeObj = System.Text.Json.Nodes.JsonNode.Parse(nodeJson);
                            
                            // 遞歸處理 maxRetries 字段
                            ProcessMaxRetriesField(nodeObj);
                            
                            nodesList.Add(nodeObj);
                        }
                        
                        var newRoot = new System.Text.Json.Nodes.JsonObject();
                        newRoot["nodes"] = new System.Text.Json.Nodes.JsonArray(nodesList.ToArray());
                        
                        if (root.TryGetProperty("edges", out var edgesElement))
                        {
                            newRoot["edges"] = System.Text.Json.Nodes.JsonNode.Parse(edgesElement.GetRawText());
                        }
                        
                        processedJson = newRoot.ToJsonString();
                    }
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"處理 maxRetries 字段時發生錯誤，使用原始 JSON: {ex.Message}");
                    // 如果處理失敗，使用原始 JSON
                }
                
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var flowData = JsonSerializer.Deserialize<WorkflowGraph>(processedJson, options);
                
                if (flowData?.Nodes != null)
                {
                    WorkflowNode sendEFormNode = null;
                    
                    // 如果提供了 stepExecutionId，嘗試通過它查找對應的節點
                    if (stepExecutionId.HasValue)
                    {
                        var stepExecution = await _context.WorkflowStepExecutions
                            .FirstOrDefaultAsync(s => s.Id == stepExecutionId.Value);
                        
                        if (stepExecution != null && !string.IsNullOrEmpty(stepExecution.TaskName))
                        {
                            // 通過 TaskName 匹配
                            sendEFormNode = flowData.Nodes.FirstOrDefault(n => 
                                n.Data?.Type == "sendEForm" &&
                                n.Data?.TaskName == stepExecution.TaskName);
                        }
                    }
                    
                    // 如果還是找不到，使用第一個 sendEForm 節點
                    if (sendEFormNode == null)
                    {
                        sendEFormNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "sendEForm");
                    }
                    
                    if (sendEFormNode != null)
                    {
                        // 動態讀取 FormType（因為它可能是動態屬性）
                        // 直接從原始 JSON 中讀取，而不是從反序列化後的對象中讀取
                        string formType = null;
                        string sendEFormMode = sendEFormNode.Data?.SendEFormMode;
                        
                        // 嘗試從原始 JSON 中讀取 FormType
                        try
                        {
                            using var doc = JsonDocument.Parse(processedJson);
                            var root = doc.RootElement;
                            
                            if (root.TryGetProperty("nodes", out var nodesElement))
                            {
                                foreach (var node in nodesElement.EnumerateArray())
                                {
                                    if (node.TryGetProperty("id", out var idElement) && idElement.GetString() == sendEFormNode.Id)
                                    {
                                        // 找到對應的節點，讀取 data 屬性
                                        if (node.TryGetProperty("data", out var dataElement))
                                        {
                                            // 嘗試讀取 FormType（支持 camelCase 和 PascalCase）
                                            if (dataElement.TryGetProperty("formType", out var formTypeProp))
                                            {
                                                formType = formTypeProp.GetString();
                                            }
                                            else if (dataElement.TryGetProperty("FormType", out formTypeProp))
                                            {
                                                formType = formTypeProp.GetString();
                                            }
                                            else
                                            {
                                                // 嘗試大小寫不敏感匹配
                                                foreach (var prop in dataElement.EnumerateObject())
                                                {
                                                    if (string.Equals(prop.Name, "formType", StringComparison.OrdinalIgnoreCase))
                                                    {
                                                        formType = prop.Value.GetString();
                                                        break;
                                                    }
                                                }
                                            }
                                            
                                            // 如果 sendEFormMode 為空，也從原始 JSON 中讀取
                                            if (string.IsNullOrEmpty(sendEFormMode))
                                            {
                                                if (dataElement.TryGetProperty("sendEFormMode", out var sendEFormModeProp))
                                                {
                                                    sendEFormMode = sendEFormModeProp.GetString();
                                                }
                                                else if (dataElement.TryGetProperty("SendEFormMode", out sendEFormModeProp))
                                                {
                                                    sendEFormMode = sendEFormModeProp.GetString();
                                                }
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogWarning($"讀取 FormType 時發生錯誤: {ex.Message}");
                        }
                        
                        _loggingService.LogInformation($"🔍 [DEBUG] GetSendEFormNodeInfo - NodeId: {sendEFormNode.Id}, SendEFormMode: {sendEFormMode}, FormType: {formType}");
                        
                        return new SendEFormNodeInfo
                        {
                            NodeId = sendEFormNode.Id,
                            SendEFormMode = sendEFormMode,
                            FormType = formType,
                            Validation = sendEFormNode.Data?.Validation
                        };
                    }
                }
                
                return null;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 sendEForm 節點信息時發生錯誤: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 發送 Wait Reply 訊息（支持模板和直接訊息）
        /// </summary>
        private async Task SendWaitReplyMessageAsync(
            Company company, 
            WorkflowExecution execution,
            string waId, 
            WaitReplyNodeInfo nodeInfo,
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
                    messageMode = nodeInfo.WaitReplySuccessMessageMode ?? "direct";
                    message = nodeInfo.WaitReplySuccessMessage;
                    templateId = nodeInfo.WaitReplySuccessTemplateId;
                    templateName = nodeInfo.WaitReplySuccessTemplateName;
                    isMetaTemplate = nodeInfo.WaitReplySuccessIsMetaTemplate;
                    templateLanguage = nodeInfo.WaitReplySuccessTemplateLanguage;
                    templateVariables = nodeInfo.WaitReplySuccessTemplateVariables;
                }
                else
                {
                    messageMode = nodeInfo.WaitReplyErrorMessageMode ?? "direct";
                    message = nodeInfo.WaitReplyErrorMessage;
                    templateId = nodeInfo.WaitReplyErrorTemplateId;
                    templateName = nodeInfo.WaitReplyErrorTemplateName;
                    isMetaTemplate = nodeInfo.WaitReplyErrorIsMetaTemplate;
                    templateLanguage = nodeInfo.WaitReplyErrorTemplateLanguage;
                    templateVariables = nodeInfo.WaitReplyErrorTemplateVariables;
                }

                // 如果沒有配置訊息，不發送
                if ((messageMode == "direct" && string.IsNullOrEmpty(message)) ||
                    (messageMode == "template" && string.IsNullOrEmpty(templateName)))
                {
                    _loggingService.LogInformation($"Wait Reply {(isSuccessMessage ? "成功" : "錯誤")}訊息未配置，跳過發送");
                    return;
                }
                
                _loggingService.LogInformation($"準備發送 Wait Reply {(isSuccessMessage ? "成功" : "錯誤")}訊息，模式: {messageMode}");

                if (messageMode == "template" && !string.IsNullOrEmpty(templateName))
                {
                    _loggingService.LogInformation($"📝 Wait Reply {(isSuccessMessage ? "成功" : "錯誤")}訊息使用模板模式: {templateName}");
                    
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
                    if (!string.IsNullOrEmpty(message))
                    {
                        // 替換流程變數
                        using var scope = _serviceProvider.CreateScope();
                        var variableReplacementService = scope.ServiceProvider.GetRequiredService<IVariableReplacementService>();
                        var processedMessage = await variableReplacementService.ReplaceVariablesAsync(message, execution.Id);
                        await SendWhatsAppMessage(company, waId, processedMessage);
                    }
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 Wait Reply {(isSuccessMessage ? "成功" : "錯誤")}訊息失敗: {ex.Message}", ex);
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

        private class WaitReplyNodeInfo
        {
            public string NodeId { get; set; }
            public string WaitReplySuccessMessage { get; set; }
            public string WaitReplySuccessMessageMode { get; set; }
            public string WaitReplySuccessTemplateId { get; set; }
            public string WaitReplySuccessTemplateName { get; set; }
            public bool WaitReplySuccessIsMetaTemplate { get; set; }
            public string WaitReplySuccessTemplateLanguage { get; set; }
            public List<object> WaitReplySuccessTemplateVariables { get; set; }
            public string WaitReplyErrorMessage { get; set; }
            public string WaitReplyErrorMessageMode { get; set; }
            public string WaitReplyErrorTemplateId { get; set; }
            public string WaitReplyErrorTemplateName { get; set; }
            public bool WaitReplyErrorIsMetaTemplate { get; set; }
            public string WaitReplyErrorTemplateLanguage { get; set; }
            public List<object> WaitReplyErrorTemplateVariables { get; set; }
            public WorkflowValidation Validation { get; set; }
        }

        private class SendEFormNodeInfo
        {
            public string NodeId { get; set; }
            public string SendEFormMode { get; set; }
            public string FormType { get; set; }
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

        /// <summary>
        /// 處理 AI 驗證結果的通用方法（保存結果、寫入流程變量、處理驗證失敗）
        /// </summary>
        /// <param name="validationResult">AI 驗證結果</param>
        /// <param name="execution">工作流程執行記錄</param>
        /// <param name="stepExecution">步驟執行記錄</param>
        /// <param name="messageData">消息數據（用於構建流程變量值）</param>
        /// <param name="fallbackText">當 ProcessedData 為空時使用的後備文本</param>
        /// <param name="onValidationFailed">驗證失敗時的回調函數（返回是否應該中斷處理）</param>
        /// <returns>如果驗證失敗且應該中斷處理，返回 true；否則返回 false</returns>
        private async Task<bool> ProcessAiValidationResultAsync(
            ValidationResult validationResult,
            WorkflowExecution execution,
            WorkflowStepExecution? stepExecution,
            WhatsAppMessageData messageData,
            string? fallbackText = null,
            Func<ValidationResult, Task<bool>>? onValidationFailed = null)
        {
            // 1. 保存 AI 結果到 stepExecution
            if (stepExecution != null && validationResult.AdditionalData != null)
            {
                try
                {
                    var aiResultJson = JsonSerializer.Serialize(validationResult.AdditionalData, PayloadJsonOptions);
                    stepExecution.AiResultJson = aiResultJson;
                    await _context.SaveChangesAsync();
                    
                    // ✅ 記錄 AdditionalData 的完整內容（用於調試）
                    var aiResultPreview = aiResultJson.Length > 3000 
                        ? aiResultJson.Substring(0, 3000) + "... (截斷，完整長度: " + aiResultJson.Length + ")" 
                        : aiResultJson;
                    _loggingService.LogInformation($"📄 保存到 stepExecution.AiResultJson 的完整內容: {aiResultPreview}");
                }
                catch (Exception serializeEx)
                {
                    _loggingService.LogError($"序列化 AI 結果失敗: {serializeEx.Message}");
                }
            }

            // 2. 處理驗證失敗
            if (!validationResult.IsValid)
            {
                if (onValidationFailed != null)
                {
                    var shouldAbort = await onValidationFailed(validationResult);
                    if (shouldAbort)
                    {
                        return true; // 中斷處理
                    }
                }
                return false; // 不中斷，繼續處理
            }

            // 3. 驗證通過，寫入流程變量
            if (!string.IsNullOrWhiteSpace(validationResult.TargetProcessVariable))
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var processVariableService = scope.ServiceProvider.GetRequiredService<IProcessVariableService>();

                    // ✅ 優先從 AdditionalData 提取 AI 分析結果（即使 ProcessedData 有值，也優先使用 AI 結果）
                    _loggingService.LogInformation($"🔍 開始從 AdditionalData 提取 AI 分析結果...");
                    if (validationResult.AdditionalData != null)
                    {
                        try
                        {
                            var additionalDataPreview = JsonSerializer.Serialize(validationResult.AdditionalData, PayloadJsonOptions);
                            var preview = additionalDataPreview.Length > 2000 
                                ? additionalDataPreview.Substring(0, 2000) + "... (截斷，完整長度: " + additionalDataPreview.Length + ")" 
                                : additionalDataPreview;
                            _loggingService.LogInformation($"📄 AdditionalData 完整內容: {preview}");
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogWarning($"無法序列化 AdditionalData 用於日誌: {ex.Message}");
                        }
                    }
                    
                    object? valueToStore = ExtractAiResultFromAdditionalData(validationResult.AdditionalData);
                    
                    // 如果 AdditionalData 中沒有 AI 結果，再使用 ProcessedData、SuggestionMessage 等
                    if (valueToStore == null || (valueToStore is string valueStr && string.IsNullOrWhiteSpace(valueStr)))
                    {
                        valueToStore = validationResult.ProcessedData ?? validationResult.SuggestionMessage ?? fallbackText ?? messageData.MessageText;
                        
                        // 如果還是 null 或空，使用 BuildFallbackProcessVariablePayload
                        if (valueToStore == null || (valueToStore is string fallbackStr && string.IsNullOrWhiteSpace(fallbackStr)))
                        {
                            valueToStore = BuildFallbackProcessVariablePayload(messageData);
                        }
                    }

                    // ✅ 檢查流程變量的數據類型，並進行適當的轉換
                    var variableDefinition = await _context.ProcessVariableDefinitions
                        .FirstOrDefaultAsync(p => p.WorkflowDefinitionId == execution.WorkflowDefinitionId
                            && p.VariableName == validationResult.TargetProcessVariable);
                    
                    var dataType = variableDefinition?.DataType?.ToLower() ?? "text";
                    _loggingService.LogInformation($"📋 流程變量 '{validationResult.TargetProcessVariable}' 的數據類型: {dataType}");
                    
                    // 如果數據類型是 json，確保值是有效的 JSON
                    if (dataType == "json")
                    {
                        if (valueToStore is string strValue)
                        {
                            // 檢查是否已經是有效的 JSON
                            try
                            {
                                JsonSerializer.Deserialize<object>(strValue);
                                // 已經是有效的 JSON，直接使用
                                _loggingService.LogInformation($"✅ 值已經是有效的 JSON 格式");
                            }
                            catch
                            {
                                // 不是有效的 JSON，包裝成 JSON 字符串
                                valueToStore = JsonSerializer.Serialize(strValue, PayloadJsonOptions);
                                _loggingService.LogInformation($"✅ 將純文本字符串包裝為 JSON 字符串");
                            }
                        }
                        else if (valueToStore != null)
                        {
                            // 如果不是字符串，序列化為 JSON
                            valueToStore = JsonSerializer.Serialize(valueToStore, PayloadJsonOptions);
                            _loggingService.LogInformation($"✅ 將對象序列化為 JSON 字符串");
                        }
                    }
                    else if (valueToStore != null && valueToStore is not string)
                    {
                        // 其他數據類型，如果不是字符串，轉換為字符串
                        valueToStore = valueToStore.ToString();
                    }

                    var valueLength = valueToStore is string finalStr ? finalStr.Length : valueToStore?.ToString()?.Length ?? 0;
                    _loggingService.LogInformation($"📝 準備寫入流程變量 '{validationResult.TargetProcessVariable}'，數據類型: {dataType}，值類型: {valueToStore?.GetType().Name ?? "null"}，值長度: {valueLength}");

                    await processVariableService.SetVariableValueAsync(
                        execution.Id,
                        validationResult.TargetProcessVariable,
                        valueToStore ?? string.Empty,
                        setBy: "AIValidator",
                        sourceType: "AIValidation",
                        sourceReference: execution.Id.ToString()
                    );

                    _loggingService.LogInformation($"✅ AI 驗證通過，結果寫入流程變量: {validationResult.TargetProcessVariable}");
                }
                catch (Exception pvEx)
                {
                    // 重新計算 valueToStore 用於錯誤日誌
                    object? errorValueToStore = validationResult.ProcessedData ?? validationResult.SuggestionMessage ?? fallbackText ?? messageData.MessageText;
                    if (errorValueToStore == null || (errorValueToStore is string s && string.IsNullOrWhiteSpace(s)))
                    {
                        errorValueToStore = ExtractAiResultFromAdditionalData(validationResult.AdditionalData) 
                            ?? BuildFallbackProcessVariablePayload(messageData);
                    }
                    if (errorValueToStore != null && errorValueToStore is not string)
                    {
                        errorValueToStore = JsonSerializer.Serialize(errorValueToStore, PayloadJsonOptions);
                    }

                    var errorValuePreview = errorValueToStore is string errorStr 
                        ? errorStr.Substring(0, Math.Min(200, errorStr.Length)) 
                        : errorValueToStore?.ToString()?.Substring(0, Math.Min(200, errorValueToStore.ToString()?.Length ?? 0)) ?? "null";
                    
                    _loggingService.LogError($"❌ AI 驗證結果寫入流程變量失敗: {pvEx.Message}", pvEx);
                    _loggingService.LogError($"   流程變量名稱: {validationResult.TargetProcessVariable}");
                    _loggingService.LogError($"   值類型: {errorValueToStore?.GetType().Name ?? "null"}");
                    _loggingService.LogError($"   值預覽: {errorValuePreview}");
                }
            }

            return false; // 不中斷，繼續處理
        }

        /// <summary>
        /// 從 AdditionalData 中提取 AI 分析結果（只提取 ai 部分，排除 original 部分以避免包含 base64）
        /// </summary>
        private object? ExtractAiResultFromAdditionalData(object? additionalData)
        {
            if (additionalData == null)
            {
                _loggingService.LogWarning("AdditionalData 為 null，無法提取 AI 結果");
                return null;
            }

            try
            {
                // ✅ 統一處理：先序列化為字符串，然後解析（避免 JsonDocument 被過早釋放）
                string serialized;
                if (additionalData is JsonElement jsonElement)
                {
                    serialized = jsonElement.GetRawText();
                    _loggingService.LogInformation($"✅ AdditionalData 是 JsonElement，序列化後長度: {serialized.Length}");
                }
                else
                {
                    serialized = JsonSerializer.Serialize(additionalData, PayloadJsonOptions);
                    _loggingService.LogInformation($"✅ AdditionalData 序列化後長度: {serialized.Length}");
                }
                
                // 使用 JsonDocument 解析，但在 using 塊內完成所有操作
                using var doc = JsonDocument.Parse(serialized);
                var root = doc.RootElement;
                
                // ✅ 記錄 ai 元素的完整內容（用於調試）
                if (root.TryGetProperty("ai", out var aiElement))
                {
                    // 在 using 塊內提取所有需要的值
                    string? processedValue = null;
                    string? rawValue = null;
                    string? fullAiJson = null;
                    
                    var aiJson = aiElement.GetRawText();
                    var aiPreview = aiJson.Length > 2000 
                        ? aiJson.Substring(0, 2000) + "... (截斷，完整長度: " + aiJson.Length + ")" 
                        : aiJson;
                    _loggingService.LogInformation($"📄 AdditionalData.ai 完整內容: {aiPreview}");
                    
                    // 優先使用 ai.processed（如果存在且非空）
                    if (aiElement.TryGetProperty("processed", out var processedElement) && 
                        processedElement.ValueKind != JsonValueKind.Null)
                    {
                        // ✅ 處理 processed 可能是字符串或對象的情況
                        if (processedElement.ValueKind == JsonValueKind.String)
                        {
                            processedValue = processedElement.GetString();
                        }
                        else
                        {
                            // 如果是對象，序列化為 JSON 字符串
                            processedValue = processedElement.GetRawText();
                        }
                        
                        if (!string.IsNullOrWhiteSpace(processedValue))
                        {
                            var processedPreview = processedValue.Length > 1000 
                                ? processedValue.Substring(0, 1000) + "... (截斷，完整長度: " + processedValue.Length + ")" 
                                : processedValue;
                            _loggingService.LogInformation($"✅ 從 AdditionalData.ai.processed 提取到結果，長度: {processedValue?.Length ?? 0}");
                            _loggingService.LogInformation($"📄 ai.processed 內容: {processedPreview}");
                            return processedValue; // 在 using 塊內返回
                        }
                    }
                    else
                    {
                        _loggingService.LogInformation($"ℹ️ ai.processed 不存在或為空，嘗試使用 ai.raw");
                    }
                    
                    // 如果 processed 為空，嘗試使用 ai.raw（AI 的原始響應）
                    if (aiElement.TryGetProperty("raw", out var rawElement) && 
                        rawElement.ValueKind != JsonValueKind.Null &&
                        !string.IsNullOrWhiteSpace(rawElement.GetString()))
                    {
                        rawValue = rawElement.GetString();
                        var rawPreview = rawValue.Length > 2000 
                            ? rawValue.Substring(0, 2000) + "... (截斷，完整長度: " + rawValue.Length + ")" 
                            : rawValue;
                        _loggingService.LogInformation($"✅ 從 AdditionalData.ai.raw 提取到結果，長度: {rawValue?.Length ?? 0}");
                        _loggingService.LogInformation($"📄 ai.raw 內容: {rawPreview}");
                        return rawValue; // 在 using 塊內返回
                    }
                    else
                    {
                        _loggingService.LogInformation($"ℹ️ ai.raw 不存在或為空，使用整個 ai 對象");
                    }
                    
                    // 如果都沒有，使用整個 ai 對象（不包含 original）
                    fullAiJson = aiElement.GetRawText();
                    var fullAiPreview = fullAiJson.Length > 2000 
                        ? fullAiJson.Substring(0, 2000) + "... (截斷，完整長度: " + fullAiJson.Length + ")" 
                        : fullAiJson;
                    _loggingService.LogInformation($"✅ 從 AdditionalData.ai 提取到完整對象，長度: {fullAiJson?.Length ?? 0}");
                    _loggingService.LogInformation($"📄 ai 完整對象內容: {fullAiPreview}");
                    return fullAiJson; // 在 using 塊內返回
                }
                else
                {
                    // 如果沒有 ai 屬性，記錄完整的 root 結構以便調試
                    var rootJson = root.GetRawText();
                    var rootPreview = rootJson.Length > 1000 
                        ? rootJson.Substring(0, 1000) + "... (截斷)" 
                        : rootJson;
                    _loggingService.LogWarning($"AdditionalData 中沒有找到 ai 屬性，跳過以避免包含 base64");
                    _loggingService.LogWarning($"📄 AdditionalData 根結構: {rootPreview}");
                    return null;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"從 AdditionalData 提取 ai 部分失敗: {ex.Message}，返回 null 以避免包含 base64");
                _loggingService.LogError($"提取失敗的詳細錯誤: {ex}", ex);
                return null;
            }
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

        /// <summary>
        /// 處理 Flow 回覆
        /// </summary>
        /// <param name="company">公司信息</param>
        /// <param name="messageData">消息數據（包含 Flow 回覆）</param>
        /// <returns>處理結果</returns>
        private async Task<object> HandleFlowResponseAsync(Company company, WhatsAppMessageData messageData)
        {
            try
            {
                _loggingService.LogInformation($"=== 處理 Flow 回覆開始 ===");
                _loggingService.LogInformation($"用戶 WhatsApp 號碼: {messageData.WaId}");
                _loggingService.LogInformation($"消息 ID: {messageData.MessageId}");
                _loggingService.LogInformation($"Context ID: {messageData.ContextId}");
                _loggingService.LogInformation($"Context From: {messageData.ContextFrom}");

                // 解析 response_json（JSON 字符串）
                if (string.IsNullOrEmpty(messageData.MessageText))
                {
                    _loggingService.LogWarning("Flow 回覆缺少 response_json");
                    return new { success = false, message = "Flow response missing response_json" };
                }

                Dictionary<string, object> flowResponseData;
                string flowToken = null;
                try
                {
                    flowResponseData = JsonSerializer.Deserialize<Dictionary<string, object>>(messageData.MessageText);
                    if (flowResponseData == null)
                    {
                        _loggingService.LogWarning("無法解析 response_json");
                        return new { success = false, message = "Failed to parse response_json" };
                    }

                    // 提取 flow_token
                    if (flowResponseData.TryGetValue("flow_token", out var tokenObj))
                    {
                        flowToken = tokenObj?.ToString();
                        _loggingService.LogInformation($"提取到 flow_token: {flowToken}");
                    }

                    _loggingService.LogInformation($"Flow 回覆數據包含 {flowResponseData.Count} 個字段");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"解析 response_json 失敗: {ex.Message}");
                    return new { success = false, message = $"Failed to parse response_json: {ex.Message}" };
                }

                // 查找對應的 EFormInstance
                EFormInstance eFormInstance = null;

                // 方法 0（最優先）：通過 flow_token 查找（最準確）
                if (!string.IsNullOrEmpty(flowToken))
                {
                    _loggingService.LogInformation($"嘗試通過 flow_token 查找 EFormInstance: {flowToken}");
                    
                    // 解析 flow_token: WorkflowExecutionId_WorkflowStepExecutionId_EFormInstanceId
                    var tokenParts = flowToken.Split('_');
                    if (tokenParts.Length >= 3)
                    {
                        if (int.TryParse(tokenParts[0], out int workflowExecutionId) && 
                            int.TryParse(tokenParts[1], out int workflowStepExecutionId) &&
                            Guid.TryParse(tokenParts[2], out Guid eFormInstanceId))
                        {
                            _loggingService.LogInformation($"解析 flow_token - WorkflowExecutionId: {workflowExecutionId}, WorkflowStepExecutionId: {workflowStepExecutionId}, EFormInstanceId: {eFormInstanceId}");
                            
                            eFormInstance = await _context.EFormInstances
                                .FirstOrDefaultAsync(e => 
                                    e.Id == eFormInstanceId && 
                                    e.WorkflowExecutionId == workflowExecutionId &&
                                    e.WorkflowStepExecutionId == workflowStepExecutionId &&
                                    e.FillType == "MetaFlows" &&
                                    e.Status == "Pending");
                            
                            if (eFormInstance != null)
                            {
                                _loggingService.LogInformation($"✅ 通過 flow_token 找到 EFormInstance: {eFormInstance.Id}");
                            }
                            else
                            {
                                _loggingService.LogWarning($"⚠️ 通過 flow_token 未找到匹配的 EFormInstance");
                            }
                        }
                        else
                        {
                            _loggingService.LogWarning($"⚠️ flow_token 格式不正確，無法解析: {flowToken}");
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"⚠️ flow_token 格式不正確，部分數量不足: {flowToken}");
                    }
                }

                // 方法 1：通過 context.id 查找（原始消息 ID）- 備用方法
                if (eFormInstance == null && !string.IsNullOrEmpty(messageData.ContextId))
                {
                    _loggingService.LogInformation($"嘗試通過 context.id 查找 EFormInstance: {messageData.ContextId}");
                    
                    // 查找保存了該消息 ID 的 EFormInstance
                    // 注意：我們在發送 Flow 時將消息 ID 保存到 UserMessage 字段
                    eFormInstance = await _context.EFormInstances
                        .FirstOrDefaultAsync(e => 
                            e.UserMessage == messageData.ContextId && 
                            e.FillType == "MetaFlows" &&
                            e.Status == "Pending" &&
                            e.RecipientWhatsAppNo == messageData.WaId);
                    
                    if (eFormInstance != null)
                    {
                        _loggingService.LogInformation($"✅ 通過 context.id 找到 EFormInstance: {eFormInstance.Id}");
                    }
                }

                // 方法 2：通過 WhatsApp 號碼和最近的 WorkflowExecution 查找（最後備用）
                if (eFormInstance == null)
                {
                    _loggingService.LogInformation($"嘗試通過 WhatsApp 號碼查找最近的 EFormInstance");
                    
                    // 查找最近的 MetaFlows 類型的 EFormInstance
                    eFormInstance = await _context.EFormInstances
                        .Where(e => 
                            e.RecipientWhatsAppNo == messageData.WaId &&
                            e.FillType == "MetaFlows" &&
                            e.Status == "Pending")
                        .OrderByDescending(e => e.CreatedAt)
                        .FirstOrDefaultAsync();
                    
                    if (eFormInstance != null)
                    {
                        _loggingService.LogInformation($"✅ 通過 WhatsApp 號碼找到最近的 EFormInstance: {eFormInstance.Id}");
                        
                        // 驗證時間窗口（例如：最近 1 小時內創建的）
                        var timeWindow = DateTime.UtcNow.AddHours(-1);
                        if (eFormInstance.CreatedAt < timeWindow)
                        {
                            _loggingService.LogWarning($"EFormInstance 創建時間過早，可能不是對應的實例");
                            eFormInstance = null;
                        }
                    }
                }

                if (eFormInstance == null)
                {
                    _loggingService.LogWarning($"❌ 找不到對應的 EFormInstance");
                    return new { success = false, message = "EFormInstance not found" };
                }

                _loggingService.LogInformation($"找到 EFormInstance: {eFormInstance.Id}");

                // 獲取對應的 WorkflowStepExecution 以獲取 stepIndex（用於創建 MessageValidation 記錄）
                var stepExecution = await _context.WorkflowStepExecutions
                    .FirstOrDefaultAsync(s => s.Id == eFormInstance.WorkflowStepExecutionId);
                
                int stepIndex = 0;
                if (stepExecution != null)
                {
                    stepIndex = stepExecution.StepIndex;
                    _loggingService.LogInformation($"找到 WorkflowStepExecution，StepIndex: {stepIndex}");
                }
                else
                {
                    _loggingService.LogWarning($"找不到 WorkflowStepExecution (ID: {eFormInstance.WorkflowStepExecutionId})，將使用默認 stepIndex: 0");
                }

                // 先保存完整的原始 JSON 到 FilledHtmlCode（作為 JSON 字符串）
                // 但需要處理 MEDIA_ID：下載媒體並轉換為 base64
                var originalResponseJson = messageData.MessageText; // 這是完整的 response_json 字符串
                
                _loggingService.LogInformation($"保存原始 Flow 回覆 JSON 到 FilledHtmlCode，長度: {originalResponseJson?.Length ?? 0}");
                _loggingService.LogInformation($"原始 JSON 內容: {originalResponseJson?.Substring(0, Math.Min(500, originalResponseJson?.Length ?? 0))}...");

                // 處理 MEDIA_ID：下載媒體並轉換為 base64
                string processedResponseJson = originalResponseJson;
                try
                {
                    if (!string.IsNullOrEmpty(originalResponseJson))
                    {
                        // 解析 JSON
                        var responseJsonElement = JsonSerializer.Deserialize<JsonElement>(originalResponseJson);
                        var responseDict = new Dictionary<string, object>();
                        var hasMediaId = false;

                        // 遍歷所有字段，檢查是否有 MEDIA_ID
                        foreach (var property in responseJsonElement.EnumerateObject())
                        {
                            var fieldName = property.Name;
                            var fieldValue = property.Value;

                            // 跳過 flow_token
                            if (fieldName == "flow_token")
                            {
                                responseDict[fieldName] = fieldValue.GetString();
                                continue;
                            }

                            // 檢查值是否是 MEDIA_ID（可能是字符串，且看起來像 media ID）
                            if (fieldValue.ValueKind == JsonValueKind.String)
                            {
                                var valueString = fieldValue.GetString();
                                
                                // 檢查是否是 MEDIA_ID
                                // 根據 Meta API，MEDIA_ID 通常是純數字（長整數），不應該包含空格、字母或特殊字符
                                // 只有當字符串是純數字且長度合理時，才可能是 MEDIA_ID
                                bool isPossibleMediaId = false;
                                if (!string.IsNullOrEmpty(valueString))
                                {
                                    // MEDIA_ID 應該是純數字（長整數），長度通常在 10-20 位之間
                                    // 不應該包含空格、字母或特殊字符（如 "-"）
                                    if (valueString.All(char.IsDigit) && valueString.Length >= 10 && valueString.Length <= 20)
                                    {
                                        isPossibleMediaId = true;
                                    }
                                }
                                
                                if (isPossibleMediaId)
                                {
                                    // 嘗試下載媒體
                                    _loggingService.LogInformation($"檢測到可能的 MEDIA_ID 字段 '{fieldName}': {valueString}");
                                    
                                    try
                                    {
                                        var downloadedMedia = await DownloadWhatsAppMediaAsync(company, valueString);
                                        if (downloadedMedia != null && downloadedMedia.Content != null && downloadedMedia.Content.Length > 0)
                                        {
                                            // 轉換為 base64
                                            var base64String = Convert.ToBase64String(downloadedMedia.Content);
                                            var mimeType = downloadedMedia.MimeType ?? "image/png";
                                            var dataUrl = $"data:{mimeType};base64,{base64String}";
                                            
                                                    // 保存文件到執行目錄（參考現有的 webhook 功能）
                                                    try
                                                    {
                                                        var executionId = eFormInstance.WorkflowExecutionId;
                                                        if (executionId > 0)
                                                        {
                                                            string savedFilePath = null;
                                                            string messageType = null;
                                                            
                                                            // 根據 MIME 類型判斷是圖片還是文檔
                                                            if (mimeType != null && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                                                            {
                                                                // 保存圖片
                                                                savedFilePath = await SaveWaitReplyImageAsync(
                                                                    executionId, 
                                                                    downloadedMedia.Content, 
                                                                    downloadedMedia.FileName, 
                                                                    mimeType);
                                                                messageType = "image";
                                                                _loggingService.LogInformation($"✅ 已保存圖片到執行目錄: {savedFilePath}");
                                                            }
                                                            else
                                                            {
                                                                // 保存文檔
                                                                savedFilePath = await SaveWaitReplyDocumentAsync(
                                                                    executionId, 
                                                                    downloadedMedia.Content, 
                                                                    downloadedMedia.FileName, 
                                                                    mimeType);
                                                                messageType = "document";
                                                                _loggingService.LogInformation($"✅ 已保存文檔到執行目錄: {savedFilePath}");
                                                            }
                                                            
                                                            // ✅ 創建 MessageValidation 記錄（用於前端匹配步驟名稱）
                                                            if (!string.IsNullOrEmpty(savedFilePath))
                                                            {
                                                                try
                                                                {
                                                                    var validation = new MessageValidation
                                                                    {
                                                                        WorkflowExecutionId = executionId,
                                                                        StepIndex = stepIndex,
                                                                        UserWaId = messageData.WaId,
                                                                        UserMessage = $"[Meta Flows] {fieldName}",
                                                                        MessageType = messageType,
                                                                        MediaId = valueString,
                                                                        MediaUrl = savedFilePath,
                                                                        IsValid = true, // Meta Flows 提交的媒體默認為有效
                                                                        CreatedAt = DateTime.UtcNow
                                                                    };
                                                                    
                                                                    _context.MessageValidations.Add(validation);
                                                                    await _context.SaveChangesAsync();
                                                                    _loggingService.LogInformation($"✅ 已創建 MessageValidation 記錄 - StepIndex: {stepIndex}, MediaUrl: {savedFilePath}");
                                                                }
                                                                catch (Exception validationEx)
                                                                {
                                                                    _loggingService.LogWarning($"⚠️ 創建 MessageValidation 記錄時發生錯誤: {validationEx.Message}");
                                                                }
                                                            }
                                                            
                                                            // 在 JSON 中同時保存文件路徑（可選，用於前端顯示）
                                                            // 這裡我們保存一個包含 base64 和文件路徑的對象
                                                            responseDict[fieldName] = new Dictionary<string, object>
                                                            {
                                                                ["dataUrl"] = dataUrl,
                                                                ["filePath"] = savedFilePath ?? "",
                                                                ["mimeType"] = mimeType,
                                                                ["fileName"] = downloadedMedia.FileName ?? fieldName,
                                                                ["fileSize"] = downloadedMedia.Content.Length
                                                            };
                                                        }
                                                        else
                                                        {
                                                            // 如果沒有 executionId，只保存 base64
                                                            responseDict[fieldName] = dataUrl;
                                                        }
                                                    }
                                                    catch (Exception saveEx)
                                                    {
                                                        // 保存文件失敗，但繼續保存 base64
                                                        _loggingService.LogWarning($"⚠️ 保存媒體文件到目錄時發生錯誤: {saveEx.Message}，將只保存 base64");
                                                        responseDict[fieldName] = dataUrl;
                                                    }
                                            
                                            hasMediaId = true;
                                            
                                            _loggingService.LogInformation($"✅ 成功下載並轉換媒體 '{fieldName}'，大小: {downloadedMedia.Content.Length} bytes, MIME: {mimeType}");
                                        }
                                        else
                                        {
                                            // 下載失敗，保留原始值
                                            responseDict[fieldName] = valueString;
                                            _loggingService.LogWarning($"⚠️ 無法下載媒體 '{fieldName}': {valueString}，保留原始值");
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        // 下載失敗，保留原始值
                                        responseDict[fieldName] = valueString;
                                        _loggingService.LogWarning($"⚠️ 下載媒體 '{fieldName}' 時發生錯誤: {ex.Message}，保留原始值");
                                    }
                                }
                                else
                                {
                                    // 不是 MEDIA_ID，直接保存
                                    responseDict[fieldName] = valueString;
                                }
                            }
                            else if (fieldValue.ValueKind == JsonValueKind.Object)
                            {
                                // 如果是對象（如 {"id": "MEDIA_ID"}），嘗試提取 id
                                if (fieldValue.TryGetProperty("id", out var idProperty))
                                {
                                    var mediaId = idProperty.GetString();
                                    if (!string.IsNullOrEmpty(mediaId))
                                    {
                                        _loggingService.LogInformation($"檢測到對象格式的 MEDIA_ID 字段 '{fieldName}': {mediaId}");
                                        
                                        try
                                        {
                                            var downloadedMedia = await DownloadWhatsAppMediaAsync(company, mediaId);
                                            if (downloadedMedia != null && downloadedMedia.Content != null && downloadedMedia.Content.Length > 0)
                                            {
                                                var base64String = Convert.ToBase64String(downloadedMedia.Content);
                                                var mimeType = downloadedMedia.MimeType ?? "image/png";
                                                var dataUrl = $"data:{mimeType};base64,{base64String}";
                                                
                                                // 保存文件到執行目錄（參考現有的 webhook 功能）
                                                try
                                                {
                                                    var executionId = eFormInstance.WorkflowExecutionId;
                                                    if (executionId > 0)
                                                    {
                                                        string savedFilePath = null;
                                                        string messageType = null;
                                                        
                                                        // 根據 MIME 類型判斷是圖片還是文檔
                                                        if (mimeType != null && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                                                        {
                                                            // 保存圖片
                                                            savedFilePath = await SaveWaitReplyImageAsync(
                                                                executionId, 
                                                                downloadedMedia.Content, 
                                                                downloadedMedia.FileName, 
                                                                mimeType);
                                                            messageType = "image";
                                                            _loggingService.LogInformation($"✅ 已保存圖片到執行目錄: {savedFilePath}");
                                                        }
                                                        else
                                                        {
                                                            // 保存文檔
                                                            savedFilePath = await SaveWaitReplyDocumentAsync(
                                                                executionId, 
                                                                downloadedMedia.Content, 
                                                                downloadedMedia.FileName, 
                                                                mimeType);
                                                            messageType = "document";
                                                            _loggingService.LogInformation($"✅ 已保存文檔到執行目錄: {savedFilePath}");
                                                        }
                                                        
                                                        // ✅ 創建 MessageValidation 記錄（用於前端匹配步驟名稱）
                                                        if (!string.IsNullOrEmpty(savedFilePath))
                                                        {
                                                            try
                                                            {
                                                                var validation = new MessageValidation
                                                                {
                                                                    WorkflowExecutionId = executionId,
                                                                    StepIndex = stepIndex,
                                                                    UserWaId = messageData.WaId,
                                                                    UserMessage = $"[Meta Flows] {fieldName}",
                                                                    MessageType = messageType,
                                                                    MediaId = mediaId,
                                                                    MediaUrl = savedFilePath,
                                                                    IsValid = true, // Meta Flows 提交的媒體默認為有效
                                                                    CreatedAt = DateTime.UtcNow
                                                                };
                                                                
                                                                _context.MessageValidations.Add(validation);
                                                                await _context.SaveChangesAsync();
                                                                _loggingService.LogInformation($"✅ 已創建 MessageValidation 記錄 - StepIndex: {stepIndex}, MediaUrl: {savedFilePath}");
                                                            }
                                                            catch (Exception validationEx)
                                                            {
                                                                _loggingService.LogWarning($"⚠️ 創建 MessageValidation 記錄時發生錯誤: {validationEx.Message}");
                                                            }
                                                        }
                                                        
                                                        // 在 JSON 中同時保存文件路徑（可選，用於前端顯示）
                                                        responseDict[fieldName] = new Dictionary<string, object>
                                                        {
                                                            ["dataUrl"] = dataUrl,
                                                            ["filePath"] = savedFilePath ?? "",
                                                            ["mimeType"] = mimeType,
                                                            ["fileName"] = downloadedMedia.FileName ?? fieldName,
                                                            ["fileSize"] = downloadedMedia.Content.Length
                                                        };
                                                    }
                                                    else
                                                    {
                                                        // 如果沒有 executionId，只保存 base64
                                                        responseDict[fieldName] = dataUrl;
                                                    }
                                                }
                                                catch (Exception saveEx)
                                                {
                                                    // 保存文件失敗，但繼續保存 base64
                                                    _loggingService.LogWarning($"⚠️ 保存媒體文件到目錄時發生錯誤: {saveEx.Message}，將只保存 base64");
                                                    responseDict[fieldName] = dataUrl;
                                                }
                                                
                                                hasMediaId = true;
                                                
                                                _loggingService.LogInformation($"✅ 成功下載並轉換媒體 '{fieldName}'，大小: {downloadedMedia.Content.Length} bytes");
                                            }
                                            else
                                            {
                                                // 下載失敗，保留原始對象
                                                responseDict[fieldName] = JsonSerializer.Deserialize<object>(fieldValue.GetRawText());
                                            }
                                        }
                                        catch (Exception ex)
                                        {
                                            responseDict[fieldName] = JsonSerializer.Deserialize<object>(fieldValue.GetRawText());
                                            _loggingService.LogWarning($"⚠️ 下載媒體 '{fieldName}' 時發生錯誤: {ex.Message}");
                                        }
                                    }
                                    else
                                    {
                                        responseDict[fieldName] = JsonSerializer.Deserialize<object>(fieldValue.GetRawText());
                                    }
                                }
                                else
                                {
                                    // 其他對象，直接序列化
                                    responseDict[fieldName] = JsonSerializer.Deserialize<object>(fieldValue.GetRawText());
                                }
                            }
                            else if (fieldValue.ValueKind == JsonValueKind.Array)
                            {
                                // 如果是數組（如 PhotoPicker），檢查數組元素是否包含 MEDIA_ID
                                var arrayList = new List<object>();
                                var arrayHasMedia = false;
                                
                                foreach (var arrayElement in fieldValue.EnumerateArray())
                                {
                                    if (arrayElement.ValueKind == JsonValueKind.Object)
                                    {
                                        // 檢查數組元素是否包含 id 字段（MEDIA_ID）
                                        if (arrayElement.TryGetProperty("id", out var idProperty))
                                        {
                                            var mediaId = idProperty.ValueKind == JsonValueKind.Number 
                                                ? idProperty.GetInt64().ToString() 
                                                : idProperty.GetString();
                                            
                                            if (!string.IsNullOrEmpty(mediaId))
                                            {
                                                _loggingService.LogInformation($"檢測到數組元素中的 MEDIA_ID 字段 '{fieldName}': {mediaId}");
                                                
                                                try
                                                {
                                                    var downloadedMedia = await DownloadWhatsAppMediaAsync(company, mediaId);
                                                    if (downloadedMedia != null && downloadedMedia.Content != null && downloadedMedia.Content.Length > 0)
                                                    {
                                                        var base64String = Convert.ToBase64String(downloadedMedia.Content);
                                                        var mimeType = downloadedMedia.MimeType ?? "image/png";
                                                        var dataUrl = $"data:{mimeType};base64,{base64String}";
                                                        
                                                        // 保存文件到執行目錄
                                                        try
                                                        {
                                                            var executionId = eFormInstance.WorkflowExecutionId;
                                                            if (executionId > 0)
                                                            {
                                                                string savedFilePath = null;
                                                                string messageType = null;
                                                                
                                                                // 根據 MIME 類型判斷是圖片還是文檔
                                                                if (mimeType != null && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                                                                {
                                                                    // 保存圖片
                                                                    savedFilePath = await SaveWaitReplyImageAsync(
                                                                        executionId, 
                                                                        downloadedMedia.Content, 
                                                                        downloadedMedia.FileName, 
                                                                        mimeType);
                                                                    messageType = "image";
                                                                    _loggingService.LogInformation($"✅ 已保存圖片到執行目錄: {savedFilePath}");
                                                                }
                                                                else
                                                                {
                                                                    // 保存文檔
                                                                    savedFilePath = await SaveWaitReplyDocumentAsync(
                                                                        executionId, 
                                                                        downloadedMedia.Content, 
                                                                        downloadedMedia.FileName, 
                                                                        mimeType);
                                                                    messageType = "document";
                                                                    _loggingService.LogInformation($"✅ 已保存文檔到執行目錄: {savedFilePath}");
                                                                }
                                                                
                                                                // ✅ 創建 MessageValidation 記錄（用於前端匹配步驟名稱）
                                                                if (!string.IsNullOrEmpty(savedFilePath))
                                                                {
                                                                    try
                                                                    {
                                                                        var validation = new MessageValidation
                                                                        {
                                                                            WorkflowExecutionId = executionId,
                                                                            StepIndex = stepIndex,
                                                                            UserWaId = messageData.WaId,
                                                                            UserMessage = $"[Meta Flows] {fieldName} (array element)",
                                                                            MessageType = messageType,
                                                                            MediaId = mediaId,
                                                                            MediaUrl = savedFilePath,
                                                                            IsValid = true, // Meta Flows 提交的媒體默認為有效
                                                                            CreatedAt = DateTime.UtcNow
                                                                        };
                                                                        
                                                                        _context.MessageValidations.Add(validation);
                                                                        await _context.SaveChangesAsync();
                                                                        _loggingService.LogInformation($"✅ 已創建 MessageValidation 記錄 - StepIndex: {stepIndex}, MediaUrl: {savedFilePath}");
                                                                    }
                                                                    catch (Exception validationEx)
                                                                    {
                                                                        _loggingService.LogWarning($"⚠️ 創建 MessageValidation 記錄時發生錯誤: {validationEx.Message}");
                                                                    }
                                                                }
                                                                
                                                                // 構建包含下載信息的對象，保留原始字段
                                                                var processedElement = new Dictionary<string, object>();
                                                                
                                                                // 保留原始字段
                                                                foreach (var prop in arrayElement.EnumerateObject())
                                                                {
                                                                    if (prop.Name == "id")
                                                                    {
                                                                        // 保留原始 id
                                                                        processedElement["id"] = mediaId;
                                                                    }
                                                                    else
                                                                    {
                                                                        processedElement[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
                                                                    }
                                                                }
                                                                
                                                                // 添加下載後的數據
                                                                processedElement["dataUrl"] = dataUrl;
                                                                processedElement["filePath"] = savedFilePath ?? "";
                                                                processedElement["mimeType"] = mimeType;
                                                                processedElement["fileName"] = downloadedMedia.FileName ?? "";
                                                                processedElement["fileSize"] = downloadedMedia.Content.Length;
                                                                
                                                                arrayList.Add(processedElement);
                                                                arrayHasMedia = true;
                                                                
                                                                _loggingService.LogInformation($"✅ 成功下載並轉換數組元素媒體 '{fieldName}'，大小: {downloadedMedia.Content.Length} bytes, MIME: {mimeType}");
                                                            }
                                                            else
                                                            {
                                                                // 如果沒有 executionId，只保存 base64，但保留原始結構
                                                                var processedElement = new Dictionary<string, object>();
                                                                foreach (var prop in arrayElement.EnumerateObject())
                                                                {
                                                                    processedElement[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
                                                                }
                                                                processedElement["dataUrl"] = dataUrl;
                                                                arrayList.Add(processedElement);
                                                                arrayHasMedia = true;
                                                            }
                                                        }
                                                        catch (Exception saveEx)
                                                        {
                                                            // 保存文件失敗，但繼續保存 base64
                                                            _loggingService.LogWarning($"⚠️ 保存媒體文件到目錄時發生錯誤: {saveEx.Message}，將只保存 base64");
                                                            
                                                            var processedElement = new Dictionary<string, object>();
                                                            foreach (var prop in arrayElement.EnumerateObject())
                                                            {
                                                                processedElement[prop.Name] = JsonSerializer.Deserialize<object>(prop.Value.GetRawText());
                                                            }
                                                            processedElement["dataUrl"] = dataUrl;
                                                            arrayList.Add(processedElement);
                                                            arrayHasMedia = true;
                                                        }
                                                    }
                                                    else
                                                    {
                                                        // 下載失敗，保留原始元素
                                                        arrayList.Add(JsonSerializer.Deserialize<object>(arrayElement.GetRawText()));
                                                        _loggingService.LogWarning($"⚠️ 無法下載媒體 '{fieldName}': {mediaId}，保留原始值");
                                                    }
                                                }
                                                catch (Exception ex)
                                                {
                                                    // 下載失敗，保留原始元素
                                                    arrayList.Add(JsonSerializer.Deserialize<object>(arrayElement.GetRawText()));
                                                    _loggingService.LogWarning($"⚠️ 下載媒體 '{fieldName}' 時發生錯誤: {ex.Message}，保留原始值");
                                                }
                                            }
                                            else
                                            {
                                                // id 為空，保留原始元素
                                                arrayList.Add(JsonSerializer.Deserialize<object>(arrayElement.GetRawText()));
                                            }
                                        }
                                        else
                                        {
                                            // 數組元素不包含 id 字段，保留原始元素
                                            arrayList.Add(JsonSerializer.Deserialize<object>(arrayElement.GetRawText()));
                                        }
                                    }
                                    else
                                    {
                                        // 數組元素不是對象，保留原始值
                                        arrayList.Add(JsonSerializer.Deserialize<object>(arrayElement.GetRawText()));
                                    }
                                }
                                
                                if (arrayHasMedia)
                                {
                                    responseDict[fieldName] = arrayList;
                                    hasMediaId = true;
                                }
                                else
                                {
                                    // 沒有媒體 ID，直接保存數組
                                    responseDict[fieldName] = arrayList;
                                }
                            }
                            else
                            {
                                // 其他類型（數字、布爾值等），直接保存
                                responseDict[fieldName] = JsonSerializer.Deserialize<object>(fieldValue.GetRawText());
                            }
                        }

                        // 將處理後的字典轉換回 JSON 字符串
                        if (hasMediaId)
                        {
                            processedResponseJson = JsonSerializer.Serialize(responseDict, new JsonSerializerOptions 
                            { 
                                WriteIndented = false 
                            });
                            _loggingService.LogInformation($"✅ 已處理 MEDIA_ID，更新後的 JSON 長度: {processedResponseJson.Length}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"處理 MEDIA_ID 時發生錯誤: {ex.Message}，將使用原始 JSON", ex);
                    // 如果處理失敗，使用原始 JSON
                    processedResponseJson = originalResponseJson;
                }

                // 更新 EFormInstance - 保存處理後的 JSON（MEDIA_ID 已轉換為 base64）
                eFormInstance.FilledHtmlCode = processedResponseJson;
                eFormInstance.Status = "Submitted";
                eFormInstance.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"✅ Flow 回覆處理完成，EFormInstance {eFormInstance.Id} 已更新");

                // 獲取工作流程執行記錄
                var execution = await _context.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .FirstOrDefaultAsync(e => e.Id == eFormInstance.WorkflowExecutionId);

                if (execution == null)
                {
                    _loggingService.LogWarning($"找不到對應的 WorkflowExecution: {eFormInstance.WorkflowExecutionId}");
                    return new { success = false, message = "WorkflowExecution not found" };
                }

                // ✅ 自動匹配 Meta Flow 表單字段值到流程變量
                if (eFormInstance.WorkflowExecutionId > 0 && !string.IsNullOrEmpty(processedResponseJson))
                {
                    try
                    {
                        _loggingService.LogInformation($"🔍 開始自動匹配 Meta Flow 表單字段值到流程變量");
                        await AutoMapMetaFlowFieldsToProcessVariablesAsync(eFormInstance, processedResponseJson, execution);
                        _loggingService.LogInformation($"✅ 自動匹配完成");
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogWarning($"⚠️ 自動匹配 Meta Flow 表單字段值到流程變量時發生錯誤（不影響流程繼續）: {ex.Message}");
                        // 不影響流程繼續，只記錄警告
                    }
                }

                // ✅ 處理 AI Validator（僅 manual fill + MetaFlow）
                // 1. 檢查是否為 manual fill 模式
                // 2. 檢查是否為 MetaFlow
                // 3. 檢查 AI Validator 是否啟用
                // 4. 檢查是否有圖像
                var sendEFormNodeInfo = await GetSendEFormNodeInfo(execution, eFormInstance.WorkflowStepExecutionId);
                if (sendEFormNodeInfo != null)
                {
                    _loggingService.LogInformation($"🔍 檢查 sendEForm 節點配置 - SendEFormMode: {sendEFormNodeInfo.SendEFormMode}, FormType: {sendEFormNodeInfo.FormType}");
                    
                    // 檢查條件：manual fill + MetaFlow + AI Validator 啟用
                    var isManualFill = string.Equals(sendEFormNodeInfo.SendEFormMode, "manualFill", StringComparison.OrdinalIgnoreCase);
                    var isMetaFlow = string.Equals(sendEFormNodeInfo.FormType, "MetaFlows", StringComparison.OrdinalIgnoreCase);
                    var hasAiValidation = sendEFormNodeInfo.Validation != null && 
                                         (sendEFormNodeInfo.Validation.AiIsActive == true || 
                                          (sendEFormNodeInfo.Validation.AiIsActive == null && 
                                           sendEFormNodeInfo.Validation.Enabled == true && 
                                           !string.IsNullOrWhiteSpace(sendEFormNodeInfo.Validation.ValidatorType) &&
                                           string.Equals(sendEFormNodeInfo.Validation.ValidatorType, "ai", StringComparison.OrdinalIgnoreCase)));
                    
                    if (isManualFill && isMetaFlow && hasAiValidation)
                    {
                        _loggingService.LogInformation($"✅ 符合 AI Validator 處理條件，開始處理 Flow 回覆");
                        
                        // 使用已經獲取的 stepExecution（在第 3299 行已聲明）
                        if (stepExecution != null)
                        {
                            // 從 Flow 回覆 JSON 中檢測圖像（支持多張圖片）
                            var imageList = new List<(string MediaId, string MimeType, string DataUrl)>();
                            
                            try
                            {
                                var responseJsonElement = JsonSerializer.Deserialize<JsonElement>(processedResponseJson);
                                
                                // 遍歷所有字段，查找所有圖像
                                foreach (var property in responseJsonElement.EnumerateObject())
                                {
                                    var fieldName = property.Name;
                                    var fieldValue = property.Value;
                                    
                                    // 跳過 flow_token
                                    if (fieldName == "flow_token")
                                        continue;
                                    
                                    // 檢查是否是圖像（可能是對象包含 dataUrl 或 filePath，且 mimeType 是 image/）
                                    if (fieldValue.ValueKind == JsonValueKind.Object)
                                    {
                                        if (fieldValue.TryGetProperty("mimeType", out var mimeTypeProp) || 
                                            fieldValue.TryGetProperty("mime_type", out mimeTypeProp))
                                        {
                                            var mimeType = mimeTypeProp.GetString();
                                            if (!string.IsNullOrEmpty(mimeType) && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                                            {
                                                string imageMediaId = null;
                                                string imageDataUrl = null;
                                                
                                                // 嘗試獲取 dataUrl
                                                if (fieldValue.TryGetProperty("dataUrl", out var dataUrlProp))
                                                {
                                                    imageDataUrl = dataUrlProp.GetString();
                                                }
                                                
                                                // 嘗試獲取 id（原始 MEDIA_ID）
                                                if (fieldValue.TryGetProperty("id", out var idProp))
                                                {
                                                    imageMediaId = idProp.GetString();
                                                }
                                                
                                                imageList.Add((imageMediaId, mimeType, imageDataUrl));
                                                _loggingService.LogInformation($"✅ 檢測到圖像字段 '{fieldName}': MIME={mimeType}, MediaId={imageMediaId}");
                                            }
                                        }
                                        // 如果沒有 mimeType，但包含 dataUrl（base64 圖像）
                                        else if (fieldValue.TryGetProperty("dataUrl", out var dataUrlProp))
                                        {
                                            var dataUrl = dataUrlProp.GetString();
                                            if (!string.IsNullOrEmpty(dataUrl) && dataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
                                            {
                                                string imageMimeType = null;
                                                // 從 dataUrl 提取 MIME 類型
                                                var mimeMatch = System.Text.RegularExpressions.Regex.Match(dataUrl, @"data:([^;]+);");
                                                if (mimeMatch.Success)
                                                {
                                                    imageMimeType = mimeMatch.Groups[1].Value;
                                                }
                                                
                                                imageList.Add((null, imageMimeType ?? "image/jpeg", dataUrl));
                                                _loggingService.LogInformation($"✅ 檢測到 base64 圖像字段 '{fieldName}': MIME={imageMimeType}");
                                            }
                                        }
                                    }
                                    // 檢查是否是數組（PhotoPicker 可能返回數組，包含多張圖片）
                                    else if (fieldValue.ValueKind == JsonValueKind.Array)
                                    {
                                        foreach (var arrayElement in fieldValue.EnumerateArray())
                                        {
                                            if (arrayElement.ValueKind == JsonValueKind.Object)
                                            {
                                                if (arrayElement.TryGetProperty("mimeType", out var mimeTypeProp) || 
                                                    arrayElement.TryGetProperty("mime_type", out mimeTypeProp))
                                                {
                                                    var mimeType = mimeTypeProp.GetString();
                                                    if (!string.IsNullOrEmpty(mimeType) && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                                                    {
                                                        string imageMediaId = null;
                                                        string imageDataUrl = null;
                                                        
                                                        if (arrayElement.TryGetProperty("dataUrl", out var dataUrlProp))
                                                        {
                                                            imageDataUrl = dataUrlProp.GetString();
                                                        }
                                                        if (arrayElement.TryGetProperty("id", out var idProp))
                                                        {
                                                            imageMediaId = idProp.GetString();
                                                        }
                                                        
                                                        imageList.Add((imageMediaId, mimeType, imageDataUrl));
                                                        _loggingService.LogInformation($"✅ 檢測到數組中的圖像字段 '{fieldName}': MIME={mimeType}, MediaId={imageMediaId}");
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                _loggingService.LogInformation($"📸 共檢測到 {imageList.Count} 張圖片");
                            }
                            catch (Exception ex)
                            {
                                _loggingService.LogError($"檢測圖像時發生錯誤: {ex.Message}");
                            }
                            
                            // 如果有圖像，調用 AI Validator（處理所有圖片）
                            if (imageList.Count > 0)
                            {
                                _loggingService.LogInformation($"🔍 檢測到 {imageList.Count} 張圖片，開始 AI 驗證");
                                
                                // 收集所有圖片的 base64 數據
                                var allImageBase64List = new List<string>();
                                string combinedMimeType = null;
                                
                                for (int i = 0; i < imageList.Count; i++)
                                {
                                    var (imageMediaId, imageMimeType, imageDataUrl) = imageList[i];
                                    string mediaContentBase64 = null;
                                    
                                    _loggingService.LogInformation($"📸 處理第 {i + 1}/{imageList.Count} 張圖片: MediaId={imageMediaId}, MIME={imageMimeType}");
                                    
                                    // 優先使用 MediaId 重新下載媒體並生成 base64（與 wait for user reply 節點保持一致）
                                    if (!string.IsNullOrEmpty(imageMediaId))
                                    {
                                        try
                                        {
                                            // 重新下載媒體（確保獲取最新的媒體內容）
                                            var downloadedMedia = await DownloadWhatsAppMediaAsync(company, imageMediaId);
                                            if (downloadedMedia != null && downloadedMedia.Content != null && downloadedMedia.Content.Length > 0)
                                            {
                                                // 直接從字節數組生成 base64（與 wait for user reply 節點保持一致）
                                                mediaContentBase64 = Convert.ToBase64String(downloadedMedia.Content);
                                                combinedMimeType = downloadedMedia.MimeType ?? imageMimeType ?? "image/jpeg";
                                                _loggingService.LogInformation($"✅ 從 MediaId 下載並生成 base64，長度: {mediaContentBase64.Length}, MIME: {combinedMimeType}");
                                            }
                                            else
                                            {
                                                _loggingService.LogWarning($"⚠️ 無法下載媒體 {imageMediaId}，嘗試從 dataUrl 提取");
                                            }
                                        }
                                        catch (Exception downloadEx)
                                        {
                                            _loggingService.LogWarning($"⚠️ 下載媒體 {imageMediaId} 時發生錯誤: {downloadEx.Message}，嘗試從 dataUrl 提取");
                                        }
                                    }
                                    
                                    // 如果下載失敗，嘗試從 dataUrl 提取 base64（後備方案）
                                    if (string.IsNullOrEmpty(mediaContentBase64) && !string.IsNullOrEmpty(imageDataUrl))
                                    {
                                        if (imageDataUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                                        {
                                            // 提取 base64 部分（移除 "data:image/...;base64," 前綴）
                                            var base64Index = imageDataUrl.IndexOf("base64,", StringComparison.OrdinalIgnoreCase);
                                            if (base64Index >= 0)
                                            {
                                                mediaContentBase64 = imageDataUrl.Substring(base64Index + 7); // 7 = "base64," 的長度
                                                // 清理 base64 字符串：移除所有換行符、回車符和空白字符（確保符合 API 要求）
                                                mediaContentBase64 = mediaContentBase64.Replace("\r", "").Replace("\n", "").Replace(" ", "").Replace("\t", "");
                                                combinedMimeType = imageMimeType ?? "image/jpeg";
                                                _loggingService.LogInformation($"✅ 從 dataUrl 提取 base64，清理後長度: {mediaContentBase64.Length}");
                                            }
                                            else
                                            {
                                                _loggingService.LogWarning($"⚠️ dataUrl 格式不正確，無法提取 base64: {imageDataUrl.Substring(0, Math.Min(100, imageDataUrl.Length))}");
                                            }
                                        }
                                        else
                                        {
                                            // 如果已經是純 base64 字符串，也需要清理
                                            mediaContentBase64 = imageDataUrl.Replace("\r", "").Replace("\n", "").Replace(" ", "").Replace("\t", "");
                                            combinedMimeType = imageMimeType ?? "image/jpeg";
                                        }
                                    }
                                    
                                    if (!string.IsNullOrEmpty(mediaContentBase64))
                                    {
                                        allImageBase64List.Add(mediaContentBase64);
                                    }
                                    else
                                    {
                                        _loggingService.LogWarning($"⚠️ 無法獲取第 {i + 1} 張圖片的 base64 內容，跳過");
                                    }
                                }
                                
                                if (allImageBase64List.Count == 0)
                                {
                                    _loggingService.LogError($"❌ 無法獲取任何圖像的 base64 內容，跳過 AI 驗證");
                                }
                                else
                                {
                                    _loggingService.LogInformation($"✅ 成功收集 {allImageBase64List.Count} 張圖片的 base64 數據，開始 AI 驗證（單一 API 調用）");
                                    
                                    // ✅ 構建包含所有圖片的 mediaArray JSON
                                    var mediaArray = new List<Dictionary<string, object>>();
                                    for (int i = 0; i < allImageBase64List.Count; i++)
                                    {
                                        var (_, imageMimeType, _) = imageList[i];
                                        mediaArray.Add(new Dictionary<string, object>
                                        {
                                            ["base64"] = allImageBase64List[i],
                                            ["mimeType"] = imageMimeType ?? "image/jpeg"
                                        });
                                    }
                                    
                                    // ✅ 構建包含所有圖片的 MessageText JSON（用於 AI Validator）
                                    // 如果有多張圖片，在 prompt 中添加提示要求整合結果
                                    var userPrompt = sendEFormNodeInfo.Validation?.Prompt ?? "";
                                    var combinedPrompt = userPrompt;
                                    
                                    if (allImageBase64List.Count > 1)
                                    {
                                        // 在 prompt 開頭添加多圖整合提示
                                        var integrationHint = $"[重要提示：用戶上傳了 {allImageBase64List.Count} 張圖片，請您仔細分析所有圖片並整合結果。]\n\n";
                                        combinedPrompt = integrationHint + userPrompt;
                                        _loggingService.LogInformation($"📸 多張圖片模式：已在 prompt 中添加整合提示");
                                    }
                                    
                                    // 構建包含所有圖片的 JSON 消息
                                    var messageContentJson = new Dictionary<string, object>
                                    {
                                        ["mediaArray"] = mediaArray,
                                        ["prompt"] = combinedPrompt
                                    };
                                    
                                    // ✅ 添加所有回覆字段和值（排除圖片字段和 flow_token）
                                    try
                                    {
                                        var responseJsonElement = JsonSerializer.Deserialize<JsonElement>(processedResponseJson);
                                        var addedFields = new List<string>();
                                        
                                        foreach (var property in responseJsonElement.EnumerateObject())
                                        {
                                            var fieldName = property.Name;
                                            var fieldValue = property.Value;
                                            
                                            // 跳過 flow_token
                                            if (fieldName == "flow_token")
                                                continue;
                                            
                                            // 檢查是否是圖片字段（PhotoPicker 等）
                                            bool isImageField = false;
                                            if (fieldValue.ValueKind == JsonValueKind.Array)
                                            {
                                                foreach (var arrayElement in fieldValue.EnumerateArray())
                                                {
                                                    if (arrayElement.ValueKind == JsonValueKind.Object)
                                                    {
                                                        if (arrayElement.TryGetProperty("mimeType", out var mimeTypeProp) || 
                                                            arrayElement.TryGetProperty("mime_type", out mimeTypeProp))
                                                        {
                                                            var mimeType = mimeTypeProp.GetString();
                                                            if (!string.IsNullOrEmpty(mimeType) && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                                                            {
                                                                isImageField = true;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            else if (fieldValue.ValueKind == JsonValueKind.Object)
                                            {
                                                if (fieldValue.TryGetProperty("mimeType", out var mimeTypeProp) || 
                                                    fieldValue.TryGetProperty("mime_type", out mimeTypeProp))
                                                {
                                                    var mimeType = mimeTypeProp.GetString();
                                                    if (!string.IsNullOrEmpty(mimeType) && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                                                    {
                                                        isImageField = true;
                                                    }
                                                }
                                            }
                                            
                                            // 如果不是圖片字段，添加到 messageContentJson
                                            if (!isImageField)
                                            {
                                                messageContentJson[fieldName] = JsonSerializer.Deserialize<object>(fieldValue.GetRawText());
                                                addedFields.Add(fieldName);
                                            }
                                        }
                                        
                                        if (addedFields.Count > 0)
                                        {
                                            _loggingService.LogInformation($"✅ 已將以下回覆字段添加到 AI 驗證消息中: {string.Join(", ", addedFields)}");
                                        }
                                        else
                                        {
                                            _loggingService.LogInformation($"✅ 已處理回覆字段，但沒有非圖片字段需要添加（只有圖片字段）");
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _loggingService.LogWarning($"⚠️ 解析 processedResponseJson 時發生錯誤: {ex.Message}，將只發送圖片和 prompt");
                                    }
                                    
                                    // 添加描述性文字（如果沒有其他字段，作為後備）
                                    if (messageContentJson.Count == 2) // 只有 mediaArray 和 prompt
                                    {
                                        messageContentJson["text"] = allImageBase64List.Count > 1 
                                            ? $"Flow response with {allImageBase64List.Count} images" 
                                            : "Flow response with image";
                                    }
                                    
                                    var messageContentJsonString = JsonSerializer.Serialize(messageContentJson, PayloadJsonOptions);
                                    
                                    // ✅ 記錄非圖片字段的內容（用於調試，排除 base64 圖片數據）
                                    try
                                    {
                                        var nonMediaFields = new Dictionary<string, object>();
                                        foreach (var kvp in messageContentJson)
                                        {
                                            if (kvp.Key != "mediaArray")
                                            {
                                                nonMediaFields[kvp.Key] = kvp.Value;
                                            }
                                        }
                                        var nonMediaFieldsJson = JsonSerializer.Serialize(nonMediaFields, new JsonSerializerOptions 
                                        { 
                                            WriteIndented = true  // 格式化以便閱讀
                                        });
                                        _loggingService.LogInformation($"📋 發送給 AI 的非圖片字段內容:\n{nonMediaFieldsJson}");
                                    }
                                    catch (Exception ex)
                                    {
                                        _loggingService.LogWarning($"無法記錄非圖片字段內容: {ex.Message}");
                                    }
                                    
                                    // ✅ 添加日誌記錄實際發送給 AI 的內容（用於調試）
                                    var messageContentPreview = messageContentJsonString.Length > 2000 
                                        ? messageContentJsonString.Substring(0, 2000) + "... (截斷，完整長度: " + messageContentJsonString.Length + ")" 
                                        : messageContentJsonString;
                                    _loggingService.LogInformation($"📤 準備發送給 AI 的完整消息內容: {messageContentPreview}");
                                    
                                    // 創建 WhatsAppMessageData 對象（用於 AI Validator）
                                    // 使用第一張圖片的 MediaId 和 MimeType（用於向後兼容）
                                    var flowMessageData = new WhatsAppMessageData
                                    {
                                        WaId = messageData.WaId,
                                        ContactName = messageData.ContactName,
                                        MessageId = messageData.MessageId,
                                        MessageText = messageContentJsonString, // ✅ 包含所有圖片的 JSON
                                        Timestamp = DateTime.UtcNow,
                                        Source = "MetaFlowResponse",
                                        MessageType = "image", // 標記為圖像類型
                                        MediaId = imageList[0].MediaId,
                                        MediaMimeType = combinedMimeType ?? "image/jpeg",
                                        MediaContentBase64 = allImageBase64List[0] // 保留第一張圖片用於向後兼容
                                    };
                                
                                    // ✅ 執行單一 AI 驗證（包含所有圖片）
                                    _loggingService.LogInformation($"🤖 開始 AI 驗證（包含 {allImageBase64List.Count} 張圖片）");
                                    var validationResult = await _messageValidator.ValidateMessageAsync(
                                        flowMessageData,
                                        execution,
                                        stepExecution);
                                    
                                    // 使用公共方法處理 AI 驗證結果
                                    var retryMessage = sendEFormNodeInfo.Validation?.RetryMessage 
                                        ?? validationResult.ErrorMessage 
                                        ?? "Input is incorrect, please re-enter";
                                    
                                    var shouldAbort = await ProcessAiValidationResultAsync(
                                        validationResult,
                                        execution,
                                        stepExecution,
                                        flowMessageData,
                                        fallbackText: processedResponseJson,
                                        onValidationFailed: async (result) =>
                                        {
                                            // AI 驗證失敗，發送錯誤訊息並保持等待狀態
                                            try
                                            {
                                                await SendWhatsAppMessage(company, messageData.WaId, retryMessage);
                                                _loggingService.LogInformation($"❌ AI 驗證失敗，已發送 retry 訊息: {retryMessage}");
                                            }
                                            catch (Exception sendEx)
                                            {
                                                _loggingService.LogError($"發送 retry 訊息失敗: {sendEx.Message}", sendEx);
                                            }
                                            
                                            _loggingService.LogWarning($"⚠️ AI 驗證失敗，保持等待狀態: {result.ErrorMessage}");
                                            return true; // 中斷處理
                                        });

                                    if (shouldAbort)
                                    {
                                        return new
                                        {
                                            success = false,
                                            message = "AI validation failed, waiting for retry",
                                            instanceId = eFormInstance.Id
                                        };
                                    }
                                }
                            }
                            else
                            {
                                _loggingService.LogInformation($"ℹ️ Flow 回覆中沒有檢測到圖像，跳過 AI Validator 處理");
                            }
                        }
                    }
                    else
                    {
                        _loggingService.LogInformation($"ℹ️ 不符合 AI Validator 處理條件 - ManualFill: {isManualFill}, MetaFlow: {isMetaFlow}, HasAIValidation: {hasAiValidation}");
                    }
                }
            
                // 繼續執行工作流程（如果需要的話）
                if (execution != null && execution.Status == "WaitingForFormApproval")
                {
                    _loggingService.LogInformation($"繼續執行工作流程 {execution.Id}");
                    // 使用現有的 ContinueWorkflowAfterFormApprovalAsync 方法
                    await ContinueWorkflowAfterFormApprovalAsync(eFormInstance.Id, "Submitted");
                }
                
                return new
                {
                    success = true,
                    message = "Flow response processed successfully",
                    instanceId = eFormInstance.Id
                };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理 Flow 回覆時發生錯誤: {ex.Message}", ex);
                return new { success = false, message = $"Error processing flow response: {ex.Message}" };
            }
        }

        /// <summary>
        /// 自動匹配 Meta Flow 表單字段值到流程變量
        /// 當表單字段名稱與流程變量名稱匹配時，自動將表單值設置到流程變量中
        /// </summary>
        private async Task AutoMapMetaFlowFieldsToProcessVariablesAsync(EFormInstance instance, string flowResponseJson, WorkflowExecution execution)
        {
            try
            {
                if (string.IsNullOrEmpty(flowResponseJson) || execution == null)
                {
                    _loggingService.LogInformation($"跳過自動匹配：flowResponseJson 為空或 execution 為 null");
                    return;
                }

                // 獲取所有流程變量定義
                using var scope = _serviceProvider.CreateScope();
                var processVariableService = scope.ServiceProvider.GetRequiredService<IProcessVariableService>();
                
                var variableDefinitions = await processVariableService.GetVariableDefinitionsAsync(execution.WorkflowDefinitionId);
                var variableNames = variableDefinitions.Select(v => v.VariableName).ToList();
                
                if (variableNames.Count == 0)
                {
                    _loggingService.LogInformation($"工作流程沒有定義流程變量，跳過自動匹配");
                    return;
                }

                _loggingService.LogInformation($"找到 {variableNames.Count} 個流程變量: {string.Join(", ", variableNames)}");

                // 從 Meta Flow JSON 中提取字段值
                var formFieldValues = ExtractFormFieldsFromMetaFlowJson(flowResponseJson);
                _loggingService.LogInformation($"從 Meta Flow JSON 中提取到 {formFieldValues.Count} 個字段值");

                // 匹配字段名和變量名，設置流程變量值
                int matchedCount = 0;
                foreach (var fieldName in formFieldValues.Keys)
                {
                    // 嘗試精確匹配（忽略大小寫）
                    var matchedVariable = variableNames.FirstOrDefault(v => 
                        string.Equals(v, fieldName, StringComparison.OrdinalIgnoreCase));
                    
                    if (matchedVariable != null)
                    {
                        var fieldValue = formFieldValues[fieldName];
                        if (!string.IsNullOrEmpty(fieldValue))
                        {
                            try
                            {
                                // 獲取變量定義以確定數據類型
                                var variableDef = variableDefinitions.FirstOrDefault(v => 
                                    string.Equals(v.VariableName, matchedVariable, StringComparison.OrdinalIgnoreCase));
                                
                                if (variableDef != null)
                                {
                                    // 轉換值類型
                                    object convertedValue = fieldValue;
                                    try
                                    {
                                        convertedValue = await processVariableService.ConvertValueAsync(variableDef.DataType, fieldValue);
                                    }
                                    catch
                                    {
                                        // 如果轉換失敗，使用原始字符串值
                                        convertedValue = fieldValue;
                                    }

                                    // 設置流程變量值
                                    await processVariableService.SetVariableValueAsync(
                                        execution.Id,
                                        matchedVariable,
                                        convertedValue,
                                        setBy: "MetaFlowAutoMapping",
                                        sourceType: "EFormField",
                                        sourceReference: $"EFormInstance:{instance.Id},Field:{fieldName}"
                                    );

                                    _loggingService.LogInformation($"✅ 自動匹配成功: Meta Flow 字段 '{fieldName}' -> 流程變量 '{matchedVariable}' = '{fieldValue}'");
                                    matchedCount++;
                                }
                            }
                            catch (Exception ex)
                            {
                                _loggingService.LogWarning($"設置流程變量 '{matchedVariable}' 時發生錯誤: {ex.Message}");
                            }
                        }
                    }
                }

                _loggingService.LogInformation($"自動匹配完成：成功匹配 {matchedCount} 個字段到流程變量");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"自動匹配 Meta Flow 表單字段值到流程變量時發生錯誤: {ex.Message}", ex);
                throw;
            }
        }

        /// <summary>
        /// 從 Meta Flow JSON 中提取字段值
        /// Meta Flow 返回的 JSON 格式：{ "fieldName1": "value1", "fieldName2": "value2", ... }
        /// </summary>
        private Dictionary<string, string> ExtractFormFieldsFromMetaFlowJson(string json)
        {
            var fieldValues = new Dictionary<string, string>();
            
            try
            {
                var jsonDoc = JsonDocument.Parse(json);
                var root = jsonDoc.RootElement;

                // 如果是對象，遍歷所有屬性
                if (root.ValueKind == JsonValueKind.Object)
                {
                    foreach (var property in root.EnumerateObject())
                    {
                        var fieldName = property.Name;
                        var fieldValue = property.Value;

                        // 跳過 flow_token
                        if (fieldName == "flow_token")
                            continue;

                        // 處理不同類型的值
                        string valueString = null;
                        
                        if (fieldValue.ValueKind == JsonValueKind.String)
                        {
                            valueString = fieldValue.GetString();
                        }
                        else if (fieldValue.ValueKind == JsonValueKind.Number)
                        {
                            valueString = fieldValue.GetRawText();
                        }
                        else if (fieldValue.ValueKind == JsonValueKind.True || fieldValue.ValueKind == JsonValueKind.False)
                        {
                            valueString = fieldValue.GetBoolean().ToString();
                        }
                        else if (fieldValue.ValueKind == JsonValueKind.Object)
                        {
                            // 如果是對象（例如包含 dataUrl 的媒體對象），嘗試提取有用的信息
                            if (fieldValue.TryGetProperty("dataUrl", out var dataUrlProp))
                            {
                                valueString = dataUrlProp.GetString();
                            }
                            else if (fieldValue.TryGetProperty("filePath", out var filePathProp))
                            {
                                valueString = filePathProp.GetString();
                            }
                            else
                            {
                                // 將整個對象序列化為 JSON 字符串
                                valueString = fieldValue.GetRawText();
                            }
                        }
                        else if (fieldValue.ValueKind == JsonValueKind.Array)
                        {
                            // 如果是數組，序列化為 JSON 字符串
                            valueString = fieldValue.GetRawText();
                        }

                        if (!string.IsNullOrEmpty(valueString) && !string.IsNullOrEmpty(fieldName))
                        {
                            fieldValues[fieldName] = valueString;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"從 Meta Flow JSON 提取字段值時發生錯誤: {ex.Message}");
            }

            return fieldValues;
        }
        
        // 輔助方法：處理 maxRetries 字段（將字符串轉換為整數）
        private static void ProcessMaxRetriesField(System.Text.Json.Nodes.JsonNode node)
        {
            if (node == null) return;
            
            if (node is System.Text.Json.Nodes.JsonObject obj)
            {
                if (obj.TryGetPropertyValue("maxRetries", out var maxRetriesNode))
                {
                    if (maxRetriesNode != null && maxRetriesNode.GetValueKind() == JsonValueKind.String)
                    {
                        var strValue = maxRetriesNode.GetValue<string>();
                        if (int.TryParse(strValue, out var intValue))
                        {
                            obj["maxRetries"] = intValue;
                        }
                    }
                }
                
                // 遞歸處理所有子對象
                foreach (var property in obj)
                {
                    if (property.Value != null)
                    {
                        ProcessMaxRetriesField(property.Value);
                    }
                }
            }
            else if (node is System.Text.Json.Nodes.JsonArray array)
            {
                foreach (var item in array)
                {
                    ProcessMaxRetriesField(item);
                }
            }
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
