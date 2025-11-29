-- 添加其他常用的 Email Server API Providers
-- 目前只實施了 microsoft-graph (O365)，其他 providers 預留空間供日後實施

-- Gmail API
MERGE dbo.ApiProviderDefinitions AS target
USING (VALUES
    ('EmailServer', 'gmail', N'Gmail API', N'gmail',
     N'https://gmail.googleapis.com/gmail/v1/users/{userId}/messages/send',
     NULL, NULL,
     0, NULL, NULL,
     N'oauth',
     N'{"fromEmail":"","replyTo":""}')
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
            source.EnableStreaming, source.TemperatureMin, source.TemperatureMax,
            source.AuthType, source.DefaultSettingsJson);
GO

-- SendGrid API
MERGE dbo.ApiProviderDefinitions AS target
USING (VALUES
    ('EmailServer', 'sendgrid', N'SendGrid API', N'sendgrid',
     N'https://api.sendgrid.com/v3/mail/send',
     NULL, NULL,
     0, NULL, NULL,
     N'bearerToken',
     N'{"fromEmail":"","fromName":"","replyTo":""}')
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
            source.EnableStreaming, source.TemperatureMin, source.TemperatureMax,
            source.AuthType, source.DefaultSettingsJson);
GO

-- AWS SES (Simple Email Service)
MERGE dbo.ApiProviderDefinitions AS target
USING (VALUES
    ('EmailServer', 'aws-ses', N'AWS SES (Simple Email Service)', N'aws',
     N'https://email.{region}.amazonaws.com/v2/email/outbound-emails',
     NULL, NULL,
     0, NULL, NULL,
     N'apiKey',
     N'{"fromEmail":"","fromName":"","replyTo":"","region":"us-east-1"}')
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
            source.EnableStreaming, source.TemperatureMin, source.TemperatureMax,
            source.AuthType, source.DefaultSettingsJson);
GO

PRINT 'Email Server API Providers added successfully.';
PRINT 'Providers added:';
PRINT '  - Gmail API (gmail) - OAuth 2.0';
PRINT '  - SendGrid API (sendgrid) - Bearer Token';
PRINT '  - AWS SES (aws-ses) - API Key';
PRINT '';
PRINT 'Note: Only microsoft-graph (O365) is currently implemented.';
PRINT 'Other providers are reserved for future implementation.';

