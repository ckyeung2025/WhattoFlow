using System;
using System.Collections.Generic;

namespace PurpleRice.Models.DTOs
{
    public class DataSetDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string DataSourceType { get; set; } = string.Empty;
        public Guid CompanyId { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsScheduled { get; set; }
        public int? UpdateIntervalMinutes { get; set; }
        public DateTime? LastUpdateTime { get; set; }
        public DateTime? NextUpdateTime { get; set; }
        public string SyncDirection { get; set; } = "inbound"; // inbound, outbound, bidirectional
        public int TotalRecords { get; set; }
        public DateTime? LastDataSyncTime { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedBy { get; set; }
        
        // 同步狀態管理
        public string SyncStatus { get; set; } = "Idle";
        public DateTime? SyncStartedAt { get; set; }
        public DateTime? SyncCompletedAt { get; set; }
        public string? SyncErrorMessage { get; set; }
        public string? SyncStartedBy { get; set; }
        
        // 進度追蹤
        public int? TotalRecordsToSync { get; set; } = 0;
        public int? RecordsProcessed { get; set; } = 0;
        public int? RecordsInserted { get; set; } = 0;
        public int? RecordsUpdated { get; set; } = 0;
        public int? RecordsDeleted { get; set; } = 0;
        public int? RecordsSkipped { get; set; } = 0;
        
        // 批次處理設定
        public int? BatchSize { get; set; } = 1000;
        public int? MaxSyncDurationMinutes { get; set; } = 60;
        public bool? AllowOverlap { get; set; } = false;
        
        // 不包含循環引用的導航屬性
        public List<DataSetColumnDto> Columns { get; set; } = new();
        public DataSetDataSourceDto? DataSource { get; set; }
    }

    public class DataSetColumnDto
    {
        public Guid Id { get; set; }
        public Guid DataSetId { get; set; }
        public string ColumnName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string DataType { get; set; } = string.Empty;
        public int? MaxLength { get; set; }
        public bool IsRequired { get; set; }
        public bool IsPrimaryKey { get; set; }
        public bool IsIndexed { get; set; }
        public bool IsSearchable { get; set; }
        public bool IsSortable { get; set; }
        public string? DefaultValue { get; set; }
        public int SortOrder { get; set; }
    }

    public class DataSetDataSourceDto
    {
        public Guid Id { get; set; }
        public Guid DataSetId { get; set; }
        public string SourceType { get; set; } = string.Empty;
        public string? SqlQuery { get; set; }
        public string? DatabaseConnection { get; set; }
        public string? ExcelFilePath { get; set; }
        public string? ExcelSheetName { get; set; }
        public string? ExcelUrl { get; set; }
        public string? GoogleDocsUrl { get; set; }
        public string? GoogleDocsSheetName { get; set; }
        public string? SqlParameters { get; set; }
        public string? AuthenticationConfig { get; set; }
        public DateTime? LastUpdateTime { get; set; }
    }
}
