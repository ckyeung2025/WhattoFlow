-- 為 whatsapp_templates 表添加 MetaTemplateId 列
ALTER TABLE whatsapp_templates ADD MetaTemplateId NVARCHAR(200) NULL;

-- 顯示更新結果
SELECT id, name, MetaTemplateId FROM whatsapp_templates; 