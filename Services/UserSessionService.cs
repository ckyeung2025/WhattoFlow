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
                    oldExecution.Status = "Cancelled";
                    oldExecution.IsWaiting = false;
                    oldExecution.EndedAt = DateTime.UtcNow;
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
            // 直接查詢等待中的流程執行，包括 Waiting 和 WaitingForQRCode 狀態
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

            // 如果沒有找到等待中的流程，再檢查 UserSession
            var session = await _context.UserSessions
                .Include(s => s.CurrentWorkflowExecution)
                .FirstOrDefaultAsync(s => s.UserWaId == userWaId && s.Status == "Active");

            var workflow = session?.CurrentWorkflowExecution;
            
            // 檢查流程是否真的在等待狀態
            if (workflow != null && (workflow.Status == "Waiting" || workflow.Status == "WaitingForQRCode") && workflow.IsWaiting)
            {
                return workflow;
            }
            
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