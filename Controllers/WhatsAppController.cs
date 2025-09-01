using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
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
        private readonly WhatsAppWorkflowService _whatsAppService;
        private readonly LoggingService _loggingService;
        
        public WhatsAppController(
            PurpleRiceDbContext db, 
            IConfiguration configuration, 
            WhatsAppWorkflowService whatsAppService,
            LoggingService loggingService)
        {
            _db = db;
            _configuration = configuration;
            _whatsAppService = whatsAppService;
            _loggingService = loggingService;
        }

        // GET: api/whatsapp/chat-history/{waId}
        [HttpGet("chat-history/{waId}")]
        public async Task<IActionResult> GetChatHistory(string waId, int page = 1, int pageSize = 50)
        {
            _loggingService.LogInformation($"=== 開始獲取聊天歷史 ===");
            _loggingService.LogInformation($"WaId: {waId}, Page: {page}, PageSize: {pageSize}");
            
            try
            {
                var query = _db.WhatsAppMonitorChatMsgs
                    .Where(m => m.WaId == waId && !m.IsDeleted)
                    .OrderByDescending(m => m.Timestamp);

                var total = await query.CountAsync();
                _loggingService.LogInformation($"找到總消息數: {total}");
                
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

                _loggingService.LogInformation($"返回消息數: {messages.Count}");
                _loggingService.LogInformation($"=== 聊天歷史獲取完成 ===");

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
                _loggingService.LogError($"獲取聊天歷史失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/whatsapp/send-message
        [HttpPost("send-message")]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
        {
            _loggingService.LogInformation($"=== 開始處理發送消息請求 ===");
            _loggingService.LogInformation($"WaId: {request?.WaId}, Message: {request?.Message?.Substring(0, Math.Min(request.Message?.Length ?? 0, 50))}..., WorkflowInstanceId: {request?.WorkflowInstanceId}");
            
            try
            {
                if (string.IsNullOrEmpty(request.WaId) || string.IsNullOrEmpty(request.Message))
                {
                    _loggingService.LogWarning($"請求參數驗證失敗: WaId={request?.WaId}, Message={request?.Message}");
                    return BadRequest(new { error = "WaId 和 Message 不能為空" });
                }

                var messageId = Guid.NewGuid().ToString();
                var timestamp = DateTime.Now;
                _loggingService.LogInformation($"生成消息ID: {messageId}, 時間戳: {timestamp}");
                
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
                _loggingService.LogInformation($"消息已保存到數據庫，ID: {chatMessage.Id}");

                // 2. 使用現有的 WhatsAppWorkflowService 發送消息
                var whatsappSent = false;
                try
                {
                    if (request.WorkflowInstanceId.HasValue)
                    {
                        _loggingService.LogInformation($"使用工作流程實例發送消息，WorkflowInstanceId: {request.WorkflowInstanceId.Value}");
                        
                        // 如果有工作流程實例 ID，使用完整的服務方法
                        var workflowExecution = await _db.WorkflowExecutions
                            .FirstOrDefaultAsync(we => we.Id == request.WorkflowInstanceId.Value);
                        
                        if (workflowExecution != null)
                        {
                            _loggingService.LogInformation($"找到工作流程實例: {workflowExecution.Id}, 定義ID: {workflowExecution.WorkflowDefinitionId}");
                            
                            await _whatsAppService.SendWhatsAppMessageAsync(
                                request.WaId, 
                                request.Message, 
                                workflowExecution, 
                                _db
                            );
                            whatsappSent = true;
                            _loggingService.LogInformation("使用 WhatsAppWorkflowService 發送消息成功");
                        }
                        else
                        {
                            _loggingService.LogWarning($"找不到工作流程實例: {request.WorkflowInstanceId.Value}");
                        }
                    }
                    else
                    {
                        _loggingService.LogInformation("使用簡化方法發送消息（無工作流程實例）");
                        // 如果沒有工作流程實例 ID，使用簡化的發送方法
                        whatsappSent = await SendSimpleWhatsAppMessage(request.WaId, request.Message);
                    }
                    
                    // 更新消息狀態
                    chatMessage.Status = whatsappSent ? "sent" : "failed";
                    chatMessage.UpdatedAt = DateTime.Now;
                    await _db.SaveChangesAsync();
                    _loggingService.LogInformation($"消息狀態已更新: {chatMessage.Status}");
                }
                catch (Exception ex)
                {
                    // 記錄錯誤但繼續執行
                    _loggingService.LogError($"發送 WhatsApp 消息失敗: {ex.Message}", ex);
                    chatMessage.Status = "failed";
                    chatMessage.Metadata = JsonSerializer.Serialize(new { error = ex.Message });
                    chatMessage.UpdatedAt = DateTime.Now;
                    await _db.SaveChangesAsync();
                    _loggingService.LogInformation($"錯誤狀態已保存到數據庫");
                }

                _loggingService.LogInformation($"=== 發送消息處理完成，結果: {(whatsappSent ? "成功" : "失敗")} ===");
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
                _loggingService.LogError($"處理發送消息請求失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/whatsapp/test-config
        [HttpGet("test-config")]
        public async Task<IActionResult> TestWhatsAppConfig()
        {
            _loggingService.LogInformation($"=== 開始測試 WhatsApp 配置 ===");
            
            try
            {
                // 從數據庫中獲取公司的 WhatsApp 配置
                var company = await _db.Companies
                    .FirstOrDefaultAsync();
                
                if (company == null)
                {
                    _loggingService.LogError("找不到有效的公司配置");
                    return BadRequest(new { error = "找不到有效的公司配置" });
                }
                
                _loggingService.LogInformation($"找到公司: {company.Name}, ID: {company.Id}");
                
                var accessToken = company.WA_API_Key;
                var phoneNumberId = company.WA_PhoneNo_ID;
                var version = "v19.0"; // 使用與服務一致的版本

                _loggingService.LogInformation($"API Key 長度: {accessToken?.Length ?? 0}");
                _loggingService.LogInformation($"Phone Number ID: {phoneNumberId}");
                _loggingService.LogInformation($"API 版本: {version}");

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

                _loggingService.LogInformation($"=== WhatsApp 配置測試完成 ===");
                return Ok(new
                {
                    message = "公司 WhatsApp API 配置檢查",
                    config = configInfo,
                    status = "success"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"測試 WhatsApp 配置失敗: {ex.Message}", ex);
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

                _loggingService.LogInformation($"測試發送 WhatsApp 消息到: {request.WaId}");
                if (request.WorkflowInstanceId.HasValue)
                {
                    _loggingService.LogInformation($"使用工作流程實例 ID: {request.WorkflowInstanceId.Value}");
                }
                
                var success = false;
                
                if (request.WorkflowInstanceId.HasValue)
                {
                    // 使用工作流程服務
                    var workflowExecution = await _db.WorkflowExecutions
                        .FirstOrDefaultAsync(we => we.Id == request.WorkflowInstanceId.Value);
                    
                    if (workflowExecution != null)
                    {
                        await _whatsAppService.SendWhatsAppMessageAsync(
                            request.WaId, 
                            request.Message ?? "這是一條測試消息", 
                            workflowExecution, 
                            _db
                        );
                        success = true;
                    }
                    else
                    {
                        _loggingService.LogWarning($"找不到工作流程實例: {request.WorkflowInstanceId.Value}");
                    }
                }
                else
                {
                    // 使用簡化方法
                    success = await SendSimpleWhatsAppMessage(
                        request.WaId, 
                        request.Message ?? "這是一條測試消息"
                    );
                }
                
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
                _loggingService.LogError($"測試發送失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/whatsapp/messages/{workflowInstanceId}
        [HttpGet("messages/{workflowInstanceId}")]
        public async Task<IActionResult> GetMessagesByWorkflowInstance(int workflowInstanceId)
        {
            _loggingService.LogInformation($"=== 開始獲取工作流程實例消息 ===");
            _loggingService.LogInformation($"WorkflowInstanceId: {workflowInstanceId}");
            
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

                _loggingService.LogInformation($"找到消息數: {messages.Count}");
                _loggingService.LogInformation($"=== 工作流程實例消息獲取完成 ===");

                return Ok(new
                {
                    workflowInstanceId,
                    messages,
                    total = messages.Count
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取工作流程實例消息失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        // 簡化的 WhatsApp 消息發送方法（用於沒有工作流程實例的情況）
        private async Task<bool> SendSimpleWhatsAppMessage(string waId, string messageText)
        {
            _loggingService.LogInformation($"=== 開始簡化發送 WhatsApp 消息 ===");
            _loggingService.LogInformation($"WaId: {waId}, Message: {messageText?.Substring(0, Math.Min(messageText?.Length ?? 0, 50))}...");
            
            try
            {
                // 獲取第一個有效的公司配置
                var company = await _db.Companies.FirstOrDefaultAsync();
                
                if (company == null)
                {
                    _loggingService.LogError("找不到有效的公司配置");
                    return false;
                }
                
                _loggingService.LogInformation($"使用公司: {company.Name}, ID: {company.Id}");
                
                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    _loggingService.LogError("公司 WhatsApp API 配置缺失");
                    _loggingService.LogError($"API Key 是否為空: {string.IsNullOrEmpty(company.WA_API_Key)}");
                    _loggingService.LogError($"Phone Number ID 是否為空: {string.IsNullOrEmpty(company.WA_PhoneNo_ID)}");
                    return false;
                }

                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                _loggingService.LogInformation($"API URL: {url}");
                
                var requestBody = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "text",
                    text = new { body = messageText }
                };

                var json = JsonSerializer.Serialize(requestBody);
                _loggingService.LogInformation($"簡化發送 WhatsApp 消息: {url}");
                _loggingService.LogInformation($"請求內容: {json}");
                
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"HTTP 響應狀態碼: {response.StatusCode}");
                _loggingService.LogInformation($"HTTP 響應內容: {responseContent}");

                if (response.IsSuccessStatusCode)
                {
                    _loggingService.LogInformation($"WhatsApp 消息發送成功: {responseContent}");
                    _loggingService.LogInformation($"=== 簡化發送 WhatsApp 消息完成 ===");
                    return true;
                }
                else
                {
                    _loggingService.LogError($"WhatsApp 消息發送失敗: {response.StatusCode} - {responseContent}");
                    _loggingService.LogInformation($"=== 簡化發送 WhatsApp 消息失敗 ===");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"簡化發送 WhatsApp 消息時發生錯誤: {ex.Message}", ex);
                _loggingService.LogInformation($"=== 簡化發送 WhatsApp 消息異常 ===");
                return false;
            }
        }
    }

    public class SendMessageRequest
    {
        public string WaId { get; set; }
        public string Message { get; set; }
        public int? WorkflowInstanceId { get; set; }
    }

    public class TestSendRequest
    {
        public string WaId { get; set; }
        public string Message { get; set; }
        public int? WorkflowInstanceId { get; set; }
    }
}
