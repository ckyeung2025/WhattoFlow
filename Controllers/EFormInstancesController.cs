using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using PurpleRice.Services.WebhookServices;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.Json;
using System.Text;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EFormInstancesController : ControllerBase
    {
                 private readonly PurpleRiceDbContext _db;
         private readonly IServiceProvider _serviceProvider;
         private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
         private readonly LoggingService _loggingService;
         private readonly WebhookMessageProcessingService _webhookMessageProcessingService;
         
         public EFormInstancesController(PurpleRiceDbContext db, IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, Func<string, LoggingService> loggingServiceFactory, WebhookMessageProcessingService webhookMessageProcessingService)
         {
             _db = db;
             _serviceProvider = serviceProvider;
             _whatsAppWorkflowService = whatsAppWorkflowService;
             _loggingService = loggingServiceFactory("EFormInstancesController");
             _webhookMessageProcessingService = webhookMessageProcessingService;
         }

        // GET: api/eforminstances/{id} - 獲取表單實例
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            try
            {
                var instance = await _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    return NotFound(new { error = "找不到表單實例" });
                }

                return Ok(new
                {
                    id = instance.Id,
                    instanceName = instance.InstanceName,
                    formName = instance.EFormDefinition?.Name,
                    status = instance.Status,
                    htmlCode = instance.FilledHtmlCode ?? instance.OriginalHtmlCode,
                    userMessage = instance.UserMessage,
                    createdAt = instance.CreatedAt,
                    approvalBy = instance.ApprovalBy,
                    approvalAt = instance.ApprovalAt,
                    approvalNote = instance.ApprovalNote
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"獲取表單實例失敗: {ex.Message}" });
            }
        }

        // POST: api/eforminstances/{id}/approve - 批准表單
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id, [FromBody] ApprovalRequest request)
        {
            try
            {
                _loggingService.LogInformation($"收到批准請求，ID: {id}");
                _loggingService.LogInformation($"請求數據: {System.Text.Json.JsonSerializer.Serialize(request)}");
                
                var instance = await _db.EFormInstances
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    _loggingService.LogWarning($"找不到表單實例，ID: {id}");
                    return NotFound(new { error = "找不到表單實例" });
                }

                _loggingService.LogInformation($"找到表單實例，當前狀態: {instance.Status}");

                if (instance.Status != "Pending")
                {
                    _loggingService.LogWarning($"表單狀態不是 Pending，當前狀態: {instance.Status}");
                    return BadRequest(new { error = "表單已經被處理過" });
                }

                // 更新表單實例狀態
                instance.Status = "Approved";
                instance.ApprovalBy = request.ApprovedBy ?? "System";
                instance.ApprovalAt = DateTime.UtcNow;
                instance.ApprovalNote = request.Note;
                instance.UpdatedAt = DateTime.UtcNow;

                _loggingService.LogInformation($"準備創建審批記錄");

                // 創建審批記錄
                var approval = new EFormApproval
                {
                    EFormInstanceId = instance.Id,
                    Action = "Approve",
                    ApprovedBy = request.ApprovedBy ?? "System",
                    ApprovalNote = request.Note,
                    ApprovedAt = DateTime.UtcNow
                };

                _db.EFormApprovals.Add(approval);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"審批記錄已保存，繼續執行工作流程");

                // 繼續執行工作流程
                _loggingService.LogInformation($"準備執行工作流程，WorkflowExecutionId: {instance.WorkflowExecutionId}");
                
                // 使用 WebhookMessageProcessingService 繼續流程
                try
                {
                    _loggingService.LogInformation($"開始調用 WebhookMessageProcessingService 繼續流程");
                    await _webhookMessageProcessingService.ContinueWorkflowAfterFormApprovalAsync(instance.Id, "Approved");
                    _loggingService.LogInformation($"流程繼續完成");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"繼續流程失敗: {ex.Message}", ex);
                }

                _loggingService.LogInformation($"批准操作完成，返回成功響應");

                return Ok(new
                {
                    success = true,
                    message = "表單已批准",
                    instanceId = instance.Id,
                    status = instance.Status
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批准表單時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = $"批准表單失敗: {ex.Message}" });
            }
        }

        // POST: api/eforminstances/{id}/reject - 拒絕表單
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id, [FromBody] ApprovalRequest request)
        {
            try
            {
                _loggingService.LogInformation($"收到拒絕請求，ID: {id}");
                _loggingService.LogInformation($"請求數據: {System.Text.Json.JsonSerializer.Serialize(request)}");
                
                var instance = await _db.EFormInstances
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    _loggingService.LogWarning($"找不到表單實例，ID: {id}");
                    return NotFound(new { error = "找不到表單實例" });
                }

                _loggingService.LogInformation($"找到表單實例，當前狀態: {instance.Status}");

                if (instance.Status != "Pending")
                {
                    _loggingService.LogWarning($"表單狀態不是 Pending，當前狀態: {instance.Status}");
                    return BadRequest(new { error = "表單已經被處理過" });
                }

                // 更新表單實例狀態
                instance.Status = "Rejected";
                instance.ApprovalBy = request.ApprovedBy ?? "System";
                instance.ApprovalAt = DateTime.UtcNow;
                instance.ApprovalNote = request.Note;
                instance.UpdatedAt = DateTime.UtcNow;

                _loggingService.LogInformation($"準備創建審批記錄");

                // 創建審批記錄
                var approval = new EFormApproval
                {
                    EFormInstanceId = instance.Id,
                    Action = "Reject",
                    ApprovedBy = request.ApprovedBy ?? "System",
                    ApprovalNote = request.Note,
                    ApprovedAt = DateTime.UtcNow
                };

                _db.EFormApprovals.Add(approval);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"審批記錄已保存，繼續執行工作流程");

                // 繼續執行工作流程
                _loggingService.LogInformation($"準備執行工作流程，WorkflowExecutionId: {instance.WorkflowExecutionId}");
                
                // 使用 WebhookMessageProcessingService 繼續流程
                try
                {
                    _loggingService.LogInformation($"開始調用 WebhookMessageProcessingService 繼續流程");
                    await _webhookMessageProcessingService.ContinueWorkflowAfterFormApprovalAsync(instance.Id, "Rejected");
                    _loggingService.LogInformation($"流程繼續完成");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"繼續流程失敗: {ex.Message}", ex);
                }

                _loggingService.LogInformation($"拒絕操作完成，返回成功響應");

                return Ok(new
                {
                    success = true,
                    message = "表單已拒絕",
                    instanceId = instance.Id,
                    status = instance.Status
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"拒絕表單時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = $"拒絕表單失敗: {ex.Message}" });
            }
        }

                         private async Task ContinueWorkflowExecution(int executionId)
        {
            try
            {
                _loggingService.LogInformation($"=== 繼續執行工作流程 ===");
                _loggingService.LogInformation($"執行ID: {executionId}");

                // 查找工作流程執行記錄
                var execution = await _db.WorkflowExecutions
                    .Include(w => w.WorkflowDefinition)
                    .FirstOrDefaultAsync(w => w.Id == executionId);

                if (execution == null)
                {
                    _loggingService.LogWarning($"找不到工作流程執行記錄，ID: {executionId}");
                    return;
                }

                _loggingService.LogInformation($"找到工作流程執行記錄，當前狀態: {execution.Status}，當前步驟: {execution.CurrentStep}");

                // 直接調用 WorkflowEngine 繼續執行工作流程
                var workflowEngine = HttpContext.RequestServices.GetRequiredService<WorkflowEngine>();
                await workflowEngine.ContinueWorkflowFromWaitReply(execution, new { message = "Continuing workflow" });
                
                _loggingService.LogInformation($"流程繼續完成");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"繼續執行工作流程失敗: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
            }
        }

        private async Task UpdateWorkflowExecutionStatus(int executionId, string status)
        {
            try
            {
                var execution = await _db.WorkflowExecutions
                    .FirstOrDefaultAsync(e => e.Id == executionId);

                if (execution != null)
                {
                    execution.Status = status;
                    execution.EndedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                // 記錄錯誤但不中斷主流程
                _loggingService.LogError($"更新工作流程執行狀態失敗: {ex.Message}", ex);
            }
        }

                 private async Task ProcessWorkflowSteps(WorkflowExecution execution, WorkflowGraph workflowGraph)
         {
             try
             {
                 _loggingService.LogInformation($"開始處理工作流程步驟，執行ID: {execution.Id}");
                 
                 // 查找所有未完成的步驟
                 var incompleteSteps = await _db.WorkflowStepExecutions
                     .Where(s => s.WorkflowExecutionId == execution.Id && s.Status == "Running")
                     .ToListAsync();

                 _loggingService.LogInformation($"找到 {incompleteSteps.Count} 個未完成的步驟");

                 if (incompleteSteps.Count == 0)
                 {
                     // 如果没有未完成的步骤，查找需要创建的后续步骤
                     _loggingService.LogInformation("沒有未完成的步驟，檢查是否需要創建後續步驟");
                     
                     // 查找sendEForm步骤
                     var sendEFormStep = await _db.WorkflowStepExecutions
                         .Where(s => s.WorkflowExecutionId == execution.Id && s.StepType == "sendEForm")
                         .FirstOrDefaultAsync();
                     
                     if (sendEFormStep != null && sendEFormStep.Status == "Completed")
                     {
                         _loggingService.LogInformation("sendEForm步驟已完成，查找後續節點");
                         
                         // 查找后续节点
                         var nextSteps = FindNextSteps(workflowGraph, "sendEForm");
                         _loggingService.LogInformation($"找到 {nextSteps.Count} 個後續節點");
                         
                         // 为每个后续节点创建步骤执行记录
                         foreach (var nextStep in nextSteps)
                         {
                             var stepExecution = new WorkflowStepExecution
                             {
                                 WorkflowExecutionId = execution.Id,
                                 StepIndex = execution.CurrentStep ?? 0,
                                 StepType = nextStep.type,
                                 Status = "Running",
                                 InputJson = System.Text.Json.JsonSerializer.Serialize(nextStep),
                                 StartedAt = DateTime.Now
                             };
                             
                             _db.WorkflowStepExecutions.Add(stepExecution);
                             _loggingService.LogInformation($"創建步驟執行記錄: {nextStep.type}");
                         }
                         
                         await _db.SaveChangesAsync();
                         
                         // 重新获取未完成的步骤
                         incompleteSteps = await _db.WorkflowStepExecutions
                             .Where(s => s.WorkflowExecutionId == execution.Id && s.Status == "Running")
                             .ToListAsync();
                         
                         _loggingService.LogInformation($"重新獲取到 {incompleteSteps.Count} 個未完成的步驟");
                     }
                 }

                 // 处理每个未完成的步骤
                 var hasFailedSteps = false;
                 foreach (var step in incompleteSteps)
                 {
                     try
                     {
                         _loggingService.LogInformation($"處理步驟: {step.StepType}，ID: {step.Id}");
                         await ExecuteStep(step, _db, execution);
                         _loggingService.LogInformation($"步驟 {step.StepType} 處理完成");
                     }
                     catch (Exception ex)
                     {
                         _loggingService.LogError($"處理工作流程步驟時發生錯誤: {ex.Message}");
                         _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                         
                         // 标记步骤为失败
                         step.Status = "Failed";
                         step.OutputJson = System.Text.Json.JsonSerializer.Serialize(new { error = ex.Message });
                         hasFailedSteps = true;
                         await _db.SaveChangesAsync();
                     }
                 }

                 // 檢查流程狀態
                 var allSteps = await _db.WorkflowStepExecutions
                     .Where(s => s.WorkflowExecutionId == execution.Id)
                     .ToListAsync();
                 
                 var completedSteps = allSteps.Count(s => s.Status == "Completed");
                 var failedSteps = allSteps.Count(s => s.Status == "Failed");
                 var totalSteps = allSteps.Count;
                 
                 _loggingService.LogInformation($"步驟完成情況: {completedSteps}/{totalSteps}");
                 
                 if (hasFailedSteps || failedSteps > 0)
                 {
                     // 如果有失敗的步驟，將整個流程標記為失敗
                     execution.Status = "Failed";
                     execution.ErrorMessage = $"流程執行失敗，有 {failedSteps} 個步驟失敗";
                     execution.EndedAt = DateTime.Now;
                     _loggingService.LogWarning($"流程執行失敗，狀態已更新為 Failed");
                 }
                 else if (completedSteps == totalSteps)
                 {
                     // 如果所有步驟都完成，將流程標記為完成
                     execution.Status = "Completed";
                     execution.EndedAt = DateTime.Now;
                     _loggingService.LogInformation($"流程執行完成，狀態已更新為 Completed");
                 }
                 else
                 {
                     // 還有步驟未完成，流程繼續執行
                     _loggingService.LogInformation($"還有 {totalSteps - completedSteps} 個步驟未完成，工作流程繼續執行");
                 }
                 
                 await _db.SaveChangesAsync();
                 _loggingService.LogInformation($"工作流程步驟處理完成");
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"處理工作流程步驟時發生錯誤: {ex.Message}");
                 _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
             }
         }

         private List<WorkflowNode> FindNextSteps(WorkflowGraph workflowGraph, string currentStepType)
         {
             try
             {
                 _loggingService.LogInformation($"開始查找下一步，當前步驟類型: {currentStepType}");
                 _loggingService.LogInformation($"流程圖節點總數: {workflowGraph.nodes.Count}");
                 
                 // 打印所有節點信息
                 foreach (var node in workflowGraph.nodes)
                 {
                     _loggingService.LogDebug($"節點 ID: {node.id}, 類型: {node.data.type}, 標籤: {node.data.label}");
                 }
                 
                 // 找到當前步驟節點 - 優先通過類型查找
                 _loggingService.LogInformation($"尋找節點類型: {currentStepType}");
                 var currentNode = workflowGraph.nodes.FirstOrDefault(n => n.data.type == currentStepType);
                 
                 // 如果找不到，嘗試通過節點ID模式查找
                 if (currentNode == null)
                 {
                     _loggingService.LogInformation($"通過類型找不到節點，嘗試通過ID模式查找...");
                     currentNode = workflowGraph.nodes.FirstOrDefault(n => n.id.Contains(currentStepType));
                 }
                 
                 // 如果還是找不到，嘗試查找所有相同類型的節點
                 if (currentNode == null)
                 {
                     _loggingService.LogInformation($"通過ID模式也找不到節點，嘗試查找所有相同類型的節點...");
                     var allMatchingNodes = workflowGraph.nodes.Where(n => n.data.type.Contains(currentStepType)).ToList();
                     if (allMatchingNodes.Any())
                     {
                         currentNode = allMatchingNodes.First();
                         _loggingService.LogInformation($"找到匹配節點: {currentNode.id}");
                     }
                 }

                 if (currentNode == null)
                 {
                     _loggingService.LogWarning($"找不到當前步驟節點: {currentStepType}");
                     return new List<WorkflowNode>();
                 }

                 _loggingService.LogInformation($"找到當前步驟節點: {currentNode.id}");

                 // 查找所有從當前節點出發的邊
                 var outgoingEdges = workflowGraph.edges.Where(e => e.source == currentNode.id).ToList();
                 _loggingService.LogInformation($"找到 {outgoingEdges.Count} 條出邊");

                 // 收集所有目標節點
                 var nextSteps = new List<WorkflowNode>();
                 foreach (var edge in outgoingEdges)
                 {
                     var targetNode = workflowGraph.nodes.FirstOrDefault(n => n.id == edge.target);
                     if (targetNode != null)
                     {
                         nextSteps.Add(targetNode.data);
                         _loggingService.LogInformation($"添加下一步: {targetNode.id} ({targetNode.data.type})");
                     }
                 }

                 return nextSteps;
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"查找下一步時發生錯誤: {ex.Message}");
                 _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                 return new List<WorkflowNode>();
             }
         }
         
         private async Task ExecuteStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             try
             {
                 _loggingService.LogInformation($"開始執行步驟: {stepExecution.StepType}，StepIndex: {stepExecution.StepIndex}");
                 
                 switch (stepExecution.StepType)
                 {
                     case "sendWhatsApp":
                         await ExecuteSendWhatsAppStep(stepExecution, dbContext, execution);
                         break;
                     case "sendWhatsAppTemplate":
                         await ExecuteSendWhatsAppTemplateStep(stepExecution, dbContext, execution);
                         break;
                     case "sendEForm":
                         await ExecuteSendEFormStep(stepExecution, dbContext, execution);
                         break;
                     case "waitReply":
                         await ExecuteWaitReplyStep(stepExecution, dbContext, execution);
                         break;
                     case "end":
                         await ExecuteEndStep(stepExecution, dbContext, execution);
                         break;
                     default:
                         _loggingService.LogWarning($"不支援的步驟類型: {stepExecution.StepType}");
                         break;
                 }
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"執行步驟時發生錯誤: {ex.Message}", ex);
                 
                 // 更新步驟狀態為失敗
                 stepExecution.Status = "Failed";
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 await dbContext.SaveChangesAsync();
             }
         }
         
         private async Task ExecuteStepWithNewContext(WorkflowStepExecution stepExecution, WorkflowExecution execution)
         {
             using var scope = _serviceProvider.CreateScope();
             var dbContext = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
             
             try
             {
                 _loggingService.LogInformation($"開始執行步驟: {stepExecution.StepType}，StepIndex: {stepExecution.StepIndex}");
                 
                 switch (stepExecution.StepType)
                 {
                     case "sendWhatsApp":
                         await ExecuteSendWhatsAppStep(stepExecution, dbContext, execution);
                         break;
                     case "sendWhatsAppTemplate":
                         await ExecuteSendWhatsAppTemplateStep(stepExecution, dbContext, execution);
                         break;
                     case "sendEForm":
                         await ExecuteSendEFormStep(stepExecution, dbContext, execution);
                         break;
                     case "waitReply":
                         await ExecuteWaitReplyStep(stepExecution, dbContext, execution);
                         break;
                     case "end":
                         await ExecuteEndStep(stepExecution, dbContext, execution);
                         break;
                     default:
                         _loggingService.LogWarning($"不支援的步驟類型: {stepExecution.StepType}");
                         break;
                 }
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"執行步驟時發生錯誤: {ex.Message}", ex);
                 
                 // 更新步驟狀態為失敗
                 stepExecution.Status = "Failed";
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 await dbContext.SaveChangesAsync();
             }
         }
         
         private async Task ExecuteSendWhatsAppStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             try
             {
                 _loggingService.LogInformation($"準備發送 WhatsApp 消息:");
                 
                 // 從步驟執行記錄中獲取輸入數據
                 var inputData = JsonSerializer.Deserialize<JsonElement>(stepExecution.InputJson);
                 
                 // 獲取收件人和消息內容
                 var to = inputData.GetProperty("to").GetString();
                 var message = inputData.GetProperty("message").GetString();
                 
                 _loggingService.LogInformation($"收件人: {to}");
                 _loggingService.LogInformation($"消息內容: {message}");

                 // 直接使用 WhatsAppWorkflowService 發送消息
                 // 該服務已經處理了公司配置、電話號碼格式化、API 調用等所有邏輯
                 await _whatsAppWorkflowService.SendWhatsAppMessageAsync(to, message, execution, dbContext);

                 // 更新步驟狀態為已完成
                 stepExecution.Status = "Completed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { success = true, messageId = "sent" });
                 
                 _loggingService.LogInformation($"WhatsApp 消息發送成功");
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"發送 WhatsApp 消息失敗: {ex.Message}");
                 _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                 
                 // 更新步驟狀態為失敗
                 stepExecution.Status = "Failed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 throw;
             }
         }
         

         
         private async Task ExecuteSendEFormStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             try
             {
                 _loggingService.LogInformation("Send EForm 步驟已在前面的流程中執行");
                 stepExecution.Status = "Completed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { success = true, message = "EForm already sent" });
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"執行 Send EForm 步驟失敗: {ex.Message}");
                 stepExecution.Status = "Failed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 throw;
             }
         }
         
         private async Task ExecuteWaitReplyStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             try
             {
                 _loggingService.LogInformation("Wait Reply 步驟已在前面的流程中執行");
                 stepExecution.Status = "Completed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { success = true, message = "Reply already received" });
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"執行 Wait Reply 步驟失敗: {ex.Message}");
                 stepExecution.Status = "Failed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 throw;
             }
         }
         
         private async Task ExecuteSendWhatsAppTemplateStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             try
             {
                 _loggingService.LogInformation("開始執行 Send WhatsApp Template 步驟");
                 
                 // 從步驟執行記錄中獲取輸入數據
                 var inputData = JsonSerializer.Deserialize<JsonElement>(stepExecution.InputJson);
                 
                 // 安全地獲取模板相關參數
                 string to = "";
                 string templateId = "";
                 
                 if (inputData.TryGetProperty("to", out var toElement))
                 {
                     to = toElement.GetString() ?? "";
                 }
                 
                 if (inputData.TryGetProperty("templateId", out var templateIdElement))
                 {
                     templateId = templateIdElement.GetString() ?? "";
                 }
                 
                 _loggingService.LogInformation($"收件人: {to}");
                 _loggingService.LogInformation($"模板 ID: {templateId}");
                 
                 // 驗證必要參數
                 if (string.IsNullOrEmpty(to))
                 {
                     throw new InvalidOperationException("缺少必要的 'to' 參數");
                 }
                 
                 if (string.IsNullOrEmpty(templateId))
                 {
                     throw new InvalidOperationException("缺少必要的 'templateId' 參數");
                 }

                 // 直接使用 WhatsAppWorkflowService 發送模板消息
                 // 該服務已經處理了公司配置、電話號碼格式化、模板查詢等所有邏輯
                 await _whatsAppWorkflowService.SendWhatsAppTemplateMessageAsync(to, templateId, execution, dbContext);

                 // 更新步驟狀態為已完成
                 stepExecution.Status = "Completed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { success = true, messageId = "template_sent" });
                 
                 _loggingService.LogInformation("WhatsApp Template 消息發送成功");
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"發送 WhatsApp Template 消息失敗: {ex.Message}");
                 _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                 
                 // 更新步驟狀態為失敗
                 stepExecution.Status = "Failed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 throw;
             }
         }
         
         private async Task ExecuteEndStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             try
             {
                 _loggingService.LogInformation("執行 End 步驟");
                 stepExecution.Status = "Completed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { success = true, message = "Workflow completed" });
                 _loggingService.LogInformation("End 步驟執行完成");
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"執行 End 步驟失敗: {ex.Message}");
                 stepExecution.Status = "Failed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 throw;
             }
         }
     }
 
          // 工作流程圖相關類別
     public class WorkflowGraph
     {
         public List<WorkflowNodeWrapper> nodes { get; set; } = new();
         public List<WorkflowEdge> edges { get; set; } = new();
     }
 
     public class WorkflowNodeWrapper
     {
         public string id { get; set; } = "";
         public string type { get; set; } = "";
         public WorkflowNode data { get; set; } = new();
     }
 
     public class WorkflowNode
     {
         public string label { get; set; } = "";
         public string type { get; set; } = "";
         public string taskName { get; set; } = "";
         public string message { get; set; } = "";
         public string to { get; set; } = "";
         public string templateName { get; set; } = "";
         public string templateId { get; set; } = "";
         public string formName { get; set; } = "";
         public string formId { get; set; } = "";
         public string formDescription { get; set; } = "";
     }
 
     public class WorkflowEdge
     {
         public string source { get; set; } = "";
         public string target { get; set; } = "";
     }

    public class ApprovalRequest
    {
        public string ApprovedBy { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
    }
} 