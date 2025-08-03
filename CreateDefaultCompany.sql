-- 創建默認公司
IF NOT EXISTS (SELECT * FROM [dbo].[companies] WHERE [id] = '00000000-0000-0000-0000-000000000001')
BEGIN
    INSERT INTO [dbo].[companies] (
        [id], 
        [name], 
        [email], 
        [address], 
        [phone], 
        [website], 
        [created_at], 
        [updated_at]
    ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        '默認公司',
        'default@company.com',
        '默認地址',
        '0000000000',
        'https://default-company.com',
        GETDATE(),
        GETDATE()
    );
    PRINT '已創建默認公司';
END
ELSE
BEGIN
    PRINT '默認公司已存在';
END