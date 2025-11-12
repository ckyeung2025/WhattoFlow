IF COL_LENGTH('dbo.workflow_step_executions', 'ReceivedPayloadJson') IS NULL
BEGIN
    ALTER TABLE dbo.workflow_step_executions
    ADD ReceivedPayloadJson NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.workflow_step_executions', 'AiResultJson') IS NULL
BEGIN
    ALTER TABLE dbo.workflow_step_executions
    ADD AiResultJson NVARCHAR(MAX) NULL;
END;
