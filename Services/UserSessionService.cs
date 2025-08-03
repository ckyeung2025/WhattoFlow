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
                SessionStartTime = DateTime.Now,
                LastActivityTime = DateTime.Now,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
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
            
            // 如果有其他活動流程，先結束它
            if (session.CurrentWorkflowExecutionId.HasValue && session.CurrentWorkflowExecutionId.Value != workflowExecutionId)
            {
                var oldExecution = await _context.WorkflowExecutions.FindAsync(session.CurrentWorkflowExecutionId.Value);
                if (oldExecution != null)
                {
                    oldExecution.Status = "Cancelled";
                    oldExecution.IsWaiting = false;
                }
            }

            // 更新會話
            session.CurrentWorkflowExecutionId = workflowExecutionId;
            session.LastActivityTime = DateTime.Now;
            session.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// 獲取用戶當前活動的流程執行
        /// </summary>
        public async Task<WorkflowExecution> GetCurrentUserWorkflowAsync(string userWaId)
        {
            var session = await _context.UserSessions
                .Include(s => s.CurrentWorkflowExecution)
                .FirstOrDefaultAsync(s => s.UserWaId == userWaId && s.Status == "Active");

            return session?.CurrentWorkflowExecution;
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
                session.UpdatedAt = DateTime.Now;
                await _context.SaveChangesAsync();
            }
        }
    }
} 