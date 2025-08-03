using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using PurpleRice.Services;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowExecutionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _db;
        private readonly WorkflowEngine _engine;
        public WorkflowExecutionsController(PurpleRiceDbContext db, WorkflowEngine engine)
        {
            _db = db;
            _engine = engine;
        }

        // POST: api/workflowexecutions/start
        [HttpPost("start")] // body: { workflowDefinitionId: 1, input: {...} }
        public async Task<IActionResult> Start([FromBody] WorkflowStartRequest req)
        {
            var def = await _db.WorkflowDefinitions.FindAsync(req.WorkflowDefinitionId);
            if (def == null) return NotFound("Workflow definition not found");

            var execution = new WorkflowExecution
            {
                WorkflowDefinitionId = def.Id,
                Status = "Running",
                CurrentStep = 0,
                InputJson = req.Input != null ? JsonSerializer.Serialize(req.Input) : null,
                StartedAt = DateTime.Now
            };
            _db.WorkflowExecutions.Add(execution);
            await _db.SaveChangesAsync();

            // 執行流程
            await _engine.ExecuteWorkflowAsync(execution);

            return Ok(new { executionId = execution.Id, status = execution.Status });
        }

        // GET: api/workflowexecutions/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var exec = await _db.WorkflowExecutions
                .Include(e => e.StepExecutions)
                .FirstOrDefaultAsync(e => e.Id == id);
            if (exec == null) return NotFound();
            return Ok(exec);
        }

        // POST: api/workflowexecutions/{id}/resume
        [HttpPost("{id}/resume")]
        public async Task<IActionResult> Resume(int id, [FromBody] Dictionary<string, object> input)
        {
            var exec = await _db.WorkflowExecutions.Include(e => e.WorkflowDefinition).FirstOrDefaultAsync(e => e.Id == id);
            if (exec == null) return NotFound();
            if (exec.Status != "Waiting") return BadRequest("Workflow is not waiting");
            exec.Status = "Running";
            exec.InputJson = input != null ? JsonSerializer.Serialize(input) : null;
            await _engine.ExecuteWorkflowAsync(exec);
            return Ok(new { executionId = exec.Id, status = exec.Status });
        }
    }

    public class WorkflowStartRequest
    {
        public int WorkflowDefinitionId { get; set; }
        public Dictionary<string, object> Input { get; set; }
    }
} 