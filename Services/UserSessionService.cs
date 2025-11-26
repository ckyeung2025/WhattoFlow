using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;

namespace PurpleRice.Services
{
    public class UserSessionService
    {
        private readonly PurpleRiceDbContext _context;

        public UserSessionService(PurpleRiceDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// 獲取或創建用戶會話
        /// </summary>
        public async Task<UserSession> GetOrCreateUserSessionAsync(string userWaId)
        {
            var existingSession = await _context.UserSessions
                .FirstOrDefaultAsync(s => s.UserWaId == userWaId && s.Status == "Active");

            if (existingSession != null)
            {
                return existingSession;
            }

            var newSession = new UserSession
            {
                UserWaId = userWaId,
                Status = "Active",
                SessionStartTime = DateTime.UtcNow,
                LastActivityTime = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.UserSessions.Add(newSession);
            await _context.SaveChangesAsync();

            return newSession;
        }

        /// <summary>
        /// 更新用戶會話的當前流程
        /// </summary>
        public async Task UpdateUserSessionWorkflowAsync(string userWaId, int workflowExecutionId)
        {
            var session = await GetOrCreateUserSessionAsync(userWaId);
            
            // 如果有其他活動流程，只取消未完成的流程
            if (session.CurrentWorkflowExecutionId.HasValue && session.CurrentWorkflowExecutionId.Value != workflowExecutionId)
            {
                var oldExecution = await _context.WorkflowExecutions.FindAsync(session.CurrentWorkflowExecutionId.Value);
                if (oldExecution != null)
                {
                    // 只有未完成的流程才應該被取消，但排除 eform 等待審批的流程
                    // eform 等待審批不會干擾 WhatsApp 對話會話，因此不應該被取消
                    if (oldExecution.Status != "Completed" && 
                        oldExecution.Status != "Cancelled" && 
                        oldExecution.Status != "Failed" &&
                        oldExecution.Status != "WaitingForFormApproval")
                    {
                        // ✅ 改進：檢查流程是否已經轉移到其他人
                        // 如果 WaitingForUser 不等於 InitiatedBy，說明流程已經不在等待啟動者
                        // 這種情況下不應該取消，因為流程已經轉移到其他人操作
                        bool isWaitingForInitiator = string.IsNullOrEmpty(oldExecution.WaitingForUser) || 
                                                    string.IsNullOrEmpty(oldExecution.InitiatedBy) ||
                                                    oldExecution.WaitingForUser == oldExecution.InitiatedBy;
                        
                        // ✅ 改進：只有當流程還在等待啟動者且處於等待狀態時才取消
                        // 如果流程已經轉移到其他人（WaitingForUser != InitiatedBy），則不取消
                        if (isWaitingForInitiator && oldExecution.IsWaiting)
                        {
                            oldExecution.Status = "Cancelled";
                            oldExecution.IsWaiting = false;
                            oldExecution.EndedAt = DateTime.UtcNow;
                        }
                    }
                }
            }

            // 更新會話
            session.CurrentWorkflowExecutionId = workflowExecutionId;
            session.LastActivityTime = DateTime.UtcNow;
            session.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// 獲取用戶當前活動的流程執行
        /// </summary>
        public async Task<WorkflowExecution> GetCurrentUserWorkflowAsync(string userWaId)
        {
            // ✅ 修復：只查詢 WaitingForUser 匹配的流程，不檢查 UserSession
            // 因為當流程轉移到新的 waitReply 節點時，WaitingForUser 會改變，但 UserSession 可能還指向舊的流程
            var waitingWorkflow = await _context.WorkflowExecutions
                .Where(w => w.WaitingForUser == userWaId && 
                           (w.Status == "Waiting" || w.Status == "WaitingForQRCode") && 
                           w.IsWaiting)
                .OrderByDescending(w => w.WaitingSince)
                .FirstOrDefaultAsync();

            if (waitingWorkflow != null)
            {
                return waitingWorkflow;
            }

            // ❌ 移除 UserSession 檢查，因為它可能指向 WaitingForUser 已經改變的流程
            // 這會導致錯誤匹配：例如流程 2668 的 WaitingForUser 已經改為 85260166232，
            // 但 UserSession 還指向這個流程，導致司機 85296366318 的訊息被錯誤匹配
            
            return null;
        }

        /// <summary>
        /// 清理已完成的流程的會話
        /// </summary>
        public async Task ClearCompletedWorkflowFromSessionAsync(int workflowExecutionId)
        {
            var session = await _context.UserSessions
                .FirstOrDefaultAsync(s => s.CurrentWorkflowExecutionId == workflowExecutionId);

            if (session != null)
            {
                session.CurrentWorkflowExecutionId = null;
                session.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        /// <summary>
        /// 結束用戶會話
        /// </summary>
        public async Task EndUserSessionAsync(string userWaId)
        {
            var session = await _context.UserSessions
                .FirstOrDefaultAsync(s => s.UserWaId == userWaId && s.Status == "Active");

            if (session != null)
            {
                session.Status = "Inactive";
                session.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }
    }
} 