/* ======================================================================
   移除 ApiProviderDefinitions 表中的 Description 欄位
   描述已改為使用語言包管理，不再需要數據庫欄位
   ====================================================================== */
BEGIN TRY
    BEGIN TRANSACTION;

    /* ---------- 檢查並移除 Description 欄位 ---------- */
    IF COL_LENGTH('dbo.ApiProviderDefinitions', 'Description') IS NOT NULL
    BEGIN
        ALTER TABLE dbo.ApiProviderDefinitions
        DROP COLUMN Description;
        
        PRINT 'Description column has been removed from ApiProviderDefinitions table.';
    END
    ELSE
    BEGIN
        PRINT 'Description column does not exist in ApiProviderDefinitions table.';
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState    INT = ERROR_STATE();

    RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
GO

