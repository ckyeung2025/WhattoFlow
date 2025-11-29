/* ======================================================================
   新增 Microsoft Graph API (O365 Email Server) Provider
   ====================================================================== */
BEGIN TRY
    BEGIN TRANSACTION;

    /* ---------- 插入 Microsoft Graph API Provider ---------- */
    MERGE dbo.ApiProviderDefinitions AS target
    USING (VALUES
        ('EmailServer', 'microsoft-graph', N'Microsoft Graph API (O365 Email)', N'microsoft',
         N'https://graph.microsoft.com/v1.0/users/{userPrincipalName}/sendMail',
         NULL, NULL,
         0, NULL, NULL,
         N'oauth',
         N'{"fromEmail":"","replyTo":"","saveToSentItems":true}')
    ) AS source (
        Category, ProviderKey, DisplayName, IconName,
        DefaultApiUrl, DefaultModel, SupportedModels,
        EnableStreaming, TemperatureMin, TemperatureMax,
        AuthType, DefaultSettingsJson
    )
    ON target.ProviderKey = source.ProviderKey
    WHEN MATCHED THEN
        UPDATE SET
            Category            = source.Category,
            DisplayName         = source.DisplayName,
            IconName            = source.IconName,
            DefaultApiUrl       = source.DefaultApiUrl,
            DefaultModel        = source.DefaultModel,
            SupportedModels     = source.SupportedModels,
            EnableStreaming     = source.EnableStreaming,
            TemperatureMin      = source.TemperatureMin,
            TemperatureMax      = source.TemperatureMax,
            AuthType            = source.AuthType,
            DefaultSettingsJson = source.DefaultSettingsJson,
            UpdatedAt           = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Category, ProviderKey, DisplayName, IconName, DefaultApiUrl,
                DefaultModel, SupportedModels,
                EnableStreaming, TemperatureMin, TemperatureMax,
                AuthType, DefaultSettingsJson)
        VALUES (source.Category, source.ProviderKey, source.DisplayName, source.IconName,
                source.DefaultApiUrl, source.DefaultModel, source.SupportedModels,
                source.EnableStreaming,
                source.TemperatureMin, source.TemperatureMax,
                source.AuthType, source.DefaultSettingsJson);

    /* ---------- 初始化或補齊公司設定 ---------- */
    INSERT INTO dbo.CompanyApiProviderSettings (CompanyId, ProviderKey, Category, Active)
    SELECT c.id, d.ProviderKey, d.Category, 0
    FROM dbo.companies AS c
    CROSS JOIN dbo.ApiProviderDefinitions AS d
    WHERE d.ProviderKey = 'microsoft-graph'
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.CompanyApiProviderSettings AS s
        WHERE s.CompanyId  = c.id
          AND s.ProviderKey = d.ProviderKey
    );

    UPDATE s
    SET
        s.Category     = d.Category,
        s.AuthType     = COALESCE(s.AuthType, d.AuthType),
        s.SettingsJson = COALESCE(s.SettingsJson, d.DefaultSettingsJson)
    FROM dbo.CompanyApiProviderSettings AS s
    JOIN dbo.ApiProviderDefinitions AS d
      ON d.ProviderKey = s.ProviderKey
    WHERE d.ProviderKey = 'microsoft-graph';

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

