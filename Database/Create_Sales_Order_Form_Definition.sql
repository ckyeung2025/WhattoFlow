-- 創建 Sales Order Form 表單定義
-- 用於 sendEForm 節點的表單模板

INSERT INTO eFormDefinitions (
    id,
    company_id,
    name,
    description,
    html_code,
    status,
    created_at,
    updated_at,
    created_user_id
) VALUES (
    NEWID(),
    '7f157c04-9b89-48a8-aee9-227a9d462d6a', -- 替換為實際的公司ID
    'Sales Order Form',
    '銷售訂單表單 - 用於工作流程中的 sendEForm 節點',
    '<!DOCTYPE html>
<html lang="zh-TC">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>銷售訂單表單</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .form-container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .form-header {
            text-align: center;
            margin-bottom: 30px;
            color: #333;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }
        input, select, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            box-sizing: border-box;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 5px rgba(0,123,255,0.3);
        }
        .form-row {
            display: flex;
            gap: 20px;
        }
        .form-row .form-group {
            flex: 1;
        }
        .submit-btn {
            background-color: #007bff;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            width: 100%;
            margin-top: 20px;
        }
        .submit-btn:hover {
            background-color: #0056b3;
        }
        .required {
            color: red;
        }
    </style>
</head>
<body>
    <div class="form-container">
        <div class="form-header">
            <h1>銷售訂單表單</h1>
            <p>請填寫以下訂單信息</p>
        </div>
        
        <form id="salesOrderForm">
            <div class="form-row">
                <div class="form-group">
                    <label for="orderNo">訂單編號 <span class="required">*</span></label>
                    <input type="text" id="orderNo" name="orderNo" required>
                </div>
                <div class="form-group">
                    <label for="orderDate">訂單日期 <span class="required">*</span></label>
                    <input type="date" id="orderDate" name="orderDate" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="customerNo">客戶編號 <span class="required">*</span></label>
                    <input type="text" id="customerNo" name="customerNo" required>
                </div>
                <div class="form-group">
                    <label for="customerName">客戶名稱 <span class="required">*</span></label>
                    <input type="text" id="customerName" name="customerName" required>
                </div>
            </div>
            
            <div class="form-group">
                <label for="customerAddress">客戶地址</label>
                <textarea id="customerAddress" name="customerAddress" rows="3"></textarea>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="contactTel">聯繫電話</label>
                    <input type="tel" id="contactTel" name="contactTel">
                </div>
                <div class="form-group">
                    <label for="salesman">業務員</label>
                    <input type="text" id="salesman" name="salesman">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="totalAmount">訂單總額</label>
                    <input type="number" id="totalAmount" name="totalAmount" step="0.01">
                </div>
                <div class="form-group">
                    <label for="currency">幣別</label>
                    <select id="currency" name="currency">
                        <option value="HKD">港幣 (HKD)</option>
                        <option value="USD">美元 (USD)</option>
                        <option value="CNY">人民幣 (CNY)</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label for="remarks">備註</label>
                <textarea id="remarks" name="remarks" rows="4"></textarea>
            </div>
            
            <button type="submit" class="submit-btn">提交訂單</button>
        </form>
    </div>
    
    <script>
        document.getElementById('salesOrderForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 收集表單數據
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            
            // 顯示提交的數據（實際應用中會發送到服務器）
            console.log('表單數據:', data);
            alert('訂單提交成功！');
        });
        
        // 自動填充當前日期
        document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
    </script>
</body>
</html>',
    'A', -- 狀態為 Active
    GETDATE(),
    GETDATE(),
    '90bc5daa-1572-476f-8947-0bf042dd0b8b' -- 替換為實際的用戶ID
);

-- 驗證插入結果
SELECT 
    id,
    name,
    description,
    status,
    created_at
FROM eFormDefinitions 
WHERE name = 'Sales Order Form';
