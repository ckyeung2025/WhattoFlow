using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
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
         
         public EFormInstancesController(PurpleRiceDbContext db, IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, Func<string, LoggingService> loggingServiceFactory)
         {
             _db = db;
             _serviceProvider = serviceProvider;
             _whatsAppWorkflowService = whatsAppWorkflowService;
             _loggingService = loggingServiceFactory("EFormInstancesController");
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
                var executionId = instance.WorkflowExecutionId;
                
                // 在主線程中執行，避免 disposed 問題
                try
                {
                    _loggingService.LogInformation($"開始執行 ContinueWorkflowExecution");
                    await ContinueWorkflowExecution(executionId);
                    _loggingService.LogInformation($"ContinueWorkflowExecution 完成");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"工作流程執行失敗: {ex.Message}", ex);
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

                Console.WriteLine($"準備創建審批記錄");

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

                Console.WriteLine($"審批記錄已保存，繼續執行工作流程");

                // 繼續執行工作流程
                Console.WriteLine($"準備執行工作流程，WorkflowExecutionId: {instance.WorkflowExecutionId}");
                var executionId = instance.WorkflowExecutionId;
                
                // 在主線程中執行，避免 disposed 問題
                try
                {
                    Console.WriteLine($"開始執行 ContinueWorkflowExecution");
                    await ContinueWorkflowExecution(executionId);
                    Console.WriteLine($"ContinueWorkflowExecution 完成");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"工作流程執行失敗: {ex.Message}");
                    Console.WriteLine($"錯誤堆疊: {ex.StackTrace}");
                }

                Console.WriteLine($"拒絕操作完成，返回成功響應");

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
                Console.WriteLine($"拒絕表單時發生錯誤: {ex.Message}");
                Console.WriteLine($"錯誤堆疊: {ex.StackTrace}");
                return StatusCode(500, new { error = $"拒絕表單失敗: {ex.Message}" });
            }
        }

                 private async Task ContinueWorkflowExecution(int executionId)
         {
             try
             {
                 Console.WriteLine($"繼續執行工作流程，執行ID: {executionId}");
                 
                 // 使用 IServiceProvider 來創建獨立的 service scope
                 using (var scope = _serviceProvider.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                    
                    var execution = await dbContext.WorkflowExecutions
                        .FirstOrDefaultAsync(e => e.Id == executionId);

                    if (execution == null)
                    {
                        Console.WriteLine($"找不到工作流程執行記錄，ID: {executionId}");
                        return;
                    }

                    Console.WriteLine($"找到工作流程執行記錄，當前狀態: {execution.Status}，當前步驟: {execution.CurrentStep}");

                    // 更新工作流程執行狀態
                    execution.Status = "Completed";
                    execution.EndedAt = DateTime.UtcNow;
                    await dbContext.SaveChangesAsync();

                    Console.WriteLine($"工作流程執行狀態已更新為 Completed");

                    // 查找並更新相關的 workflow_step_executions
                    var stepExecutions = await dbContext.WorkflowStepExecutions
                        .Where(wse => wse.WorkflowExecutionId == executionId)
                        .ToListAsync();

                    Console.WriteLine($"找到 {stepExecutions.Count} 個步驟執行記錄");

                    // 獲取工作流程定義來了解流程圖結構
                    var workflowDefinition = await dbContext.WorkflowDefinitions
                        .FirstOrDefaultAsync(wd => wd.Id == execution.WorkflowDefinitionId);
                    
                    if (workflowDefinition == null)
                    {
                        Console.WriteLine($"找不到工作流程定義，WorkflowDefinitionId: {execution.WorkflowDefinitionId}");
                        return;
                    }

                    Console.WriteLine($"找到工作流程定義: {workflowDefinition.Name}");

                                                             // 解析流程圖 JSON
                    Console.WriteLine($"工作流程定義 JSON: {workflowDefinition.Json}");
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };
                    var workflowNodes = JsonSerializer.Deserialize<WorkflowGraph>(workflowDefinition.Json, options);
                     if (workflowNodes == null)
                     {
                         Console.WriteLine($"無法解析工作流程圖 JSON");
                         return;
                     }
                     
                                           Console.WriteLine($"流程圖節點數量: {workflowNodes.nodes.Count}");
                      Console.WriteLine($"流程圖邊數量: {workflowNodes.edges.Count}");

                                                                                   // 找到所有需要處理的步驟
                     var stepsToProcess = stepExecutions.Where(wse => wse.StepType == "sendEForm" || wse.StepType == "sendWhatsApp" || wse.StepType == "waitReply").ToList();
                     Console.WriteLine($"找到 {stepsToProcess.Count} 個需要處理的步驟");
                     
                     foreach (var step in stepsToProcess)
                     {
                         Console.WriteLine($"處理步驟: {step.StepType} (ID: {step.Id})，當前狀態: {step.Status}");
                         
                         // 強制補正步驟狀態為已完成
                         if (step.Status != "Completed")
                         {
                             step.Status = "Completed";
                             step.EndedAt = DateTime.Now;
                             Console.WriteLine($"強制將 {step.StepType} 步驟設為 Completed，EndedAt: {step.EndedAt}");
                         }
                     }

                                           // 處理所有類型的節點
                      Console.WriteLine($"開始處理工作流程步驟...");
                      await ProcessWorkflowSteps(workflowNodes, stepExecutions, executionId, dbContext, execution);

                    await dbContext.SaveChangesAsync();
                    Console.WriteLine($"所有步驟執行記錄已更新完成");
                }

                Console.WriteLine($"工作流程執行已完成");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"繼續執行工作流程失敗: {ex.Message}");
                Console.WriteLine($"錯誤堆疊: {ex.StackTrace}");
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
                Console.WriteLine($"更新工作流程執行狀態失敗: {ex.Message}");
            }
        }

                 private async Task ProcessWorkflowSteps(WorkflowGraph workflowGraph, List<WorkflowStepExecution> stepExecutions, int executionId, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             try
             {
                 _loggingService.LogInformation($"開始處理工作流程步驟，總步驟數: {stepExecutions.Count}");
                 
                 // 找到所有已完成的步驟，按 StepIndex 排序
                 var completedSteps = stepExecutions.Where(wse => wse.Status == "Completed").OrderBy(wse => wse.StepIndex).ToList();
                 _loggingService.LogInformation($"已完成的步驟數: {completedSteps.Count}");
                 
                 // 只處理最後一個已完成的步驟，避免重複處理
                 var lastCompletedStep = completedSteps.LastOrDefault();
                 if (lastCompletedStep != null)
                 {
                     _loggingService.LogInformation($"處理最後一個已完成的步驟: {lastCompletedStep.StepType} (ID: {lastCompletedStep.Id})");
                     
                     // 根據流程圖找到所有下一步
                     var nextSteps = FindNextSteps(workflowGraph, lastCompletedStep.StepType);
                     _loggingService.LogInformation($"FindNextSteps 返回結果數量: {nextSteps.Count}");
                     
                     if (nextSteps.Any())
                     {
                         _loggingService.LogInformation($"根據流程圖找到 {nextSteps.Count} 個下一步");
                         
                         // 找到下一個可用的 StepIndex
                         var baseStepIndex = stepExecutions.Max(wse => wse.StepIndex) + 1;
                         _loggingService.LogInformation($"基礎 StepIndex: {baseStepIndex}");
                         
                         // 創建並執行所有並行步驟
                         var tasks = new List<Task>();
                         for (int i = 0; i < nextSteps.Count; i++)
                         {
                             var nextStep = nextSteps[i];
                             var stepIndex = baseStepIndex + i;
                             
                             _loggingService.LogInformation($"創建並行步驟 {i + 1}: {nextStep.type}，StepIndex: {stepIndex}");
                             _loggingService.LogInformation($"步驟詳細信息: {JsonSerializer.Serialize(nextStep)}");
                             
                             // 創建步驟執行記錄
                             var newStepExecution = new WorkflowStepExecution
                             {
                                 WorkflowExecutionId = executionId,
                                 StepIndex = stepIndex,
                                 StepType = nextStep.type,
                                 Status = nextStep.type == "end" ? "Completed" : "Running",
                                 StartedAt = DateTime.Now,
                                 EndedAt = nextStep.type == "end" ? DateTime.Now : (DateTime?)null,
                                 InputJson = JsonSerializer.Serialize(nextStep),
                                 OutputJson = nextStep.type == "end" ? "{\"message\":\"Workflow completed successfully\"}" : null
                             };
                             
                             // 使用主 DbContext 保存步驟執行記錄
                             dbContext.WorkflowStepExecutions.Add(newStepExecution);
                             await dbContext.SaveChangesAsync();
                             _loggingService.LogInformation($"創建步驟執行記錄: {nextStep.type}，StepIndex: {newStepExecution.StepIndex}");
                             
                             // 並行執行步驟 - 使用新的 DbContext 實例
                             var task = ExecuteStepWithNewContext(newStepExecution, execution);
                             tasks.Add(task);
                         }
                         
                         // 等待所有並行步驟完成
                         if (tasks.Any())
                         {
                             _loggingService.LogInformation($"等待 {tasks.Count} 個並行步驟完成...");
                             await Task.WhenAll(tasks);
                             _loggingService.LogInformation($"所有並行步驟執行完成");
                         }
                         
                         // 如果是 end 節點，立即完成
                         if (nextSteps.Any(s => s.type == "end"))
                         {
                             _loggingService.LogInformation($"工作流程已到達終點");
                         }
                     }
                     else
                     {
                         _loggingService.LogWarning($"找不到 {lastCompletedStep.StepType} 的下一步");
                         
                         // 如果找不到下一步，但流程圖有 end 節點，強制插入 end 步驟
                         var endNodes = workflowGraph.nodes.Where(n => n.data.type == "end").ToList();
                         if (endNodes.Any())
                         {
                             var alreadyHasEnd = stepExecutions.Any(wse => wse.StepType == "end");
                             if (!alreadyHasEnd)
                             {
                                 // 為每個 end 節點創建執行記錄
                                 var baseStepIndex = stepExecutions.Max(wse => wse.StepIndex) + 1;
                                 for (int i = 0; i < endNodes.Count; i++)
                                 {
                                     var endNode = endNodes[i];
                                     var stepIndex = baseStepIndex + i;
                                     
                                     var newEndStep = new WorkflowStepExecution
                                     {
                                         WorkflowExecutionId = executionId,
                                         StepIndex = stepIndex,
                                         StepType = "end",
                                         Status = "Completed",
                                         StartedAt = DateTime.Now,
                                         EndedAt = DateTime.Now,
                                         InputJson = JsonSerializer.Serialize(endNode.data),
                                         OutputJson = "{\"message\":\"Workflow completed successfully\"}"
                                     };
                                     dbContext.WorkflowStepExecutions.Add(newEndStep);
                                     _loggingService.LogInformation($"強制插入 end 步驟 {i + 1}，StepIndex: {newEndStep.StepIndex}");
                                 }
                             }
                         }
                         else
                         {
                             _loggingService.LogWarning($"流程圖中找不到 end 節點，無法插入 end 步驟");
                         }
                     }
                 }
                 else
                 {
                     _loggingService.LogWarning($"沒有找到已完成的步驟");
                 }
                 
                 Console.WriteLine($"工作流程步驟處理完成");
             }
             catch (Exception ex)
             {
                 Console.WriteLine($"處理工作流程步驟時發生錯誤: {ex.Message}");
                 Console.WriteLine($"錯誤堆疊: {ex.StackTrace}");
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
                     _loggingService.LogInformation($"節點 ID: {node.id}, 類型: {node.data.type}, 標籤: {node.data.label}");
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
                     var nodesWithSameType = workflowGraph.nodes.Where(n => n.data.type == currentStepType).ToList();
                     if (nodesWithSameType.Any())
                     {
                         currentNode = nodesWithSameType.First();
                         _loggingService.LogInformation($"找到相同類型的節點: {currentNode.id}");
                     }
                 }
                 
                 if (currentNode == null)
                 {
                     _loggingService.LogWarning($"在流程圖中找不到步驟: {currentStepType}");
                     _loggingService.LogInformation($"可用的節點類型:");
                     foreach (var node in workflowGraph.nodes)
                     {
                         _loggingService.LogInformation($"  - {node.data.type} (ID: {node.id})");
                     }
                     return new List<WorkflowNode>();
                 }
                 
                 _loggingService.LogInformation($"找到當前節點，ID: {currentNode.id}");

                 // 找到從當前步驟出發的所有邊
                 _loggingService.LogInformation($"查找從節點 {currentNode.id} 出發的邊...");
                 _loggingService.LogInformation($"流程圖邊總數: {workflowGraph.edges.Count}");
                 
                 // 打印所有邊信息
                 foreach (var edge in workflowGraph.edges)
                 {
                     _loggingService.LogInformation($"邊: {edge.source} -> {edge.target}");
                 }
                 
                 _loggingService.LogInformation($"尋找從節點 {currentNode.id} 出發的邊...");
                 var outgoingEdges = workflowGraph.edges.Where(e => e.source == currentNode.id).ToList();
                 
                 // 如果找不到，嘗試通過節點類型查找
                 if (!outgoingEdges.Any())
                 {
                     _loggingService.LogInformation($"通過節點ID找不到邊，嘗試通過節點類型查找...");
                     var nodesWithSameType = workflowGraph.nodes.Where(n => n.data.type == currentStepType).ToList();
                     foreach (var node in nodesWithSameType)
                     {
                         var edges = workflowGraph.edges.Where(e => e.source == node.id).ToList();
                         if (edges.Any())
                         {
                             outgoingEdges = edges;
                             _loggingService.LogInformation($"找到邊: {string.Join(", ", edges.Select(e => $"{e.source} -> {e.target}"))}");
                             break;
                         }
                     }
                 }
                 
                 if (!outgoingEdges.Any())
                 {
                     _loggingService.LogWarning($"找不到從 {currentStepType} 出發的邊");
                     _loggingService.LogInformation($"可用的邊:");
                     foreach (var edge in workflowGraph.edges)
                     {
                         _loggingService.LogInformation($"  - {edge.source} -> {edge.target}");
                     }
                     return new List<WorkflowNode>();
                 }
                 
                 _loggingService.LogInformation($"找到出發邊數量: {outgoingEdges.Count}");
                 foreach (var edge in outgoingEdges)
                 {
                     _loggingService.LogInformation($"出發邊: {edge.source} -> {edge.target}");
                 }

                 // 找到所有目標節點
                 var targetNodes = new List<WorkflowNode>();
                 foreach (var edge in outgoingEdges)
                 {
                     var targetNode = workflowGraph.nodes.FirstOrDefault(n => n.id == edge.target);
                     if (targetNode != null)
                     {
                         _loggingService.LogInformation($"找到目標節點，ID: {targetNode.id}，類型: {targetNode.data.type}，標籤: {targetNode.data.label}");
                         targetNodes.Add(targetNode.data);
                     }
                     else
                     {
                         _loggingService.LogWarning($"找不到目標節點: {edge.target}");
                     }
                 }

                 _loggingService.LogInformation($"總共找到 {targetNodes.Count} 個下一步節點");
                 return targetNodes;
             }
             catch (Exception ex)
             {
                 Console.WriteLine($"查找下一步時發生錯誤: {ex.Message}");
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
                 _loggingService.LogInformation($"執行 Send WhatsApp 步驟");
                 _loggingService.LogInformation($"步驟輸入 JSON: {stepExecution.InputJson}");
                 
                 // 解析步驟配置 - 使用 WorkflowNode 結構
                 var options = new JsonSerializerOptions
                 {
                     PropertyNameCaseInsensitive = true
                 };
                 var stepConfig = JsonSerializer.Deserialize<WorkflowNode>(stepExecution.InputJson, options);
                 
                 _loggingService.LogInformation($"解析後的步驟配置:");
                 _loggingService.LogInformation($"  label: {stepConfig.label}");
                 _loggingService.LogInformation($"  type: {stepConfig.type}");
                 _loggingService.LogInformation($"  taskName: {stepConfig.taskName}");
                 _loggingService.LogInformation($"  message: {stepConfig.message}");
                 _loggingService.LogInformation($"  to: {stepConfig.to}");
                 
                 // 檢查必要參數
                 if (string.IsNullOrEmpty(stepConfig.message))
                 {
                     throw new Exception("步驟配置中缺少 message 參數或為空");
                 }
                 
                 if (string.IsNullOrEmpty(stepConfig.to))
                 {
                     throw new Exception("步驟配置中缺少 to 參數或為空");
                 }
                 
                 // 使用統一的 WhatsApp 服務 - 它會自己處理 DbContext
                 await _whatsAppWorkflowService.SendWhatsAppMessageAsync(stepConfig.to, stepConfig.message, execution);
                 
                 // 更新步驟狀態
                 stepExecution.Status = "Completed";
                 stepExecution.EndedAt = DateTime.Now;
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { 
                     success = true, 
                     message = "WhatsApp message sent successfully"
                 });
                 
                 await dbContext.SaveChangesAsync();
                 _loggingService.LogInformation($"Send WhatsApp 步驟執行完成");
             }
             catch (Exception ex)
             {
                 _loggingService.LogError($"執行 Send WhatsApp 步驟時發生錯誤: {ex.Message}", ex);
                 
                 // 更新步驟狀態為失敗
                 stepExecution.Status = "Failed";
                 stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                 await dbContext.SaveChangesAsync();
                 
                 throw;
             }
         }
         
         private async Task<string> SendWhatsAppMessage(Company company, string to, string message)
         {
             try
             {
                 // 驗證必要參數
                 if (string.IsNullOrEmpty(message))
                 {
                     throw new Exception("消息內容不能為空");
                 }
                 
                 if (string.IsNullOrEmpty(to))
                 {
                     throw new Exception("收件人電話號碼不能為空");
                 }
                 
                 if (string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                 {
                     throw new Exception("公司 WhatsApp Phone Number ID 不能為空");
                 }
                 
                 if (string.IsNullOrEmpty(company.WA_API_Key))
                 {
                     throw new Exception("公司 WhatsApp API Key 不能為空");
                 }
                 
                 Console.WriteLine($"準備發送 WhatsApp 消息:");
                 Console.WriteLine($"收件人: {to}");
                 Console.WriteLine($"消息內容: {message}");
                 Console.WriteLine($"Phone Number ID: {company.WA_PhoneNo_ID}");
                 
                 // 格式化電話號碼
                 var formattedTo = FormatPhoneNumber(to);
                 Console.WriteLine($"格式化後電話號碼: {formattedTo}");
                 
                 // 發送 WhatsApp 消息
                 var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                 
                 var payload = new
                 {
                     messaging_product = "whatsapp",
                     to = formattedTo,
                     type = "text",
                     text = new { body = message }
                 };
                 
                 var json = JsonSerializer.Serialize(payload);
                 Console.WriteLine($"發送的 JSON payload: {json}");
                 
                 var content = new StringContent(json, Encoding.UTF8, "application/json");
                 
                 using var client = new HttpClient();
                 client.DefaultRequestHeaders.Add("Authorization", $"Bearer {company.WA_API_Key}");
                 
                 var response = await client.PostAsync(url, content);
                 var responseContent = await response.Content.ReadAsStringAsync();
                 
                 Console.WriteLine($"WhatsApp API 響應狀態碼: {response.StatusCode}");
                 Console.WriteLine($"WhatsApp API 響應內容: {responseContent}");
                 
                 if (response.IsSuccessStatusCode)
                 {
                     return "Message sent successfully";
                 }
                 else
                 {
                     throw new Exception($"WhatsApp API 錯誤: {responseContent}");
                 }
             }
             catch (Exception ex)
             {
                 Console.WriteLine($"發送 WhatsApp 消息失敗: {ex.Message}");
                 throw;
             }
         }
         
         /// <summary>
         /// 格式化電話號碼
         /// </summary>
         /// <param name="phoneNumber">原始電話號碼</param>
         /// <returns>格式化後的電話號碼</returns>
         private string FormatPhoneNumber(string phoneNumber)
         {
             var countryCode = "852"; // 暫時硬編碼香港區號，可以之後從公司設定獲取
             
             // 檢查電話號碼是否已經包含國家代碼
             if (!phoneNumber.StartsWith(countryCode))
             {
                 // 移除開頭的 0（如果有的話）
                 if (phoneNumber.StartsWith("0"))
                 {
                     phoneNumber = phoneNumber.Substring(1);
                 }
                 // 添加國家代碼
                 return countryCode + phoneNumber;
             }
             else
             {
                 // 已經包含國家代碼，直接使用
                 return phoneNumber;
             }
         }
         
         private async Task ExecuteSendEFormStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             // 這個步驟通常在工作流程啟動時已經執行過了
             Console.WriteLine($"Send EForm 步驟已在前面的流程中執行");
         }
         
         private async Task ExecuteWaitReplyStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             // WaitReply 步驟通常在工作流程啟動時已經執行過了
             Console.WriteLine($"Wait Reply 步驟已在前面的流程中執行");
         }
         
         private async Task ExecuteEndStep(WorkflowStepExecution stepExecution, PurpleRiceDbContext dbContext, WorkflowExecution execution)
         {
             Console.WriteLine($"執行 End 步驟");
             
             stepExecution.Status = "Completed";
             stepExecution.EndedAt = DateTime.Now;
             stepExecution.OutputJson = JsonSerializer.Serialize(new { message = "Workflow completed successfully" });
             
             await dbContext.SaveChangesAsync();
             Console.WriteLine($"End 步驟執行完成");
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
        public string ApprovedBy { get; set; }
        public string Note { get; set; }
    }
} 