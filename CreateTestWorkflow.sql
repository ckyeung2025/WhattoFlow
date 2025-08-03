-- 創建一個包含 WhatsApp 節點的測試工作流程
DECLARE @CompanyId UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM Companies LIMIT 1);

INSERT INTO WorkflowDefinitions (CompanyId, Name, Description, Json, Status, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy)
VALUES (
    @CompanyId,
    'Test WhatsApp Workflow',
    'Test workflow with WhatsApp node',
    '{
        "nodes": [
            {
                "id": "start",
                "type": "input",
                "position": {"x": 120, "y": 200},
                "data": {"label": "Start", "type": "start"},
                "draggable": false,
                "width": 150,
                "height": 57
            },
            {
                "id": "whatsapp_node",
                "type": "default",
                "position": {"x": 300, "y": 200},
                "data": {
                    "label": "Send WhatsApp Message",
                    "type": "sendWhatsApp",
                    "message": "Hello from workflow!",
                    "to": "85291234567"
                },
                "width": 200,
                "height": 80
            },
            {
                "id": "end",
                "type": "output",
                "position": {"x": 500, "y": 200},
                "data": {"label": "End", "type": "end"},
                "width": 150,
                "height": 57
            }
        ],
        "edges": [
            {
                "id": "start-whatsapp",
                "source": "start",
                "target": "whatsapp_node",
                "type": "smoothstep"
            },
            {
                "id": "whatsapp-end",
                "source": "whatsapp_node",
                "target": "end",
                "type": "smoothstep"
            }
        ]
    }',
    'Active',
    GETDATE(),
    GETDATE(),
    'System',
    'System'
);

PRINT 'Test workflow created successfully'; 