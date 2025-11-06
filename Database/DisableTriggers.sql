-- 臨時禁用 contact_import_schedules 表的觸發器以支援 EF Core
-- 如果需要觸發器功能，請在應用中手動維護 updated_at

IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_contact_import_schedules_updated_at')
BEGIN
    PRINT '禁 Contact Import Schedule Trigger...';
    ALTER TABLE [dbo].[contact_import_schedules] DISABLE TRIGGER [TR_contact_import_schedules_updated_at];
    PRINT '✅ Trigger 已禁用';
END
ELSE
BEGIN
    PRINT '⚠️ Trigger 不存在';
END
GO

