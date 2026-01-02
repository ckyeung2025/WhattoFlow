-- =============================================
-- Migration: 添加 SyncDirection 欄位到 data_sets 表
-- 日期: 2025-12-28
-- 說明: 為 DataSet 添加同步方向設置，支持 inbound（入站）、outbound（出站）、bidirectional（雙向）
-- =============================================

USE [WhattoFlow]  -- 請根據實際數據庫名稱修改
GO

-- 檢查並添加 sync_direction 欄位
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.data_sets') 
    AND name = 'sync_direction'
)
BEGIN
    ALTER TABLE dbo.data_sets
    ADD sync_direction NVARCHAR(20) NOT NULL DEFAULT 'inbound';
    
    PRINT '✅ sync_direction 欄位已添加';
END
ELSE
BEGIN
    PRINT '⚠️ sync_direction 欄位已存在，跳過';
END
GO

-- 為現有記錄設置 sync_direction 默認值（確保所有記錄都有值）
IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.data_sets') 
    AND name = 'sync_direction'
)
BEGIN
    UPDATE dbo.data_sets
    SET sync_direction = 'inbound'
    WHERE sync_direction IS NULL OR sync_direction = '';
    
    PRINT '✅ 已為現有記錄設置 sync_direction 默認值';
    
    -- 顯示更新統計
    DECLARE @UpdatedCount INT;
    SELECT @UpdatedCount = COUNT(*) 
    FROM dbo.data_sets 
    WHERE sync_direction = 'inbound';
    
    PRINT CONCAT('✅ 共 ', @UpdatedCount, ' 條記錄已設置為 inbound（入站同步）');
END
GO

-- 驗證欄位已正確添加
IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.data_sets') 
    AND name = 'sync_direction'
)
BEGIN
    PRINT '✅ 驗證成功：sync_direction 欄位已存在於 data_sets 表';
    
    -- 顯示欄位信息
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'data_sets' 
    AND COLUMN_NAME = 'sync_direction';
END
ELSE
BEGIN
    PRINT '❌ 錯誤：sync_direction 欄位未成功添加';
END
GO



