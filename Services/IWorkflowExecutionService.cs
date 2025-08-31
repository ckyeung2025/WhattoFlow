using PurpleRice.Models;
using System.Threading.Tasks;

namespace PurpleRice.Services
{
    /// <summary>
    /// 工作流程執行服務介面
    /// </summary>
    public interface IWorkflowExecutionService
    {
        /// <summary>
        /// 執行工作流程
        /// </summary>
        /// <param name="workflow">工作流程定義</param>
        /// <param name="execution">執行記錄</param>
        /// <param name="inputData">輸入數據</param>
        /// <returns></returns>
        Task ExecuteWorkflowAsync(WorkflowDefinition workflow, WorkflowExecution execution, object inputData);
    }
}
