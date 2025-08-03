-- 檢查是否存在 Leave Application Form
SELECT * FROM eFormDefinitions WHERE name = 'Leave Application Form';

-- 如果不存在，創建一個簡單的 Leave Application Form
IF NOT EXISTS (SELECT 1 FROM eFormDefinitions WHERE name = 'Leave Application Form')
BEGIN
    INSERT INTO eFormDefinitions (
        id,
        company_id,
        name,
        description,
        html_code,
        status,
        created_at,
        updated_at,
        created_user_id,
        updated_user_id
    ) VALUES (
        NEWID(),
        '7f157c04-9b89-48a8-aee9-227a9d462d6a', -- 使用您公司的 ID
        'Leave Application Form',
        '假期申請表單',
        '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>假期申請表單</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background-color: #45a049; }
    </style>
</head>
<body>
    <h2>假期申請表單</h2>
    <form>
        <div class="form-group">
            <label for="employeeName">員工姓名:</label>
            <input type="text" id="employeeName" name="employeeName" value="Yeung Chan" readonly>
        </div>
        
        <div class="form-group">
            <label for="leaveType">假期類型:</label>
            <select id="leaveType" name="leaveType">
                <option value="AL">年假 (AL)</option>
                <option value="SL">病假 (SL)</option>
                <option value="NPL">無薪假 (NPL)</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="startDate">開始日期:</label>
            <input type="date" id="startDate" name="startDate" value="2025-08-15">
        </div>
        
        <div class="form-group">
            <label for="endDate">結束日期:</label>
            <input type="date" id="endDate" name="endDate" value="2025-08-15">
        </div>
        
        <div class="form-group">
            <label for="days">天數:</label>
            <input type="number" id="days" name="days" value="1" min="0.5" max="30" step="0.5">
        </div>
        
        <div class="form-group">
            <label for="reason">申請原因:</label>
            <textarea id="reason" name="reason" rows="4" placeholder="請說明申請假期的原因..."></textarea>
        </div>
        
        <div class="form-group">
            <label for="contactPhone">聯絡電話:</label>
            <input type="tel" id="contactPhone" name="contactPhone" value="85296366318">
        </div>
        
        <div class="form-group">
            <label for="emergencyContact">緊急聯絡人:</label>
            <input type="text" id="emergencyContact" name="emergencyContact">
        </div>
        
        <div class="form-group">
            <label for="emergencyPhone">緊急聯絡電話:</label>
            <input type="tel" id="emergencyPhone" name="emergencyPhone">
        </div>
    </form>
</body>
</html>',
        'A',
        GETDATE(),
        GETDATE(),
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000000'
    );
    
    PRINT 'Leave Application Form 已創建';
END
ELSE
BEGIN
    PRINT 'Leave Application Form 已存在';
END

-- 顯示所有表單
SELECT id, name, status, created_at FROM eFormDefinitions ORDER BY created_at DESC; 