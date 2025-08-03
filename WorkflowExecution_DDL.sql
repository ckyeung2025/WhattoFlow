-- 創建 WorkflowExecution 表
CREATE TABLE [dbo].[workflow_executions] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [WorkflowDefinitionId] INT NOT NULL,
    [Status] NVARCHAR(50) NOT NULL,
    [CurrentStep] INT NULL,
    [InputJson] NVARCHAR(MAX) NULL,
    [OutputJson] NVARCHAR(MAX) NULL,
    [StartedAt] DATETIME2 NOT NULL,
    [EndedAt] DATETIME2 NULL,
    [CreatedBy] NVARCHAR(100) NULL,
    CONSTRAINT [FK_workflow_executions_WorkflowDefinitions] FOREIGN KEY ([WorkflowDefinitionId]) REFERENCES [dbo].[WorkflowDefinitions]([Id])
);

-- 創建 WorkflowStepExecution 表
CREATE TABLE [dbo].[workflow_step_executions] (
    [Id] INT IDENTITY(1,1) PRIMARY KEY,
    [WorkflowExecutionId] INT NOT NULL,
    [StepIndex] INT NOT NULL,
    [StepType] NVARCHAR(100) NOT NULL,
    [Status] NVARCHAR(50) NOT NULL,
    [InputJson] NVARCHAR(MAX) NULL,
    [OutputJson] NVARCHAR(MAX) NULL,
    [StartedAt] DATETIME2 NULL,
    [EndedAt] DATETIME2 NULL,
    CONSTRAINT [FK_workflow_step_executions_workflow_executions] FOREIGN KEY ([WorkflowExecutionId]) REFERENCES [dbo].[workflow_executions]([Id])
);

-- 創建索引以提高查詢性能
CREATE INDEX [IX_workflow_executions_WorkflowDefinitionId] ON [dbo].[workflow_executions] ([WorkflowDefinitionId]);
CREATE INDEX [IX_workflow_executions_Status] ON [dbo].[workflow_executions] ([Status]);
CREATE INDEX [IX_workflow_step_executions_WorkflowExecutionId] ON [dbo].[workflow_step_executions] ([WorkflowExecutionId]);
CREATE INDEX [IX_workflow_step_executions_StepIndex] ON [dbo].[workflow_step_executions] ([StepIndex]);