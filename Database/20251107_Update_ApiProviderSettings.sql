/* ======================================================================
   統一建立 / 更新 API Provider 資料表與預設資料
   ====================================================================== */
BEGIN TRY
    BEGIN TRANSACTION;

    /* ---------- 建立或補齊 ApiProviderDefinitions ---------- */
    IF NOT EXISTS (
        SELECT 1 FROM sys.tables 
        WHERE name = 'ApiProviderDefinitions' AND schema_id = SCHEMA_ID('dbo')
    )
    BEGIN
        CREATE TABLE dbo.ApiProviderDefinitions (
            Id                  INT IDENTITY(1,1) PRIMARY KEY,
            ProviderKey         NVARCHAR(50)  NOT NULL UNIQUE,
            Category            NVARCHAR(50)  NOT NULL,
            DisplayName         NVARCHAR(100) NOT NULL,
            IconName            NVARCHAR(100) NULL,
            DefaultApiUrl       NVARCHAR(500) NOT NULL,
            DefaultModel        NVARCHAR(100) NULL,
            SupportedModels     NVARCHAR(MAX) NULL,
            Description         NVARCHAR(MAX) NULL,
            EnableStreaming     BIT           NOT NULL DEFAULT (0),
            TemperatureMin      DECIMAL(4,2)  NULL,
            TemperatureMax      DECIMAL(4,2)  NULL,
            AuthType            NVARCHAR(50)  NULL,
            DefaultSettingsJson NVARCHAR(MAX) NULL,
            CreatedAt           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
            UpdatedAt           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
        );

        CREATE INDEX IX_ApiProviderDefinitions_Category
            ON dbo.ApiProviderDefinitions (Category);
    END;

    IF COL_LENGTH('dbo.ApiProviderDefinitions', 'AuthType') IS NULL
    BEGIN
        ALTER TABLE dbo.ApiProviderDefinitions
            ADD AuthType NVARCHAR(50) NULL;
    END;

    IF COL_LENGTH('dbo.ApiProviderDefinitions', 'DefaultSettingsJson') IS NULL
    BEGIN
        ALTER TABLE dbo.ApiProviderDefinitions
            ADD DefaultSettingsJson NVARCHAR(MAX) NULL;
    END;

    /* ---------- 建立或補齊 CompanyApiProviderSettings ---------- */
    IF NOT EXISTS (
        SELECT 1 FROM sys.tables 
        WHERE name = 'CompanyApiProviderSettings' AND schema_id = SCHEMA_ID('dbo')
    )
    BEGIN
        CREATE TABLE dbo.CompanyApiProviderSettings (
            Id               INT IDENTITY(1,1) PRIMARY KEY,
            CompanyId        UNIQUEIDENTIFIER NOT NULL,
            ProviderKey      NVARCHAR(50)     NOT NULL,
            Category         NVARCHAR(50)     NULL,
            ApiUrlOverride   NVARCHAR(500)    NULL,
            ApiKeyEncrypted  VARBINARY(MAX)   NULL,
            ModelOverride    NVARCHAR(100)    NULL,
            Temperature      DECIMAL(4,2)     NULL,
            TopP             DECIMAL(4,2)     NULL,
            EnableStreaming  BIT              NULL,
            ExtraHeadersJson NVARCHAR(MAX)    NULL,
            AuthType         NVARCHAR(50)     NULL,
            AuthConfigJson   NVARCHAR(MAX)    NULL,
            SettingsJson     NVARCHAR(MAX)    NULL,
            Active           BIT              NOT NULL DEFAULT (0),
            CreatedAt        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
            UpdatedAt        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_CompanyApiProviderSettings_Company
                FOREIGN KEY (CompanyId) REFERENCES dbo.companies (id),
            CONSTRAINT FK_CompanyApiProviderSettings_Definition
                FOREIGN KEY (ProviderKey) REFERENCES dbo.ApiProviderDefinitions (ProviderKey),
            CONSTRAINT UQ_CompanyApiProvider UNIQUE (CompanyId, ProviderKey)
        );

        CREATE INDEX IX_CompanyApiProviderSettings_Company
            ON dbo.CompanyApiProviderSettings (CompanyId, ProviderKey) INCLUDE (Active);
    END;

    IF COL_LENGTH('dbo.CompanyApiProviderSettings', 'AuthType') IS NULL
    BEGIN
        ALTER TABLE dbo.CompanyApiProviderSettings
            ADD AuthType NVARCHAR(50) NULL;
    END;

    IF COL_LENGTH('dbo.CompanyApiProviderSettings', 'AuthConfigJson') IS NULL
    BEGIN
        ALTER TABLE dbo.CompanyApiProviderSettings
            ADD AuthConfigJson NVARCHAR(MAX) NULL;
    END;

    IF COL_LENGTH('dbo.CompanyApiProviderSettings', 'SettingsJson') IS NULL
    BEGIN
        ALTER TABLE dbo.CompanyApiProviderSettings
            ADD SettingsJson NVARCHAR(MAX) NULL;
    END;

    /* ---------- 更新 / 插入預設 Provider 定義 ---------- */
    MERGE dbo.ApiProviderDefinitions AS target
    USING (VALUES
        ('AI', 'xai', N'X.AI (Grok)', N'grok',
         N'https://api.x.ai/v1/chat/completions',
         N'grok-3', N'["grok-3","grok-2"]',
         N'Elon AI Grok 官方 API',
         1, 0.00, 1.50,
         N'apiKey',
         N'{"max_tokens":2000,"presence_penalty":0,"frequency_penalty":0,"stop":[]}' ),

        ('AI', 'openai', N'OpenAI', N'openai',
         N'https://api.openai.com/v1/chat/completions',
         N'gpt-4o', N'["gpt-4o","gpt-4.1-mini","gpt-4o-mini"]',
         N'OpenAI Chat Completions',
         1, 0.00, 1.00,
         N'apiKey',
         N'{"max_tokens":2000,"presence_penalty":0,"frequency_penalty":0,"response_format":"text"}' ),

        ('AI', 'deepseek', N'DeepSeek', N'deepseek',
         N'https://api.deepseek.com/chat/completions',
         N'deepseek-chat', N'["deepseek-chat","deepseek-coder"]',
         N'DeepSeek 官方 Chat API',
         1, 0.00, 1.50,
         N'apiKey',
         N'{"max_tokens":4096,"frequency_penalty":0,"presence_penalty":0,"stream_options":{"include_usage":false}}' ),

        ('AI', 'copilot', N'GitHub Copilot', N'copilot',
         N'https://api.githubcopilot.com/v1/chat/completions',
         NULL, NULL,
         N'Copilot Chat API（需企業授權）',
         0, NULL, NULL,
         N'bearerToken',
         N'{"intent":"chat","n":1,"includeThoughts":false}' ),

        ('AI', 'gemini', N'Google Gemini', N'gemini',
         N'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
         N'gemini-1.5-flash', N'["gemini-1.5-pro","gemini-1.5-flash"]',
         N'Google AI Gemini API',
         1, 0.00, 1.00,
         N'apiKey',
         N'{"maxOutputTokens":2048,"candidateCount":1,"topK":64,"stopSequences":[]}' ),

        ('CloudDoc', 'google-docs', N'Google Docs API', N'google-docs',
         N'https://docs.googleapis.com/v1/documents',
         NULL, NULL,
         N'Google Docs 讀寫 API（Dataset 匯入、文件同步）',
         0, NULL, NULL,
         N'serviceAccount',
         N'{"scopes":["https://www.googleapis.com/auth/documents","https://www.googleapis.com/auth/drive.file"],"applicationName":"WhatoFlow API Bridge"}' )
    ) AS source (
        Category, ProviderKey, DisplayName, IconName,
        DefaultApiUrl, DefaultModel, SupportedModels, Description,
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
            Description         = source.Description,
            EnableStreaming     = source.EnableStreaming,
            TemperatureMin      = source.TemperatureMin,
            TemperatureMax      = source.TemperatureMax,
            AuthType            = source.AuthType,
            DefaultSettingsJson = source.DefaultSettingsJson,
            UpdatedAt           = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Category, ProviderKey, DisplayName, IconName, DefaultApiUrl,
                DefaultModel, SupportedModels, Description,
                EnableStreaming, TemperatureMin, TemperatureMax,
                AuthType, DefaultSettingsJson)
        VALUES (source.Category, source.ProviderKey, source.DisplayName, source.IconName,
                source.DefaultApiUrl, source.DefaultModel, source.SupportedModels,
                source.Description, source.EnableStreaming,
                source.TemperatureMin, source.TemperatureMax,
                source.AuthType, source.DefaultSettingsJson);

    /* ---------- 初始化或補齊公司設定 ---------- */
    INSERT INTO dbo.CompanyApiProviderSettings (CompanyId, ProviderKey, Category, Active)
    SELECT c.id, d.ProviderKey, d.Category, 0
    FROM dbo.companies AS c
    CROSS JOIN dbo.ApiProviderDefinitions AS d
    WHERE NOT EXISTS (
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
      ON d.ProviderKey = s.ProviderKey;

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
