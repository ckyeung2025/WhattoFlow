using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.Json;
using System.Net.Http;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppController : ControllerBase
    {
        private readonly PurpleRiceDbContext _db;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        
        public WhatsAppController(PurpleRiceDbContext db, IConfiguration configuration, HttpClient httpClient)
        {
            _db = db;
            _configuration = configuration;
            _httpClient = httpClient;
        }

        // GET: api/whatsapp/chat-history/{waId}
        [HttpGet("chat-history/{waId}")]
        public async Task<IActionResult> GetChatHistory(string waId, int page = 1, int pageSize = 50)
        {
            try
            {
                var query = _db.WhatsAppMonitorChatMsgs
                    .Where(m => m.WaId == waId && !m.IsDeleted)
                    .OrderByDescending(m => m.Timestamp);

                var total = await query.CountAsync();
                
                var messages = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(m => new
                    {
                        m.Id,
                        m.MessageId,
                        m.SenderType,
                        m.MessageText,
                        m.MessageType,
                        m.Status,
                        m.Timestamp,
                        m.WorkflowInstanceId
                    })
                    .ToListAsync();

                return Ok(new
                {
                    waId,
                    messages = messages.OrderBy(m => m.Timestamp), // 按時間正序返回
                    total,
                    page,
                    pageSize
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/whatsapp/send-message
        [HttpPost("send-message")]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.WaId) || string.IsNullOrEmpty(request.Message))
                {
                    return BadRequest(new { error = "WaId 和 Message 不能為空" });
                }

                var messageId = Guid.NewGuid().ToString();
                var timestamp = DateTime.Now;
                
                // 1. 先記錄到數據庫
                var chatMessage = new WhatsAppMonitorChatMsg
                {
                    WaId = request.WaId,
                    WorkflowInstanceId = request.WorkflowInstanceId,
                    MessageId = messageId,
                    SenderType = "admin",
                    MessageText = request.Message,
                    MessageType = "text",
                    Status = "sending", // 初始狀態為發送中
                    Timestamp = timestamp,
                    CreatedAt = timestamp,
                    UpdatedAt = timestamp
                };

                _db.WhatsAppMonitorChatMsgs.Add(chatMessage);
                await _db.SaveChangesAsync();

                // 2. 嘗試通過 Meta WhatsApp API 發送消息
                var whatsappSent = false;
                try
                {
                    whatsappSent = await SendWhatsAppMessage(request.WaId, request.Message, request.WorkflowInstanceId);
                    
                    // 更新消息狀態
                    chatMessage.Status = whatsappSent ? "sent" : "failed";
                    chatMessage.UpdatedAt = DateTime.Now;
                    await _db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    // 記錄錯誤但繼續執行
                    chatMessage.Status = "failed";
                    chatMessage.Metadata = JsonSerializer.Serialize(new { error = ex.Message });
                    chatMessage.UpdatedAt = DateTime.Now;
                    await _db.SaveChangesAsync();
                }

                return Ok(new
                {
                    success = true,
                    messageId = messageId,
                    whatsappSent = whatsappSent,
                    message = whatsappSent ? "消息已發送並記錄" : "消息已記錄但 WhatsApp 發送失敗"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/whatsapp/test-config
        [HttpGet("test-config")]
        public async Task<IActionResult> TestWhatsAppConfig()
        {
            try
            {
                // 從數據庫中獲取公司的 WhatsApp 配置
                var company = await _db.Companies
                    .FirstOrDefaultAsync();
                
                if (company == null)
                {
                    return BadRequest(new { error = "找不到有效的公司配置" });
                }
                
                var accessToken = company.WA_API_Key;
                var phoneNumberId = company.WA_PhoneNo_ID;
                var version = "v18.0";

                var configInfo = new
                {
                    companyName = company.Name,
                    hasAccessToken = !string.IsNullOrEmpty(accessToken),
                    hasPhoneNumberId = !string.IsNullOrEmpty(phoneNumberId),
                    version = version,
                    accessTokenLength = accessToken?.Length ?? 0,
                    phoneNumberId = phoneNumberId,
                    apiUrl = $"https://graph.facebook.com/{version}/{phoneNumberId}/messages"
                };

                return Ok(new
                {
                    message = "公司 WhatsApp API 配置檢查",
                    config = configInfo,
                    status = "success"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/whatsapp/test-send
        [HttpPost("test-send")]
        public async Task<IActionResult> TestWhatsAppSend([FromBody] TestSendRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.WaId))
                {
                    return BadRequest(new { error = "WaId 不能為空" });
                }

                Console.WriteLine($"測試發送 WhatsApp 消息到: {request.WaId}");
                if (request.WorkflowInstanceId.HasValue)
                {
                    Console.WriteLine($"使用工作流程實例 ID: {request.WorkflowInstanceId.Value}");
                }
                
                var success = await SendWhatsAppMessage(request.WaId, request.Message ?? "這是一條測試消息", request.WorkflowInstanceId);
                
                return Ok(new
                {
                    message = "測試發送完成",
                    waId = request.WaId,
                    workflowInstanceId = request.WorkflowInstanceId,
                    success = success,
                    timestamp = DateTime.Now
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // 測試發送請求模型
        public class TestSendRequest
        {
            public string WaId { get; set; }
            public string Message { get; set; }
            public int? WorkflowInstanceId { get; set; }
        }

        // 發送 WhatsApp 消息到 Meta API
        private async Task<bool> SendWhatsAppMessage(string waId, string messageText, int? workflowInstanceId = null)
        {
            try
            {
                Console.WriteLine($"開始發送 WhatsApp 消息到 {waId}");
                
                Company company = null;
                
                if (workflowInstanceId.HasValue)
                {
                    // 根據工作流程實例獲取對應的公司配置
                    var workflowExecution = await _db.WorkflowExecutions
                        .Where(we => we.Id == workflowInstanceId.Value)
                        .FirstOrDefaultAsync();
                    
                    if (workflowExecution != null)
                    {
                        var workflowDefinition = await _db.WorkflowDefinitions
                            .Where(wd => wd.Id == workflowExecution.WorkflowDefinitionId)
                            .FirstOrDefaultAsync();
                        
                        if (workflowDefinition != null)
                        {
                            company = await _db.Companies
                                .Where(c => c.Id == workflowDefinition.CompanyId)
                                .FirstOrDefaultAsync();
                            
                            Console.WriteLine($"根據工作流程實例 {workflowInstanceId} 找到公司: {workflowDefinition.CompanyId}");
                        }
                    }
                }
                
                // 如果沒有找到公司，使用第一個有效的公司配置
                if (company == null)
                {
                    company = await _db.Companies
                        .FirstOrDefaultAsync();
                    
                    Console.WriteLine("使用默認公司配置");
                }
                
                if (company == null)
                {
                    Console.WriteLine("錯誤: 找不到有效的公司配置");
                    return false;
                }
                
                var accessToken = company.WA_API_Key;
                var phoneNumberId = company.WA_PhoneNo_ID;
                var version = "v18.0"; // 使用默認版本
                
                Console.WriteLine($"使用公司: {company.Name}");
                Console.WriteLine($"使用 PhoneNumberId: {phoneNumberId}");
                Console.WriteLine($"使用 API 版本: {version}");

                if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(phoneNumberId))
                {
                    Console.WriteLine("錯誤: 公司 WhatsApp API 配置缺失");
                    Console.WriteLine($"AccessToken: {(string.IsNullOrEmpty(accessToken) ? "空" : "已設置")}");
                    Console.WriteLine($"PhoneNumberId: {(string.IsNullOrEmpty(phoneNumberId) ? "空" : "已設置")}");
                    return false;
                }

                var url = $"https://graph.facebook.com/{version}/{phoneNumberId}/messages";
                Console.WriteLine($"API URL: {url}");
                
                var requestBody = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "text",
                    text = new { body = messageText }
                };

                var json = JsonSerializer.Serialize(requestBody);
                Console.WriteLine($"請求內容: {json}");
                
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // 清除之前的 Authorization header
                _httpClient.DefaultRequestHeaders.Remove("Authorization");
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

                Console.WriteLine("發送 HTTP 請求...");
                var response = await _httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                Console.WriteLine($"HTTP 響應狀態碼: {response.StatusCode}");
                Console.WriteLine($"HTTP 響應內容: {responseContent}");

                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"WhatsApp 消息發送成功: {responseContent}");
                    return true;
                }
                else
                {
                    Console.WriteLine($"WhatsApp 消息發送失敗: {response.StatusCode} - {responseContent}");
                    
                    // 嘗試解析錯誤響應
                    try
                    {
                        var errorResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        if (errorResponse.TryGetProperty("error", out var error))
                        {
                            if (error.TryGetProperty("message", out var errorMessage))
                            {
                                Console.WriteLine($"錯誤信息: {errorMessage.GetString()}");
                            }
                            if (error.TryGetProperty("code", out var errorCode))
                            {
                                Console.WriteLine($"錯誤代碼: {errorCode.GetInt32()}");
                            }
                        }
                    }
                    catch (Exception parseEx)
                    {
                        Console.WriteLine($"解析錯誤響應失敗: {parseEx.Message}");
                    }
                    
                    return false;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"發送 WhatsApp 消息時發生錯誤: {ex.Message}");
                Console.WriteLine($"錯誤類型: {ex.GetType().Name}");
                Console.WriteLine($"錯誤堆疊: {ex.StackTrace}");
                return false;
            }
        }

        // GET: api/whatsapp/messages/{workflowInstanceId}
        [HttpGet("messages/{workflowInstanceId}")]
        public async Task<IActionResult> GetMessagesByWorkflowInstance(int workflowInstanceId)
        {
            try
            {
                var messages = await _db.WhatsAppMonitorChatMsgs
                    .Where(m => m.WorkflowInstanceId == workflowInstanceId && !m.IsDeleted)
                    .OrderBy(m => m.Timestamp)
                    .Select(m => new
                    {
                        m.Id,
                        m.MessageId,
                        m.SenderType,
                        m.MessageText,
                        m.MessageType,
                        m.Status,
                        m.Timestamp
                    })
                    .ToListAsync();

                return Ok(new
                {
                    workflowInstanceId,
                    messages,
                    total = messages.Count
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }

    public class SendMessageRequest
    {
        public string WaId { get; set; }
        public string Message { get; set; }
        public int? WorkflowInstanceId { get; set; }
    }
}
