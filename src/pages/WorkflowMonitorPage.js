import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Layout, 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Input, 
  InputNumber,
  Select, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Badge,
  Tooltip,
  Modal,
  message,
  Spin,
  Empty,
  Typography,
  Divider,
  Timeline,
  Descriptions,
  Tabs,
  Alert,
  Switch,
  TimePicker,
  DatePicker,
  Pagination
} from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StopOutlined, 
  ReloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  BarChartOutlined,
  SettingOutlined,
  DownloadOutlined,
  FilterOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  SyncOutlined as SyncOutlinedIcon,
  MessageOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  LeftOutlined,
  RightOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ReloadOutlined as ResetOutlined,
  CloseOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useLanguage } from '../contexts/LanguageContext';
import { getUserInterfacesFromStorage, hasInterfacePermission } from '../utils/permissionUtils';
// import dayjs from 'dayjs'; // 已替換為 TimezoneUtils
// import duration from 'dayjs/plugin/duration'; // 已替換為 TimezoneUtils
import { TimezoneUtils } from '../utils/timezoneUtils';
import WhatsAppChat from '../components/WhatsAppChat';
import MessageSendStatusModal from '../components/MessageSendStatusModal';

// dayjs.extend(duration); // 已替換為 TimezoneUtils

const { Header, Content } = Layout;
const { Search } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

// ResizableTitle 元件
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[30, 0]}
      handle={
        <span
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px', cursor: 'col-resize', zIndex: 1, userSelect: 'none' }}
          onClick={e => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ position: 'relative' }} />
    </Resizable>
  );
};

/**
 * 將 JSON 數據轉換為 HTML 表格
 */
const convertJsonToHtmlTable = (data) => {
  if (!data || typeof data !== 'object') {
    return '';
  }

  let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
  
  // ✅ 優先處理：如果數據本身就是數組，直接顯示為表格
  if (Array.isArray(data) && data.length > 0) {
    // 檢查數組中的元素是否都是對象
    const isObjectArray = data.every(item => item && typeof item === 'object' && !Array.isArray(item));
    
    if (isObjectArray) {
      // 收集所有唯一的鍵（從所有對象中）
      const allKeys = new Set();
      data.forEach(item => {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });
      
      const columns = Array.from(allKeys);
      
      if (columns.length > 0) {
        // 生成表頭
        html += '<thead><tr style="background-color: #f5f5f5; border-bottom: 2px solid #d9d9d9;">';
        columns.forEach(col => {
          html += `<th style="padding: 8px 12px; text-align: left; font-weight: 600;">${escapeHtml(col)}</th>`;
        });
        html += '</tr></thead>';
        
        // 生成表格行
        html += '<tbody>';
        data.forEach((item, index) => {
          const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
          html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #f0f0f0;">`;
          columns.forEach(col => {
            const value = item[col];
            const displayValue = value === null || value === undefined ? '-' : 
                                 typeof value === 'object' ? escapeHtml(JSON.stringify(value)) : 
                                 escapeHtml(String(value));
            html += `<td style="padding: 8px 12px;">${displayValue}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody>';
        
        html += '</table>';
        return html;
      }
    }
  }
  
  // 優先處理 processed 數據（如果存在）
  let processedData = null;
  if (data.processed && typeof data.processed === 'object') {
    processedData = data.processed;
  } else if (data.raw && typeof data.raw === 'string') {
    // 嘗試解析 raw 字段中的 JSON 字符串（可能是嵌套的）
    try {
      let rawParsed = JSON.parse(data.raw);
      // 如果 rawParsed 本身是字符串，再次解析
      if (typeof rawParsed === 'string') {
        rawParsed = JSON.parse(rawParsed);
      }
      if (rawParsed.processed && typeof rawParsed.processed === 'object') {
        processedData = rawParsed.processed;
      } else if (rawParsed && typeof rawParsed === 'object' && !rawParsed.raw) {
        // 如果 rawParsed 本身就是 processed 數據（沒有 raw 字段）
        processedData = rawParsed;
      }
    } catch (e) {
      // 解析失敗，忽略
    }
  }

  // 確定要顯示的數據源（優先使用 processedData，否則使用原始 data）
  const displayData = processedData || data;
  
  // 檢查是否有 items 數組需要顯示為表格
  if (displayData.items && Array.isArray(displayData.items) && displayData.items.length > 0) {
    // 檢查 items 數組中的元素結構
    const firstItem = displayData.items[0];
    const isStandardItemFormat = firstItem && typeof firstItem === 'object' && 
                                  ('name' in firstItem || '項目名稱' in firstItem);
    
    if (isStandardItemFormat) {
      // 標準格式：有 name/項目名稱、quantity/數量、price/價格 字段
      const hasName = 'name' in firstItem || '項目名稱' in firstItem;
      const hasQuantity = 'quantity' in firstItem || '數量' in firstItem;
      const hasPrice = 'price' in firstItem || '價格' in firstItem || '總價錢' in firstItem;
      
      html += '<thead><tr style="background-color: #f5f5f5; border-bottom: 2px solid #d9d9d9;">';
      if (hasName) {
        html += '<th style="padding: 8px 12px; text-align: left; font-weight: 600;">項目名稱</th>';
      }
      if (hasQuantity) {
        html += '<th style="padding: 8px 12px; text-align: right; font-weight: 600;">數量</th>';
      }
      if (hasPrice) {
        html += '<th style="padding: 8px 12px; text-align: right; font-weight: 600;">價格</th>';
      }
      html += '</tr></thead>';
      html += '<tbody>';
      
      displayData.items.forEach((item, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
        html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #f0f0f0;">`;
        if (hasName) {
          html += `<td style="padding: 8px 12px;">${escapeHtml(item.name || item['項目名稱'] || '-')}</td>`;
        }
        if (hasQuantity) {
          html += `<td style="padding: 8px 12px; text-align: right;">${item.quantity || item['數量'] || 0}</td>`;
        }
        if (hasPrice) {
          html += `<td style="padding: 8px 12px; text-align: right; font-weight: 500;">${item.price || item['價格'] || item['總價錢'] || 0}</td>`;
        }
        html += '</tr>';
      });
      
      html += '</tbody>';
      
      // 顯示總計
      if (displayData.total !== undefined) {
        html += '<tfoot><tr style="background-color: #f0f8ff; border-top: 2px solid #1890ff; font-weight: 600;">';
        html += `<td colspan="${(hasName ? 1 : 0) + (hasQuantity ? 1 : 0)}" style="padding: 10px 12px; text-align: right;">總計</td>`;
        html += `<td style="padding: 10px 12px; text-align: right; color: #1890ff;">${displayData.total}</td>`;
        html += '</tr></tfoot>';
      }
      
      // 顯示類型（如果有）
      if (displayData.type) {
        html += '<tfoot><tr style="background-color: #fafafa;">';
        html += `<td colspan="${(hasName ? 1 : 0) + (hasQuantity ? 1 : 0) + (hasPrice ? 1 : 0)}" style="padding: 8px 12px; text-align: center; color: #666; font-style: italic;">`;
        html += escapeHtml(displayData.type);
        html += '</td></tr></tfoot>';
      }
    } else {
      // 非標準格式：動態生成表格列
      const allKeys = new Set();
      displayData.items.forEach(item => {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });
      
      const columns = Array.from(allKeys);
      
      if (columns.length > 0) {
        html += '<thead><tr style="background-color: #f5f5f5; border-bottom: 2px solid #d9d9d9;">';
        columns.forEach(col => {
          html += `<th style="padding: 8px 12px; text-align: left; font-weight: 600;">${escapeHtml(col)}</th>`;
        });
        html += '</tr></thead>';
        
        html += '<tbody>';
        displayData.items.forEach((item, index) => {
          const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
          html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #f0f0f0;">`;
          columns.forEach(col => {
            const value = item[col];
            const displayValue = value === null || value === undefined ? '-' : 
                                 typeof value === 'object' ? escapeHtml(JSON.stringify(value)) : 
                                 escapeHtml(String(value));
            html += `<td style="padding: 8px 12px;">${displayValue}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody>';
      }
    }
  } else {
    // 沒有 items，顯示其他字段（排除 raw 和 items）
    Object.keys(displayData).forEach(key => {
      if (key !== 'raw' && key !== 'items') {
        const value = displayData[key];
        // 跳過空字符串和 null
        if (value !== '' && value !== null && value !== undefined) {
          html += '<tr style="border-bottom: 1px solid #f0f0f0;">';
          html += `<td style="padding: 8px 12px; font-weight: 500; width: 30%;">${escapeHtml(key)}</td>`;
          html += `<td style="padding: 8px 12px;" colspan="2">${typeof value === 'object' ? escapeHtml(JSON.stringify(value)) : escapeHtml(String(value))}</td>`;
          html += '</tr>';
        }
      }
    });
  }
  
  html += '</table>';
  return html;
};

/**
 * 提取 AI 分析結果，排除 base64 數據，轉換為 HTML 表格
 * 只處理 JSON 格式且包含 base64 的情況，純文字消息不受影響
 */
const extractAiAnalysisResult = (userMessage) => {
  // 如果為空或不是字符串，直接返回
  if (!userMessage || typeof userMessage !== 'string') {
    return userMessage;
  }

  // 檢查是否可能是 JSON 格式（以 { 或 [ 開頭）
  const trimmed = userMessage.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // 不是 JSON 格式，直接返回原始文字（純文字消息）
    return userMessage;
  }

  try {
    // 嘗試解析為 JSON
    const parsed = JSON.parse(userMessage);
    
    // 檢查是否包含 base64 相關的字段
    const hasRawField = parsed && typeof parsed === 'object' && 'raw' in parsed;
    const rawValue = hasRawField ? parsed.raw : null;
    const hasBase64 = rawValue && typeof rawValue === 'string' && 
                      (rawValue.length > 1000 || rawValue.includes('base64') || 
                       /^[A-Za-z0-9+/=]+$/.test(rawValue.substring(0, 100)));
    
    // 如果包含 base64 數據，移除 raw 字段
    if (hasBase64) {
      const cleaned = { ...parsed };
      delete cleaned.raw;
      
      // 如果清理後還有其他字段，轉換為 HTML 表格
      if (Object.keys(cleaned).length > 0) {
        return convertJsonToHtmlTable(cleaned);
      } else {
        // 如果只剩下 raw 字段，返回提示信息
        return '[圖片消息 - AI 分析結果已用於填充表單]';
      }
    }
    
    // 如果不包含 base64，也轉換為 HTML 表格
    return convertJsonToHtmlTable(parsed);
  } catch (e) {
    // 解析失敗，可能是格式錯誤的 JSON 或包含特殊字符的文字
    // 檢查是否包含 base64 特徵（很長的字符串）
    if (userMessage.length > 10000 && /^[A-Za-z0-9+/=\s]+$/.test(userMessage.substring(0, 100))) {
      // 可能是 base64 字符串，返回提示信息
      return '[圖片消息 - AI 分析結果已用於填充表單]';
    }
    
    // 否則返回原始內容（可能是格式錯誤的 JSON 或特殊文字）
    return userMessage;
  }
};

/**
 * 格式化文件大小（用於 HTML 生成）
 */
const formatFileSizeForHtml = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 生成媒體文件卡片的 HTML（與 Received Media 相同的樣式）
 */
const generateMediaFileCardHtml = (file, index, allFiles = [], t) => {
  const fileName = file.fileName || file.file_name || `image_${index + 1}.jpg`;
  const filePath = file.filePath || file.dataUrl || '';
  const fileSize = file.fileSize || 0;
  const mimeType = file.mimeType || file.mime_type || 'image/jpeg';
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  
  // 生成唯一 ID
  const cardId = `media-card-${Date.now()}-${index}`;
  const imageId = `media-image-${Date.now()}-${index}`;
  
  // 將文件信息存儲為 JSON 字符串（用於 lightbox）
  const fileData = JSON.stringify({
    fileName: fileName,
    filePath: filePath,
    fileSize: fileSize,
    mimeType: mimeType
  });
  const allFilesData = JSON.stringify(allFiles.map(f => ({
    fileName: f.fileName || f.file_name || `image_${allFiles.indexOf(f) + 1}.jpg`,
    filePath: f.filePath || f.dataUrl || '',
    fileSize: f.fileSize || 0,
    mimeType: f.mimeType || f.mime_type || 'image/jpeg'
  })));
  
  // 語言包文字
  const viewText = t ? t('workflowMonitor.view') : '查看';
  const downloadText = t ? t('workflowMonitor.download') : '下載';
  const imageText = t ? t('workflowMonitor.image') : '圖片';
  const videoText = t ? t('workflowMonitor.video') : '視頻';
  const documentText = t ? t('workflowMonitor.document') : '文檔';
  
  let html = `<div id="${cardId}" style="border: 1px solid #e8e8e8; border-radius: 8px; overflow: hidden; margin-bottom: 16px; background: white;">`;
  html += `<div style="padding: 8px;">`;
  html += `<div style="display: flex; flex-direction: column; align-items: center; text-align: center;">`;
  
  // 文件預覽（點擊打開 lightbox）
  html += `<div class="flow-media-preview" data-file='${escapeHtml(fileData)}' data-all-files='${escapeHtml(allFilesData)}' style="width: 100%; height: 120px; background-color: #f5f5f5; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; cursor: ${isImage || isVideo ? 'pointer' : 'default'};" ${isImage || isVideo ? 'onclick="if(window.openFlowLightbox) { const fileData = JSON.parse(this.getAttribute(\'data-file\')); const allFilesData = JSON.parse(this.getAttribute(\'data-all-files\')); window.openFlowLightbox(fileData, allFilesData); }"' : ''}>`;
  
  if (isImage && filePath) {
    html += `<img id="${imageId}" src="${escapeHtml(filePath)}" alt="${escapeHtml(fileName)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`;
    html += `<div style="display: none; align-items: center; justify-content: center; width: 100%; height: 100%; background-color: #f0f0f0;"><span style="color: #999;">圖片載入失敗</span></div>`;
  } else if (isVideo && filePath) {
    html += `<video src="${escapeHtml(filePath)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" controls="false" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"></video>`;
    html += `<div style="display: none; align-items: center; justify-content: center; width: 100%; height: 100%; background-color: #f0f0f0;"><span style="color: #999;">視頻載入失敗</span></div>`;
  } else {
    html += `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background-color: #f0f0f0;"><span style="color: #999; font-size: 24px;">📄</span></div>`;
  }
  
  html += `</div>`;
  
  // 文件信息
  html += `<div style="width: 100%;">`;
  html += `<div style="font-weight: bold; font-size: 12px; display: block; margin-bottom: 4px; word-break: break-all; line-height: 1.2;" title="${escapeHtml(fileName)}">`;
  html += escapeHtml(fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName);
  html += `</div>`;
  
  html += `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #666;">`;
  html += `<span>${formatFileSizeForHtml(fileSize)}</span>`;
  const tagColor = isImage ? 'green' : isVideo ? 'blue' : 'orange';
  const tagText = isImage ? imageText : isVideo ? videoText : documentText;
  html += `<span style="background: ${tagColor === 'green' ? '#f6ffed' : tagColor === 'blue' ? '#e6f7ff' : '#fff7e6'}; color: ${tagColor === 'green' ? '#52c41a' : tagColor === 'blue' ? '#1890ff' : '#fa8c16'}; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${tagText}</span>`;
  html += `</div>`;
  
  // 操作按鈕
  html += `<div style="margin-top: 8px; display: flex; gap: 4px; justify-content: center;">`;
  
  // View 按鈕（使用 lightbox）
  html += `<button class="flow-media-view-btn" data-file='${escapeHtml(fileData)}' data-all-files='${escapeHtml(allFilesData)}' onclick="if(window.openFlowLightbox) { const fileData = JSON.parse(this.getAttribute('data-file')); const allFilesData = JSON.parse(this.getAttribute('data-all-files')); window.openFlowLightbox(fileData, allFilesData); } return false;" style="font-size: 10px; padding: 2px 6px; border: 1px solid #d9d9d9; background: white; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">`;
  html += `<span>👁</span><span>${escapeHtml(viewText)}</span>`;
  html += `</button>`;
  
  // Download 按鈕
  html += `<button onclick="(function() { const filePath = '${escapeHtml(filePath)}'; const fileName = '${escapeHtml(fileName)}'; if (filePath.startsWith('data:')) { const link = document.createElement('a'); link.href = filePath; link.download = fileName; link.click(); } else { const link = document.createElement('a'); link.href = filePath; link.download = fileName; link.click(); } })(); return false;" style="font-size: 10px; padding: 2px 6px; border: 1px solid #d9d9d9; background: white; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">`;
  html += `<span>⬇</span><span>${escapeHtml(downloadText)}</span>`;
  html += `</button>`;
  
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  
  return html;
};

/**
 * 將 Meta Flows 回覆 JSON 轉換為 HTML
 * Flow 回覆數據格式：{ "field1": "value1", "field2": "value2", "photo_picker": "data:image/...;base64,..." }
 */
const convertFlowResponseToHtml = (flowResponseJson, t) => {
  if (!flowResponseJson || typeof flowResponseJson !== 'string') {
    return flowResponseJson || '';
  }

  // 檢查是否可能是 JSON 格式
  const trimmed = flowResponseJson.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // 不是 JSON 格式，可能是已經轉換好的 HTML，直接返回
    return flowResponseJson;
  }

  try {
    // 嘗試解析為 JSON
    const parsed = JSON.parse(flowResponseJson);
    
    // 如果解析成功，生成專門的 Flow 回覆 HTML
    if (typeof parsed === 'object' && parsed !== null) {
      let html = '<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">';
      html += '<div style="max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">';
      html += `<h2 style="margin-top: 0; color: #333; border-bottom: 2px solid #1890ff; padding-bottom: 10px;">${t ? t('workflowMonitor.formReplyContent') : '表單回覆內容'}</h2>`;
      
      // 遍歷所有字段
      Object.keys(parsed).forEach((key) => {
        // 跳過 flow_token（不需要顯示）
        if (key === 'flow_token') {
          return;
        }
        
        const value = parsed[key];
        html += '<div style="margin-bottom: 20px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px;">';
        html += `<div style="font-weight: bold; color: #333; margin-bottom: 8px; font-size: 14px;">${escapeHtml(key)}:</div>`;
        
        // 檢查是否是 PhotoPicker 字段（對象或數組，包含 filePath 或 dataUrl）
        const isPhotoPickerField = (val) => {
          if (!val) return false;
          
          if (Array.isArray(val)) {
            // 如果是數組，檢查第一個元素是否包含圖片相關字段
            if (val.length === 0) return false;
            const firstElement = val[0];
            if (!firstElement || typeof firstElement !== 'object') return false;
            
            // 檢查是否包含圖片相關字段（dataUrl、filePath、或 id + mime_type）
            return !!(firstElement.dataUrl || firstElement.filePath || 
                     (firstElement.id && (firstElement.mime_type || firstElement.mimeType)));
          } else if (typeof val === 'object' && val !== null) {
            // 如果是對象，檢查是否包含圖片相關字段
            return !!(val.dataUrl || val.filePath || (val.id && (val.mime_type || val.mimeType)));
          }
          return false;
        };
        
        // 檢查是否是字符串格式的 base64 圖片
        const isImageField = typeof value === 'string' && (
          value.startsWith('data:image/') || 
          value.includes('base64') ||
          (value.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(value.substring(0, 100)) && !value.includes(' '))
        );
        
        if (isPhotoPickerField(value)) {
          // 處理 PhotoPicker 字段（對象或數組）
          const images = Array.isArray(value) ? value : [value];
          
          html += '<div style="margin-top: 8px;">';
          html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">';
          
          images.forEach((img, index) => {
            if (!img || typeof img !== 'object') {
              console.warn(`[WorkflowMonitor] PhotoPicker 元素 ${index} 不是有效對象:`, img);
              return;
            }
            
            // 優先使用 filePath（相對 URL），如果沒有則使用 dataUrl（base64）
            let filePath = img.filePath || img.dataUrl;
            
            // 調試日誌
            console.log(`[WorkflowMonitor] PhotoPicker 圖片 ${index}:`, {
              filePath: img.filePath,
              dataUrl: img.dataUrl ? `${img.dataUrl.substring(0, 50)}...` : null,
              id: img.id,
              mime_type: img.mime_type || img.mimeType,
              filePath: filePath ? `${filePath.substring(0, 50)}...` : null
            });
            
            if (filePath) {
              // 確保 filePath 是完整的 URL（如果是相對路徑，可能需要添加前綴）
              if (!filePath.startsWith('http') && !filePath.startsWith('data:') && !filePath.startsWith('/')) {
                // 可能是相對路徑但沒有前導斜線
                filePath = '/' + filePath;
              }
              
              // 構建文件對象，使用與 Received Media 相同的格式
              const fileObj = {
                fileName: img.fileName || img.file_name || `image_${index + 1}.jpg`,
                filePath: filePath,
                fileSize: img.fileSize || 0,
                mimeType: img.mimeType || img.mime_type || 'image/jpeg',
                mime_type: img.mimeType || img.mime_type || 'image/jpeg'
              };
              
              // 使用與 Received Media 相同的卡片樣式
              html += generateMediaFileCardHtml(fileObj, index, images, t);
            } else {
              // 沒有圖片源，顯示信息
              console.warn(`[WorkflowMonitor] PhotoPicker 圖片 ${index} 沒有可用的圖片源:`, img);
              html += `<div style="padding: 8px 12px; background-color: #fff7e6; border: 1px solid #ffd591; border-radius: 4px; color: #d46b08; max-width: 200px;">圖片 ${index + 1}: 無可用圖片源</div>`;
            }
          });
          
          html += '</div>';
          html += '</div>';
        } else if (isImageField) {
          // 如果是 base64 圖片字符串，顯示圖片
          let imageSrc = value;
          if (value.startsWith('data:image/')) {
            // 已經是完整的 data URL
            imageSrc = value;
          } else if (value.includes('base64,')) {
            // 包含 base64, 但可能不完整
            imageSrc = value;
          } else {
            // 可能是純 base64 字符串，嘗試構建 data URL
            // 先嘗試 PNG，如果失敗可以嘗試其他格式
            imageSrc = `data:image/png;base64,${value}`;
          }
          
          html += `<div style="margin-top: 8px;">`;
          html += `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(key)}" style="max-width: 100%; height: auto; border-radius: 4px; border: 1px solid #ddd; display: block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />`;
          html += `<div style="display: none; padding: 8px 12px; background-color: #fff7e6; border: 1px solid #ffd591; border-radius: 4px; color: #d46b08;">圖片載入失敗（Base64 數據可能已損壞）</div>`;
          html += `</div>`;
        } else if (value === null || value === undefined) {
          html += '<div style="color: #999; font-style: italic;">（無）</div>';
        } else if (typeof value === 'boolean') {
          html += `<div style="padding: 8px 12px; background-color: #f9f9f9; border-radius: 4px; display: inline-block;">${value ? '是' : '否'}</div>`;
        } else if (typeof value === 'object') {
          // 如果是對象，轉換為 JSON 字符串顯示
          html += `<div style="padding: 8px 12px; background-color: #f9f9f9; border-radius: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">${escapeHtml(JSON.stringify(value, null, 2))}</div>`;
        } else {
          // 其他類型（字符串、數字等）
          html += `<div style="padding: 8px 12px; background-color: #f9f9f9; border-radius: 4px; word-break: break-word;">${escapeHtml(String(value))}</div>`;
        }
        
        html += '</div>';
      });
      
      html += '</div>';
      html += '</div>';
      return html;
    }
    
    // 如果不是對象，使用通用的 JSON 表格轉換
    return convertJsonToHtmlTable(parsed);
  } catch (e) {
    console.error('[WorkflowMonitor] Failed to parse Flow response JSON:', e);
    // 解析失敗，可能是已經轉換好的 HTML 或其他格式，直接返回
    return flowResponseJson;
  }
};

/**
 * 轉義 HTML 特殊字符
 */
const escapeHtml = (text) => {
  if (text === null || text === undefined) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
};

// Flow 回覆內容組件（支持 lightbox 和語言包）
const FlowResponseContent = ({ html, onOpenLightbox }) => {
  const { t } = useLanguage();
  const flowHtmlRef = useRef(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxFile, setLightboxFile] = useState(null);
  const [lightboxFiles, setLightboxFiles] = useState([]);
  const [lightboxCurrentIndex, setLightboxCurrentIndex] = useState(0);
  const [lightboxTransform, setLightboxTransform] = useState({
    rotate: 0,
    scale: 1,
    flipH: false,
    flipV: false
  });
  
  useEffect(() => {
    // 設置全局函數以支持 lightbox
    const handleOpenLightbox = (file, allFiles = []) => {
      const imageVideoFiles = allFiles.filter(f => {
        const mimeType = f.mimeType || f.mime_type || 'image/jpeg';
        return mimeType.startsWith('image/') || mimeType.startsWith('video/');
      });
      
      const currentIndex = imageVideoFiles.findIndex(f => 
        (f.filePath || f.dataUrl) === (file.filePath || file.dataUrl)
      );
      
      setLightboxFiles(imageVideoFiles);
      setLightboxFile(file);
      setLightboxCurrentIndex(currentIndex >= 0 ? currentIndex : 0);
      setLightboxTransform({
        rotate: 0,
        scale: 1,
        flipH: false,
        flipV: false
      });
      setLightboxVisible(true);
    };
    
    window.openFlowLightbox = handleOpenLightbox;
    
    return () => {
      if (window.openFlowLightbox) {
        delete window.openFlowLightbox;
      }
    };
  }, []);
  
  const closeLightbox = () => {
    setLightboxVisible(false);
    setLightboxFile(null);
    setLightboxFiles([]);
    setLightboxCurrentIndex(0);
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
  };
  
  const goToPrevious = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex > 0 ? lightboxCurrentIndex - 1 : lightboxFiles.length - 1;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
      setLightboxTransform({
        rotate: 0,
        scale: 1,
        flipH: false,
        flipV: false
      });
    }
  };
  
  const goToNext = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex < lightboxFiles.length - 1 ? lightboxCurrentIndex + 1 : 0;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
      setLightboxTransform({
        rotate: 0,
        scale: 1,
        flipH: false,
        flipV: false
      });
    }
  };
  
  const rotateImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      rotate: prev.rotate + (direction === 'left' ? -90 : 90)
    }));
  };
  
  const flipImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      flipH: direction === 'horizontal' ? !prev.flipH : prev.flipH,
      flipV: direction === 'vertical' ? !prev.flipV : prev.flipV
    }));
  };
  
  const zoomImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      scale: direction === 'in' 
        ? Math.min(prev.scale * 1.2, 5) 
        : Math.max(prev.scale / 1.2, 0.1)
    }));
  };
  
  const resetTransform = () => {
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
  };
  
  const getFileType = (fileName) => {
    if (!fileName) return 'document';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv'].includes(extension)) return 'video';
    return 'document';
  };
  
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <>
      <div 
        ref={flowHtmlRef}
        style={{
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          padding: '20px',
          backgroundColor: '#fafafa',
          minHeight: '300px',
          overflow: 'auto',
          fontSize: '14px',
          lineHeight: '1.6'
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      
      {/* Lightbox Modal */}
      <Modal
        title={lightboxFile ? lightboxFile.fileName : ''}
        open={lightboxVisible}
        onCancel={closeLightbox}
        footer={null}
        width="95%"
        style={{ top: 10 }}
        bodyStyle={{ 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '85vh',
          backgroundColor: '#000',
          position: 'relative'
        }}
        closable={false}
      >
        {lightboxFile && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center',
            width: '100%',
            height: '100%',
            position: 'relative'
          }}>
            {/* 關閉按鈕 */}
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={closeLightbox}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 1000,
                color: '#fff',
                fontSize: '20px',
                width: '40px',
                height: '40px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: 'none'
              }}
            />
            
            {/* 導航按鈕 */}
            {lightboxFiles.length > 1 && (
              <>
                <Button
                  type="text"
                  icon={<LeftOutlined />}
                  onClick={goToPrevious}
                  style={{
                    position: 'absolute',
                    left: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    fontSize: '24px',
                    width: '50px',
                    height: '50px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
                <Button
                  type="text"
                  icon={<RightOutlined />}
                  onClick={goToNext}
                  style={{
                    position: 'absolute',
                    right: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    fontSize: '24px',
                    width: '50px',
                    height: '50px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
              </>
            )}
            
            {/* 媒體內容 */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              transform: `
                rotate(${lightboxTransform.rotate}deg) 
                scale(${lightboxTransform.scale}) 
                scaleX(${lightboxTransform.flipH ? -1 : 1}) 
                scaleY(${lightboxTransform.flipV ? -1 : 1})
              `,
              transition: 'transform 0.3s ease'
            }}>
              {getFileType(lightboxFile.fileName) === 'image' ? (
                <img
                  src={lightboxFile.filePath || lightboxFile.dataUrl}
                  alt={lightboxFile.fileName}
                  style={{
                    maxWidth: '90%',
                    maxHeight: '80vh',
                    objectFit: 'contain'
                  }}
                />
              ) : getFileType(lightboxFile.fileName) === 'video' ? (
                <video
                  src={lightboxFile.filePath || lightboxFile.dataUrl}
                  controls
                  style={{
                    maxWidth: '90%',
                    maxHeight: '80vh'
                  }}
                />
              ) : null}
            </div>
            
            {/* 工具欄 */}
            {getFileType(lightboxFile.fileName) === 'image' && (
              <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '8px 16px',
                borderRadius: '8px',
                zIndex: 1000
              }}>
                <Button
                  type="text"
                  icon={<RotateLeftOutlined />}
                  onClick={() => rotateImage('left')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.rotateLeft')}
                />
                <Button
                  type="text"
                  icon={<RotateRightOutlined />}
                  onClick={() => rotateImage('right')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.rotateRight')}
                />
                <Button
                  type="text"
                  icon={<SwapOutlined />}
                  onClick={() => flipImage('horizontal')}
                  style={{ 
                    color: '#fff',
                    transform: lightboxTransform.flipH ? 'scaleX(-1)' : 'none'
                  }}
                  title={t('workflowMonitor.flipHorizontal')}
                />
                <Button
                  type="text"
                  icon={<SwapOutlined />}
                  onClick={() => flipImage('vertical')}
                  style={{ 
                    color: '#fff',
                    transform: lightboxTransform.flipV ? 'scaleY(-1)' : 'none'
                  }}
                  title={t('workflowMonitor.flipVertical')}
                />
                <Button
                  type="text"
                  icon={<ZoomInOutlined />}
                  onClick={() => zoomImage('in')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.zoomIn')}
                />
                <Button
                  type="text"
                  icon={<ZoomOutOutlined />}
                  onClick={() => zoomImage('out')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.zoomOut')}
                />
                <Button
                  type="text"
                  icon={<ResetOutlined />}
                  onClick={resetTransform}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.reset')}
                />
              </div>
            )}
            
            {/* 文件信息 */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 1000
            }}>
              {lightboxFiles.length > 1 && (
                <div>{lightboxCurrentIndex + 1} / {lightboxFiles.length}</div>
              )}
              <div>{formatFileSize(lightboxFile.fileSize || 0)}</div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

const WorkflowMonitorPage = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState([]);
  const [selectedInstances, setSelectedInstances] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: 'all',
    workflowName: '',
    startDateRange: null,
    endDateRange: null,
    searchText: ''
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [autoRefreshModalVisible, setAutoRefreshModalVisible] = useState(false);
  const [modalAutoRefreshEnabled, setModalAutoRefreshEnabled] = useState(autoRefresh);
  const [modalRefreshInterval, setModalRefreshInterval] = useState(refreshInterval);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [dataSetQueryModalVisible, setDataSetQueryModalVisible] = useState(false);
  const [dataSetQueryResult, setDataSetQueryResult] = useState(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    waiting: 0,
    averageExecutionTime: 0,
    successRate: 0
  });
  const [userInterfaces, setUserInterfaces] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedChatInstance, setSelectedChatInstance] = useState(null);
  const [messageSendModalVisible, setMessageSendModalVisible] = useState(false);
  const [selectedMessageSend, setSelectedMessageSend] = useState(null);
  const [messageSendDetailModalVisible, setMessageSendDetailModalVisible] = useState(false);
  const [selectedMessageSendDetail, setSelectedMessageSendDetail] = useState(null);
  const [newMessageSendStatusModalVisible, setNewMessageSendStatusModalVisible] = useState(false);
  const [selectedMessageSendId, setSelectedMessageSendId] = useState(null);
  const [selectedWorkflowExecutionId, setSelectedWorkflowExecutionId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [userTimezoneOffset, setUserTimezoneOffset] = useState('UTC+8'); // 默認香港時區
  
  // 使用 ref 存儲最新的 filters 和 pagination，確保自動刷新時使用最新值
  const filtersRef = useRef(filters);
  const paginationRef = useRef(pagination);
  
  // 當 filters 或 pagination 改變時，立即更新 ref（同步更新，不等待 useEffect）
  // 這樣可以確保自動刷新時總是使用最新的值
  filtersRef.current = filters;
  paginationRef.current = pagination;
  
  // 右側詳情面板狀態
  const [detailPanelVisible, setDetailPanelVisible] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  
  // 表格列寬調整相關狀態
  const [columnWidths, setColumnWidths] = useState({});
  
  // 內嵌表單相關狀態
  const [selectedFormInstanceId, setSelectedFormInstanceId] = useState(null);
  const [embedFormVisible, setEmbedFormVisible] = useState(false);
  const [embeddedFormInstance, setEmbeddedFormInstance] = useState(null);
  const [loadingEmbeddedForm, setLoadingEmbeddedForm] = useState(false);

  // 載入真實數據
  // 獲取用戶時區信息
  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        if (parsedUserInfo.timezone) {
          setUserTimezoneOffset(parsedUserInfo.timezone);
        }
      } catch (error) {
        console.error('解析用戶信息失敗:', error);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadInterfaces = async () => {
      setLoadingPermissions(true);
      try {
        // 強制從 API 獲取最新權限，不使用緩存
        const interfaces = await getUserInterfacesFromStorage(true);
        console.log('[WorkflowMonitor] 從 API 獲取的權限列表:', interfaces);
        if (isMounted) {
          setUserInterfaces(interfaces || []);
        }
      } catch (error) {
        console.error('[WorkflowMonitor] 載入用戶介面權限失敗:', error);
        if (isMounted) {
          setUserInterfaces([]);
        }
      } finally {
        if (isMounted) {
          setLoadingPermissions(false);
        }
      }
    };

    loadInterfaces();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    loadInstances();
    loadStatistics();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        // 自動刷新時使用 ref 的值，確保使用最新的 filters 和 pagination
        loadInstances('startedAt', 'desc', true);
        loadStatistics();
      }, refreshInterval * 1000);
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const canUseWhatsAppChat = !loadingPermissions && hasInterfacePermission(userInterfaces, 'workflowMonitor.whatsappChat');
  const canPauseExecution = !loadingPermissions && hasInterfacePermission(userInterfaces, 'workflowMonitor.pause');
  const canResumeExecution = !loadingPermissions && hasInterfacePermission(userInterfaces, 'workflowMonitor.resume');
  const canRetryExecution = !loadingPermissions && hasInterfacePermission(userInterfaces, 'workflowMonitor.retry');
  const canCancelExecution = !loadingPermissions && hasInterfacePermission(userInterfaces, 'workflowMonitor.cancel');
  const canDeleteExecution = !loadingPermissions && hasInterfacePermission(userInterfaces, 'workflowMonitor.delete');

  console.log('[WorkflowMonitor] permission flags', {
    loadingPermissions,
    userInterfaces,
    canUseWhatsAppChat,
    canPauseExecution,
    canResumeExecution,
    canRetryExecution,
    canCancelExecution,
    canDeleteExecution
  });

  useEffect(() => {
    if (autoRefreshModalVisible) {
      setModalAutoRefreshEnabled(autoRefresh);
      setModalRefreshInterval(refreshInterval);
    }
  }, [autoRefreshModalVisible, autoRefresh, refreshInterval]);

  // 載入內嵌表單數據
  useEffect(() => {
    if (embedFormVisible && selectedFormInstanceId) {
      loadEmbeddedFormInstance();
    }
  }, [embedFormVisible, selectedFormInstanceId]);

  // 當篩選條件改變時，重新載入數據
  useEffect(() => {
    loadInstances();
  }, [filters, pagination.current, pagination.pageSize]);

  const loadInstances = async (sortBy = 'startedAt', sortOrder = 'desc', useRefValues = false) => {
    // 使用 ref 的值（自動刷新時）或當前狀態值（手動刷新時）
    const currentFilters = useRefValues ? filtersRef.current : filters;
    const currentPagination = useRefValues ? paginationRef.current : pagination;
    
    console.log('[WorkflowMonitor] start loading instances', { 
      sortBy, 
      sortOrder, 
      useRefValues,
      currentFiltersStatus: currentFilters.status,
      filtersStatus: filters.status,
      filtersRefStatus: filtersRef.current.status
    });
    
    setLoading(true);
    try {
      
      // 構建查詢參數
      const params = new URLSearchParams({
        page: currentPagination.current,
        pageSize: currentPagination.pageSize,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      // 狀態值映射：將前端的小寫狀態值轉換為後端期望的格式
      // 注意：後端使用精確匹配，所以需要正確的格式
      if (currentFilters.status !== 'all') {
        const statusMap = {
          'running': 'Running',
          'completed': 'Completed',
          'failed': 'Failed',
          'paused': 'Paused',
          'cancelled': 'Cancelled'
        };
        // 如果狀態值在映射中，使用映射值；否則使用首字母大寫的原始值
        const mappedStatus = statusMap[currentFilters.status.toLowerCase()] || 
          (currentFilters.status.charAt(0).toUpperCase() + currentFilters.status.slice(1).toLowerCase());
        params.append('status', mappedStatus);
        console.log('[WorkflowMonitor] status filter mapping:', { 
          original: currentFilters.status, 
          mapped: mappedStatus 
        });
      }

      if (currentFilters.searchText) {
        params.append('search', currentFilters.searchText);
      }

      if (currentFilters.startDateRange && currentFilters.startDateRange.length === 2) {
        params.append('startDateFrom', currentFilters.startDateRange[0].toISOString());
        params.append('startDateTo', currentFilters.startDateRange[1].toISOString());
      }

      if (currentFilters.endDateRange && currentFilters.endDateRange.length === 2) {
        params.append('endDateFrom', currentFilters.endDateRange[0].toISOString());
        params.append('endDateTo', currentFilters.endDateRange[1].toISOString());
      }

      const url = `/api/workflowexecutions/monitor?${params}`;
      console.log('[WorkflowMonitor] request url', url);
      console.log('[WorkflowMonitor] request params', Object.fromEntries(params));
      console.log('[WorkflowMonitor] current pagination', { current: currentPagination.current, pageSize: currentPagination.pageSize });

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadInstancesFailed'));
      }

      const data = await response.json();
      console.log('[WorkflowMonitor] api data', data);
      console.log('[WorkflowMonitor] instance structure', data.data);
      console.log('[WorkflowMonitor] pagination info', { page: data.page, pageSize: data.pageSize, total: data.total });
      
      // 檢查第一個實例是否包含 InputJson 字段
      if (data.data && data.data.length > 0) {
        const firstInstance = data.data[0];
        console.log('[WorkflowMonitor] first instance', firstInstance);
        console.log('[WorkflowMonitor] first instance inputJson', firstInstance.inputJson);
        console.log('[WorkflowMonitor] first instance inputJson type', typeof firstInstance.inputJson);
        if (firstInstance.inputJson) {
          try {
            const parsedInput = JSON.parse(firstInstance.inputJson);
            console.log('[WorkflowMonitor] parsed inputJson', parsedInput);
          } catch (parseError) {
            console.error('[WorkflowMonitor] parse inputJson failed', parseError);
          }
        }
      }
      
      setInstances(data.data);
      setPagination(prev => ({ 
        ...prev, 
        total: data.total,
        current: data.page,
        pageSize: data.pageSize
      }));
    } catch (error) {
      message.error(t('workflowMonitor.loadInstancesFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/workflowexecutions/monitor/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadStatisticsFailed'));
      }

      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error(t('workflowMonitor.loadStatisticsFailed'), error);
    }
  };

  const handleStatusFilter = (value) => {
    setFilters(prev => ({ ...prev, status: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleSearch = (value) => {
    setFilters(prev => ({ ...prev, searchText: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleStartDateRangeChange = (dates) => {
    setFilters(prev => ({ ...prev, startDateRange: dates }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleEndDateRangeChange = (dates) => {
    setFilters(prev => ({ ...prev, endDateRange: dates }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleOpenAutoRefreshSettings = () => {
    setAutoRefreshModalVisible(true);
  };

  const handleApplyAutoRefreshSettings = () => {
    const normalizedInterval = Number(modalRefreshInterval);
    const sanitizedInterval = Math.max(5, Math.min(600, Number.isFinite(normalizedInterval) ? normalizedInterval : refreshInterval));
    setRefreshInterval(sanitizedInterval);
    setAutoRefresh(modalAutoRefreshEnabled);
    setModalRefreshInterval(sanitizedInterval);
    setAutoRefreshModalVisible(false);
  };

  const handleInstanceAction = async (action, instance) => {
    try {
      const response = await fetch(`/api/workflowexecutions/${instance.id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('workflowMonitor.operationFailed'));
      }

      const result = await response.json();
      message.success(result.message || t('workflowMonitor.operationSuccess', { action }));
      
      // 重新載入數據
      loadInstances();
      loadStatistics();
    } catch (error) {
      message.error(t('workflowMonitor.operationFailed', { action }) + ': ' + error.message);
    }
  };

  const handleCancelInstance = (instance) => {
    Modal.confirm({
      title: t('workflowMonitor.cancelConfirmTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('workflowMonitor.cancelConfirmMessage', {
        workflowName: instance.workflowName || '-',
        instanceId: instance.id
      }),
      okText: t('workflowMonitor.cancel'),
      cancelText: t('common.cancel'),
      onOk: () => handleInstanceAction('cancel', instance)
    });
  };

  const handleDeleteInstance = (instance) => {
    Modal.confirm({
      title: t('workflowMonitor.deleteConfirmTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('workflowMonitor.deleteConfirmMessage', {
        workflowName: instance.workflowName || '-',
        instanceId: instance.id
      }),
      okText: t('common.delete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: () => performDeleteInstance(instance)
    });
  };

  const performDeleteInstance = async (instance) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflowexecutions/${instance.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      let responseData = null;
      try {
        responseData = await response.json();
      } catch (parseError) {
        // 忽略解析錯誤，部分情況可能沒有 JSON 內容
      }

      if (!response.ok) {
        throw new Error(responseData?.error || t('workflowMonitor.deleteFailed'));
      }

      message.success(responseData?.message || t('workflowMonitor.deleteSuccess'));

      if (selectedInstanceId === instance.id) {
        setDetailPanelVisible(false);
        setSelectedInstanceId(null);
        setSelectedInstance(null);
      }

      setSelectedInstances(prev => prev.filter(item => item.id !== instance.id));

      await loadInstances();
      await loadStatistics();
    } catch (error) {
      message.error(error.message || t('workflowMonitor.deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (instance) => {
    try {
      const response = await fetch(`/api/workflowexecutions/${instance.id}/details`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadDetailsFailed'));
      }

      const details = await response.json();
      setSelectedInstance(details);
      setSelectedInstanceId(instance.id);
      setDetailPanelVisible(true);
    } catch (error) {
      message.error(t('workflowMonitor.loadDetailsFailed') + ': ' + error.message);
    }
  };

  // 關閉右側詳情面板
  const handleCloseDetailPanel = () => {
    setDetailPanelVisible(false);
    setSelectedInstanceId(null);
  };

  // 處理內嵌表單 Modal 關閉
  const handleCloseEmbeddedForm = () => {
    setEmbedFormVisible(false);
    setSelectedFormInstanceId(null);
    setEmbeddedFormInstance(null);
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      running: { color: 'processing', icon: <SyncOutlinedIcon spin />, text: t('workflowMonitor.statusRunning') },
      completed: { color: 'success', icon: <CheckCircleFilled />, text: t('workflowMonitor.statusCompleted') },
      failed: { color: 'error', icon: <CloseCircleFilled />, text: t('workflowMonitor.statusFailed') },
      waiting: { color: 'processing', icon: <SyncOutlinedIcon spin />, text: t('workflowMonitor.statusRunning') },
      waitingforqrcode: { color: 'processing', icon: <SyncOutlinedIcon spin />, text: t('workflowMonitor.statusRunning') },
      waitingforformapproval: { color: 'processing', icon: <SyncOutlinedIcon spin />, text: t('workflowMonitor.statusRunning') },
      paused: { color: 'default', icon: <PauseCircleOutlined />, text: t('workflowMonitor.statusPaused') },
      cancelled: { color: 'default', icon: <StopOutlined />, text: t('workflowMonitor.statusCancelled') }
    };
    
    // 將狀態轉為小寫進行匹配
    const statusLower = status?.toLowerCase() || '';
    let config = statusConfig[statusLower];
    
    // 如果直接匹配失敗，檢查是否為運行相關狀態（包括 waiting）
    if (!config) {
      if (statusLower.includes('wait') || statusLower.includes('run')) {
        // waiting 狀態也視為 running（因為流程仍在運行中，只是在等待用戶輸入）
        config = statusConfig.running;
      } else {
        // 默認使用 running
        config = statusConfig.running;
      }
    }
    
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getDurationText = (duration) => {
    if (!duration) return '-';
    if (duration < 60) return `${Math.round(duration)} ${t('workflowMonitor.minutes')}`;
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    return `${hours} ${t('workflowMonitor.hours')} ${minutes} ${t('workflowMonitor.minutes')}`;
  };

  // 打開 WhatsApp 對話框
  const handleOpenChat = (instance) => {
    console.log('[WorkflowMonitor] open chat for instance', instance);
    console.log('[WorkflowMonitor] instance id', instance.id);
    console.log('[WorkflowMonitor] instance inputJson', instance.inputJson);
    console.log('[WorkflowMonitor] instance inputJson type', typeof instance.inputJson);
    
    if (instance.inputJson) {
      try {
        const parsedInput = JSON.parse(instance.inputJson);
        console.log('[WorkflowMonitor] parsed inputJson (chat)', parsedInput);
        console.log('[WorkflowMonitor] available fields', Object.keys(parsedInput));
      } catch (parseError) {
        console.error('[WorkflowMonitor] parse inputJson failed (chat)', parseError);
      }
    } else {
      console.warn('[WorkflowMonitor] no inputJson field');
      console.log('[WorkflowMonitor] available fields (fallback)', Object.keys(instance));
    }
    
    setSelectedChatInstance(instance);
    setChatModalVisible(true);
  };

  // 處理發送消息
  const handleSendMessage = (message) => {
    console.log('[WorkflowMonitor] send message', message);
    // 這裡可以添加額外的邏輯，比如更新實例狀態等
  };

  // 查看消息發送詳情
  const handleViewMessageSend = async (messageSendId) => {
    try {
      const response = await fetch(`/api/workflowmessagesend/${messageSendId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadMessageSendDetailsFailed'));
      }

      const data = await response.json();
      setSelectedMessageSend(data.data);
      setMessageSendModalVisible(true);
    } catch (error) {
      message.error(t('workflowMonitor.loadMessageSendDetailsFailed') + ': ' + error.message);
    }
  };

  // 查看消息發送詳細狀態（包含收件人詳情）
  const handleViewMessageSendDetail = async (messageSendId) => {
    try {
      // 先獲取單個消息發送記錄的詳情
      const response = await fetch(`/api/workflowmessagesend/${messageSendId}/detail`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadMessageSendStatusFailed'));
      }

      const data = await response.json();
      const messageSend = data.data;
      
      // 使用新的模態框組件
      setSelectedMessageSendId(messageSendId);
      setSelectedWorkflowExecutionId(messageSend.workflowExecutionId);
      setSelectedNodeId(messageSend.nodeId);
      setNewMessageSendStatusModalVisible(true);
    } catch (error) {
      message.error(t('workflowMonitor.loadMessageSendStatusFailed') + ': ' + error.message);
    }
  };

  // 載入內嵌表單實例
  const loadEmbeddedFormInstance = async () => {
    try {
      setLoadingEmbeddedForm(true);
      console.log('[WorkflowMonitor] loading embedded form instance', selectedFormInstanceId);
      
      const response = await fetch(`/api/eforminstances/${selectedFormInstanceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(t('workflowMonitor.loadFormInstanceFailed'));
      }
      
      const data = await response.json();
      console.log('[WorkflowMonitor] loaded embedded form instance', data);
      setEmbeddedFormInstance(data);
    } catch (error) {
      console.error('[WorkflowMonitor] load embedded form instance failed', error);
      message.error(t('workflowMonitor.loadFormInstanceFailed') + ': ' + error.message);
      setEmbeddedFormInstance(null);
    } finally {
      setLoadingEmbeddedForm(false);
    }
  };

  // 表單狀態顏色映射
  const getEformStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'orange';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      case 'Submitted': return 'blue';
      default: return 'default';
    }
  };

  // 表單狀態文字映射
  const getEformStatusText = (status) => {
    switch (status) {
      case 'Pending': return t('workflowMonitor.eformStatusPending');
      case 'Approved': return t('workflowMonitor.eformStatusApproved');
      case 'Rejected': return t('workflowMonitor.eformStatusRejected');
      case 'Submitted': return t('workflowMonitor.eformStatusSubmitted');
      default: return status;
    }
  };

  // 表格列寬調整處理
  const handleResize = useCallback(
    (key) => (e, { size }) => {
      setColumnWidths(prev => ({
        ...prev,
        [key]: size.width,
      }));
    },
    []
  );

  // 表格變化處理（包括排序）
  const handleTableChange = (paginationInfo, filters, sorter) => {
    console.log('[WorkflowMonitor] table change', { paginationInfo, filters, sorter });
    console.log('[WorkflowMonitor] sorter details', {
      field: sorter?.field,
      order: sorter?.order,
      columnKey: sorter?.columnKey,
      column: sorter?.column
    });
    
    // 處理分頁
    if (paginationInfo) {
      console.log('[WorkflowMonitor] pagination change', paginationInfo);
      setPagination(prev => ({ 
        ...prev, 
        current: paginationInfo.current, 
        pageSize: paginationInfo.pageSize 
      }));
    }
    
    // 處理排序
    if (sorter && sorter.field) {
      console.log('[WorkflowMonitor] sort field', sorter.field, 'order', sorter.order);
      // 重新載入數據以應用排序
      loadInstances(sorter.field, sorter.order);
    } else if (paginationInfo) {
      // 只有分頁變更時
      console.log('[WorkflowMonitor] pagination changed with default sort');
      loadInstances();
    }
  };

  // 基礎表格列定義
  const baseColumns = useMemo(() => [
    {
      title: t('workflowMonitor.instanceId'),
      dataIndex: 'id',
      key: 'id',
      width: 120,
      ellipsis: true,
      sorter: true,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: t('workflowMonitor.workflowName'),
      dataIndex: 'workflowName',
      key: 'workflowName',
      width: 200,
      ellipsis: true,
      sorter: true,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: t('workflowMonitor.status'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      render: (status) => getStatusTag(status)
    },
    {
      title: t('workflowMonitor.currentStep'),
      dataIndex: 'currentStep',
      key: 'currentStep',
      width: 120,
      sorter: true,
      render: (step, record) => {
        // 判斷是否為運行中狀態（包括 waiting）
        const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
        const isRunning = status === 'running' || status.includes('wait');
        if (isRunning && step !== null) {
          return (
            <div>
              <Text>{step}</Text>
              <Progress 
                percent={Math.min((step / record.stepCount) * 100, 100)} 
                size="small" 
                showInfo={false}
                strokeColor="#1890ff"
              />
            </div>
          );
        }
        return step || '-';
      }
    },
    {
      title: t('workflowMonitor.startedAt'),
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 150,
      sorter: true,
      render: (date) => TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset)
    },
    {
      title: t('workflowMonitor.duration'),
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      sorter: true,
      render: (duration, record) => {
        // 判斷是否為運行中狀態（包括 waiting）
        const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
        const isRunning = status === 'running' || status.includes('wait');
        if (isRunning) {
          const runningDuration = TimezoneUtils.calculateDuration(record.startedAt, new Date());
          return getDurationText(runningDuration);
        }
        return getDurationText(duration);
      }
    },
    {
      title: t('workflowMonitor.createdBy'),
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
      sorter: true
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 250,
      render: (_, record) => {
        const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
        // 判斷是否為運行中狀態（包括 waiting，因為它們仍在運行中）
        const isRunning = status === 'running' || status.includes('wait');
        return (
        <Space size="small" onClick={(e) => e.stopPropagation()}>
          {/* WhatsApp 對話按鈕 */}
          {canUseWhatsAppChat && (
            <Tooltip title={t('workflowMonitor.whatsappChat')}>
              <Button 
                type="text" 
                icon={<MessageOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenChat(record);
                }}
                style={{ color: '#25d366' }}
              />
            </Tooltip>
          )}
          
          {isRunning && (
            <>
              {canPauseExecution && (
                <Tooltip title={t('workflowMonitor.pause')}>
                  <Button 
                    type="text" 
                    icon={<PauseCircleOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstanceAction('pause', record);
                    }}
                  />
                </Tooltip>
              )}
              {canCancelExecution && (
                <Tooltip title={t('workflowMonitor.cancel')}>
                  <Button 
                    type="text" 
                    icon={<StopOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelInstance(record);
                    }}
                  />
                </Tooltip>
              )}
            </>
          )}
          
          {status === 'failed' && canRetryExecution && (
            <Tooltip title={t('workflowMonitor.retry')}>
              <Button 
                type="text" 
                icon={<ReloadOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleInstanceAction('retry', record);
                }}
              />
            </Tooltip>
          )}
          
          {status === 'paused' && canResumeExecution && (
            <Tooltip title={t('workflowMonitor.resume')}>
              <Button 
                type="text" 
                icon={<PlayCircleOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleInstanceAction('resume', record);
                }}
              />
            </Tooltip>
          )}

          {canDeleteExecution && (
            <Tooltip title={t('workflowMonitor.delete')}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteInstance(record);
                }}
              />
            </Tooltip>
          )}
        </Space>
      );
      }
    }
  ], [
    t,
    userTimezoneOffset,
    selectedInstanceId,
    canUseWhatsAppChat,
    canPauseExecution,
    canCancelExecution,
    canRetryExecution,
    canResumeExecution,
    canDeleteExecution,
    handleOpenChat,
    handleInstanceAction,
    handleCancelInstance,
    handleDeleteInstance,
    getDurationText
  ]);

  // 合併列配置，添加調整功能
  const mergedColumns = baseColumns.map((col) => ({
    ...col,
    onHeaderCell: column => ({
      width: columnWidths[col.key] || col.width,
      onResize: handleResize(col.key),
    }),
    width: columnWidths[col.key] || col.width
  }));

  // 表格組件配置
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 32px)' }}>
        {/* 主內容區域 - 左右分欄 */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* 左側列表區域 */}
          <div style={{ 
            flex: detailPanelVisible ? '0 0 60%' : '1',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflow: 'hidden', // 不允許左側整體滾動，只讓表格內部滾動
            transition: 'flex 0.3s ease',
            minHeight: 0 // 確保 flex 子元素可以正確收縮
          }}>

            {/* 統計卡片 */}
            <div style={{ flexShrink: 0 }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" bodyStyle={{ padding: '12px' }}>
                    <Statistic
                      title={t('workflowMonitor.totalInstancesCount')}
                      value={statistics.total}
                      prefix={<FileTextOutlined />}
                      valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" bodyStyle={{ padding: '12px' }}>
                    <Statistic
                      title={t('workflowMonitor.runningCount')}
                      value={statistics.running}
                      prefix={<SyncOutlinedIcon spin />}
                      valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" bodyStyle={{ padding: '12px' }}>
                    <Statistic
                      title={t('workflowMonitor.completedCount')}
                      value={statistics.completed}
                      prefix={<CheckCircleOutlined />}
                      valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Card size="small" bodyStyle={{ padding: '12px' }}>
                    <Statistic
                      title={t('workflowMonitor.successRate')}
                      value={statistics.successRate}
                      suffix="%"
                      prefix={<CheckCircleOutlined />}
                      valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

        {/* 篩選和搜索 */}
            <div style={{ flexShrink: 0 }}>
              <Card size="small" bodyStyle={{ padding: '12px' }}>
                <Row gutter={[8, 8]} align="middle" wrap={false} style={{ flexWrap: 'nowrap' }}>
            <Col flex="150px">
              <Select
                placeholder={t('workflowMonitor.selectStatus')}
                value={filters.status}
                onChange={handleStatusFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">{t('workflowMonitor.filterAll')}</Option>
                <Option value="running">{t('workflowMonitor.filterRunning')}</Option>
                <Option value="completed">{t('workflowMonitor.filterCompleted')}</Option>
                <Option value="failed">{t('workflowMonitor.filterFailed')}</Option>
              </Select>
            </Col>
            
            <Col flex="240px">
              <RangePicker
                placeholder={[t('workflowMonitor.startDateRange'), t('workflowMonitor.startDateRange')]}
                value={filters.startDateRange}
                onChange={handleStartDateRangeChange}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col flex="240px">
              <RangePicker
                placeholder={[t('workflowMonitor.endDateRange'), t('workflowMonitor.endDateRange')]}
                value={filters.endDateRange}
                onChange={handleEndDateRangeChange}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col flex="auto">
              <Search
                placeholder={t('workflowMonitor.searchPlaceholder')}
                value={filters.searchText}
                onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
                onSearch={handleSearch}
                style={{ width: '100%' }}
              />
            </Col>
            
            <Col flex="none">
              <Space>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={loadInstances}
                  loading={loading}
                >
                  {t('workflowMonitor.refresh')}
                </Button>
                
                <Tooltip title={t('workflowMonitor.autoRefreshSettings')}>
                  <Button 
                    icon={<SettingOutlined />}
                    onClick={handleOpenAutoRefreshSettings}
                  />
                </Tooltip>
              </Space>
            </Col>
          </Row>
        </Card>
            </div>

            {/* 實例列表 */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Card 
                size="small"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
                bodyStyle={{
                  padding: '12px',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
          <div style={{ marginBottom: 12, flexShrink: 0 }}>
            <Space>
              <Text strong>{t('workflowMonitor.instanceList')}</Text>
              <Badge count={instances.length} showZero />
              
              {selectedInstances.length > 0 && (
                <Text type="secondary">
                  {t('workflowMonitor.selectedInstances', { count: selectedInstances.length })}
                </Text>
              )}
            </Space>
          </div>
          
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Table
              components={components}
              columns={mergedColumns}
              dataSource={instances}
              rowKey="id"
              loading={loading}
              pagination={false}
              rowSelection={{
                selectedRowKeys: selectedInstances.map(i => i.id),
                onChange: (selectedRowKeys, selectedRows) => {
                  setSelectedInstances(selectedRows);
                }
              }}
              onChange={handleTableChange}
              scroll={{ 
                x: 1200,
                y: 'calc(100vh - 380px)' // 固定高度，不隨詳情面板變化
              }}
              sticky={{
                offsetHeader: 0
              }}
              onRow={(record) => ({
                onClick: () => handleViewDetails(record),
                style: {
                  cursor: 'pointer',
                  backgroundColor: selectedInstanceId === record.id ? '#e6f7ff' : 'transparent'
                }
              })}
            />
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <Pagination
                current={pagination.current || 1}
                pageSize={pagination.pageSize || 20}
                total={pagination.total || 0}
                showSizeChanger
                showQuickJumper
                pageSizeOptions={['10', '20', '50', '100']}
                showTotal={(total, range) => 
                  t('workflowMonitor.paginationTotal', { start: range[0], end: range[1], total })
                }
                onChange={(page, pageSize) => {
                  setPagination(prev => ({ ...prev, current: page, pageSize }));
                }}
                onShowSizeChange={(current, size) => {
                  setPagination(prev => ({ ...prev, current: 1, pageSize: size }));
                }}
              />
            </div>
          </div>
        </Card>
            </div>
          </div>
          
          {/* 右側詳情面板 */}
          {detailPanelVisible && (
            <div style={{
              flex: '0 0 40%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}>
              {/* 詳情面板標題欄 */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#fafafa'
              }}>
                <Title level={4} style={{ margin: 0 }}>
                  {t('workflowMonitor.instanceDetails')}
                </Title>
                <Button 
                  type="text" 
                  icon={<CloseOutlined />}
                  onClick={handleCloseDetailPanel}
                  style={{ 
                    color: '#666',
                    fontSize: '16px'
                  }}
                />
              </div>
              
              {/* 詳情面板內容 */}
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '24px'
              }}>
          {selectedInstance && (
            <InstanceDetailModal 
              instance={selectedInstance} 
              onClose={handleCloseDetailPanel}
              onViewMessageSend={handleViewMessageSend}
              onViewMessageSendDetail={handleViewMessageSendDetail}
              onViewDataSetQuery={(data) => {
                setDataSetQueryResult(data);
                setDataSetQueryModalVisible(true);
              }}
              onViewFormInstance={(formInstanceId) => {
                setSelectedFormInstanceId(formInstanceId);
                setEmbedFormVisible(true);
              }}
              userTimezoneOffset={userTimezoneOffset}
            />
          )}
          
          {/* 數據集查詢結果模態框 */}
          <Modal
            title="數據集查詢結果"
            open={dataSetQueryModalVisible}
            onCancel={() => setDataSetQueryModalVisible(false)}
            footer={[
              <Button key="close" onClick={() => setDataSetQueryModalVisible(false)}>
                {t('workflowMonitor.close')}
              </Button>
            ]}
            width={1200}
            style={{ top: 20 }}
          >
            {dataSetQueryResult && (
              <div>
                {/* 查詢信息摘要 */}
                <div style={{ 
                  background: '#f0f8ff', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  border: '1px solid #1890ff'
                }}>
                  <Row gutter={[16, 8]}>
                    <Col span={6}>
                      <div>
                        <strong>步驟執行ID:</strong><br/>
                        <span style={{ color: '#666' }}>{dataSetQueryResult.stepExecutionId}</span>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div>
                        <strong>查詢類型:</strong><br/>
                        <Tag color="blue">{dataSetQueryResult.queryType || 'SELECT'}</Tag>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div>
                        <strong>記錄數量:</strong><br/>
                        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                          {dataSetQueryResult.recordCount || 0} 條
                        </span>
                      </div>
                    </Col>
                    <Col span={6}>
                      <div>
                        <strong>執行時間:</strong><br/>
                        <span style={{ color: '#666' }}>
                          {dataSetQueryResult.executedAt ? 
                            TimezoneUtils.formatDateWithTimezone(dataSetQueryResult.executedAt, userTimezoneOffset) : 
                            '-'
                          }
                        </span>
                      </div>
                    </Col>
                  </Row>
                </div>

                {/* 查詢結果表格 */}
                {dataSetQueryResult.queryResult && (
                  <div>
                    <h4 style={{ marginBottom: '16px', color: '#1890ff' }}>
                      <BarChartOutlined style={{ marginRight: '8px' }} />
                      查詢結果詳情
                    </h4>
                    <DataSetQueryResultTable 
                      data={JSON.parse(dataSetQueryResult.queryResult)}
                      recordCount={dataSetQueryResult.recordCount}
                    />
                  </div>
                )}
              </div>
            )}
          </Modal>
              </div>
            </div>
          )}
        </div>

        {/* 自動刷新設定 */}
        <Modal
          title={t('workflowMonitor.autoRefreshSettings')}
          open={autoRefreshModalVisible}
          onCancel={() => setAutoRefreshModalVisible(false)}
          onOk={handleApplyAutoRefreshSettings}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
          destroyOnClose
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text strong>{t('workflowMonitor.autoRefresh')}</Text>
              <Switch
                checked={modalAutoRefreshEnabled}
                onChange={setModalAutoRefreshEnabled}
                checkedChildren={t('common.yes')}
                unCheckedChildren={t('common.no')}
              />
            </div>
            <div>
              <Text strong>{t('workflowMonitor.refreshInterval')}</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <InputNumber
                  min={5}
                  max={600}
                  value={modalRefreshInterval}
                  onChange={(value) => setModalRefreshInterval(value ?? 5)}
                  style={{ width: 140 }}
                />
                <Text type="secondary">{t('workflowMonitor.seconds')}</Text>
              </div>
            </div>
          </Space>
        </Modal>

        {/* WhatsApp 對話框 */}
        <WhatsAppChat
          visible={chatModalVisible}
          onClose={() => setChatModalVisible(false)}
          instance={selectedChatInstance}
          onSendMessage={handleSendMessage}
        />

        {/* 消息發送詳情模態框 */}
        <Modal
          title={t('workflowMonitor.messageSendDetails')}
          visible={messageSendModalVisible}
          onCancel={() => setMessageSendModalVisible(false)}
          footer={null}
          width={1000}
        >
          {selectedMessageSend && (
            <MessageSendDetailModal 
              messageSend={selectedMessageSend} 
              onClose={() => setMessageSendModalVisible(false)}
              userTimezoneOffset={userTimezoneOffset}
            />
          )}
        </Modal>

        {/* 消息發送詳細狀態模態框 */}
        <Modal
          title={t('workflowMonitor.messageSendStatusDetails')}
          visible={messageSendDetailModalVisible}
          onCancel={() => setMessageSendDetailModalVisible(false)}
          footer={null}
          width={1200}
        >
          {selectedMessageSendDetail && (
            <MessageSendStatusDetailModal 
              messageSend={selectedMessageSendDetail} 
              onClose={() => setMessageSendDetailModalVisible(false)}
              onViewMessageSend={handleViewMessageSend}
              onViewMessageSendDetail={handleViewMessageSendDetail}
              userTimezoneOffset={userTimezoneOffset}
            />
          )}
        </Modal>

        {/* 新的消息發送狀態模態框 */}
        <MessageSendStatusModal
          visible={newMessageSendStatusModalVisible}
          onClose={() => setNewMessageSendStatusModalVisible(false)}
          messageSendId={selectedMessageSendId}
          workflowExecutionId={selectedWorkflowExecutionId}
          nodeId={selectedNodeId}
          userTimezoneOffset={userTimezoneOffset}
        />

        {/* 內嵌表單 Modal */}
        <Modal
          title={embeddedFormInstance ? `${t('workflowMonitor.formInstance')}: ${embeddedFormInstance.formName || t('workflowMonitor.unnamedForm')}` : t('workflowMonitor.formInstance')}
          open={embedFormVisible}
          onCancel={handleCloseEmbeddedForm}
          afterClose={handleCloseEmbeddedForm}
          footer={[
            <Button key="close" onClick={handleCloseEmbeddedForm}>
              {t('workflowMonitor.close')}
            </Button>,
            <Button 
              key="openInNewTab" 
              type="primary"
              onClick={() => {
                window.open(`/eform-instance/${selectedFormInstanceId}`, '_blank');
              }}
            >
              {t('workflowMonitor.openInNewTab')}
            </Button>
          ]}
          width="90%"
          style={{ top: 20 }}
          zIndex={1050}
          destroyOnClose={true}
          maskClosable={false}
          className="embedded-form-modal"
        >
          {loadingEmbeddedForm ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingFormInstance')}</p>
            </div>
          ) : embeddedFormInstance ? (
            <div className="embedded-form-container" style={{ 
              padding: '24px',
              minHeight: '400px'
            }}>
              {/* 使用與 EFormInstancePage 相同的左右布局 */}
              <div className="grid-container" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px',
                alignItems: 'start',
                maxWidth: '100%'
              }}>
                {/* 左側：表單基本信息 */}
                <Card 
                  title={t('workflowMonitor.formBasicInfo')} 
                  style={{ 
                    height: 'fit-content',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderRadius: '12px',
                    border: 'none',
                    order: 1
                  }}
                  headStyle={{
                    backgroundColor: '#fafafa',
                    borderBottom: '1px solid #e8e8e8',
                    fontSize: '16px',
                    fontWeight: '600',
                    padding: '16px 20px',
                    borderRadius: '12px 12px 0 0'
                  }}
                  bodyStyle={{
                    padding: '20px'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '16px' 
                  }}>
                    <div>
                      <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.formName')}</strong>
                      <div style={{ 
                        marginTop: '4px', 
                        fontSize: '16px', 
                        fontWeight: '500',
                        color: '#262626'
                      }}>
                        {embeddedFormInstance.formName || t('workflowMonitor.unnamedForm')}
                      </div>
                    </div>
                    
                    <div>
                      <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.instanceName')}</strong>
                      <div style={{ 
                        marginTop: '4px', 
                        fontSize: '14px',
                        color: '#666',
                        wordBreak: 'break-all'
                      }}>
                        {embeddedFormInstance.instanceName || '-'}
                      </div>
                    </div>
                    
                    <div>
                      <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.status')}</strong>
                      <div style={{ marginTop: '4px' }}>
                        <Tag color={getEformStatusColor(embeddedFormInstance.status)} style={{ 
                          fontSize: '12px',
                          padding: '2px 8px'
                        }}>
                          {getEformStatusText(embeddedFormInstance.status)}
                        </Tag>
                      </div>
                    </div>
                    
                    <div>
                      <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.createdAt')}</strong>
                      <div style={{ 
                        marginTop: '4px', 
                        fontSize: '14px',
                        color: '#666'
                      }}>
                        {TimezoneUtils.formatDateWithTimezone(embeddedFormInstance.createdAt, userTimezoneOffset)}
                      </div>
                    </div>
                    
                    <div>
                      <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.fillType')}</strong>
                      <div style={{ marginTop: '4px' }}>
                        {embeddedFormInstance.fillType && (
                          <Tag color={
                            embeddedFormInstance.fillType === 'Manual' ? 'blue' : 
                            embeddedFormInstance.fillType === 'AI' ? 'green' : 
                            embeddedFormInstance.fillType === 'MetaFlows' ? 'purple' : 
                            'orange'
                          } style={{ 
                            fontSize: '12px',
                            padding: '2px 8px'
                          }}>
                            {embeddedFormInstance.fillType}
                          </Tag>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.approvalBy')}</strong>
                      <div style={{ 
                        marginTop: '4px', 
                        fontSize: '14px',
                        color: '#666'
                      }}>
                        {embeddedFormInstance.approvalBy || '-'}
                      </div>
                    </div>
                    
                    {embeddedFormInstance.userMessage && (
                      <div>
                        <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.userInput')}</strong>
                        <div style={{ 
                          marginTop: '4px',
                          padding: '12px',
                          background: '#f6ffed',
                          border: '1px solid #b7eb8f',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#262626'
                        }}>
                          {(() => {
                            const result = extractAiAnalysisResult(embeddedFormInstance.userMessage);
                            // 如果結果包含 HTML 標籤，使用 dangerouslySetInnerHTML
                            if (typeof result === 'string' && result.includes('<table')) {
                              return <div dangerouslySetInnerHTML={{ __html: result }} />;
                            }
                            return result;
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {embeddedFormInstance.approvalNote && (
                      <div>
                        <strong style={{ color: '#666', fontSize: '14px' }}>{t('workflowMonitor.approvalNote')}</strong>
                        <div style={{ 
                          marginTop: '4px',
                          padding: '12px',
                          background: '#fff7e6',
                          border: '1px solid #ffd591',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#262626'
                        }}>
                          {embeddedFormInstance.approvalNote}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 右側：表單內容 */}
                <Card 
                  title={t('workflowMonitor.formContent')} 
                  style={{ 
                    height: 'fit-content',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderRadius: '12px',
                    border: 'none',
                    order: 2
                  }}
                  headStyle={{
                    backgroundColor: '#fafafa',
                    borderBottom: '1px solid #e8e8e8',
                    fontSize: '16px',
                    fontWeight: '600',
                    padding: '16px 20px',
                    borderRadius: '12px 12px 0 0'
                  }}
                  bodyStyle={{
                    padding: '20px'
                  }}
                >
                  {(() => {
                    // 檢查是否是 Meta Flows 類型
                    const isMetaFlows = embeddedFormInstance.fillType === 'MetaFlows';
                    // 優先使用 filledHtmlCode（後端保存 Flow 回覆的字段），如果沒有則使用 htmlCode
                    const htmlCode = embeddedFormInstance.filledHtmlCode || embeddedFormInstance.htmlCode || '';
                    
                    console.log('[WorkflowMonitor] 表單內容:', {
                      fillType: embeddedFormInstance.fillType,
                      isMetaFlows,
                      htmlCodeLength: htmlCode?.length,
                      htmlCodePreview: htmlCode?.substring(0, 200),
                      hasFilledHtmlCode: !!embeddedFormInstance.filledHtmlCode,
                      hasHtmlCode: !!embeddedFormInstance.htmlCode
                    });
                    
                    // 如果是 Meta Flows 且 htmlCode 是 JSON 格式，需要轉換
                    if (isMetaFlows && htmlCode && htmlCode.trim().startsWith('{')) {
                      try {
                        const flowHtml = convertFlowResponseToHtml(htmlCode, t);
                        console.log('[WorkflowMonitor] 轉換後的 HTML 長度:', flowHtml?.length);
                        console.log('[WorkflowMonitor] 轉換後的 HTML 預覽:', flowHtml?.substring(0, 500));
                        // 使用 FlowResponseContent 組件以支持 lightbox
                        return <FlowResponseContent html={flowHtml} />;
                      } catch (e) {
                        console.error('[WorkflowMonitor] Failed to convert Flow response:', e);
                        // 轉換失敗，顯示原始內容
                        return (
                          <div 
                            style={{
                              border: '1px solid #e8e8e8',
                              borderRadius: '8px',
                              padding: '20px',
                              backgroundColor: '#fafafa',
                              minHeight: '300px',
                              overflow: 'auto',
                              fontSize: '14px',
                              lineHeight: '1.6'
                            }}
                          >
                            {htmlCode}
                          </div>
                        );
                      }
                    } else {
                      // 非 Meta Flows 或已經是 HTML 格式，直接顯示
                      return (
                        <div 
                          style={{
                            border: '1px solid #e8e8e8',
                            borderRadius: '8px',
                            padding: '20px',
                            backgroundColor: '#fafafa',
                            minHeight: '300px',
                            overflow: 'auto',
                            fontSize: '14px',
                            lineHeight: '1.6'
                          }}
                          dangerouslySetInnerHTML={{ __html: htmlCode || '' }}
                        />
                      );
                    }
                  })()}
                </Card>
              </div>
            </div>
          ) : (
            <Empty description={t('workflowMonitor.cannotLoadFormInstance')} />
          )}
        </Modal>
      </Content>
    </Layout>
  );
};

// 實例詳情組件
const InstanceDetailModal = ({ instance, onClose, onViewMessageSend, onViewMessageSendDetail, onViewDataSetQuery, onViewFormInstance, userTimezoneOffset }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('history');
  const [eformInstances, setEformInstances] = useState([]);
  const [loadingEforms, setLoadingEforms] = useState(false);
  const [processVariables, setProcessVariables] = useState([]);
  const [loadingProcessVariables, setLoadingProcessVariables] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loadingMediaFiles, setLoadingMediaFiles] = useState(false);
  const [messageValidations, setMessageValidations] = useState([]);
  const [loadingMessageValidations, setLoadingMessageValidations] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxFile, setLightboxFile] = useState(null);
  const [lightboxFiles, setLightboxFiles] = useState([]);
  const [lightboxCurrentIndex, setLightboxCurrentIndex] = useState(0);
  const [lightboxTransform, setLightboxTransform] = useState({
    rotate: 0,
    scale: 1,
    flipH: false,
    flipV: false
  });

  // 載入表單實例數據
  useEffect(() => {
    if (activeTab === 'forms') {
      loadEformInstances();
    }
  }, [activeTab, instance.id]);

  // 載入流程變量數據
  useEffect(() => {
    if (activeTab === 'variables') {
      loadProcessVariables();
    }
  }, [activeTab, instance.id]);

  // 載入媒體文件數據
  useEffect(() => {
    if (activeTab === 'media') {
      loadMediaFiles();
    }
  }, [activeTab, instance.id]);

  // 載入消息驗證數據
  useEffect(() => {
    if (activeTab === 'history') {
      loadMessageValidations();
    }
  }, [activeTab, instance.id]);


  // 鍵盤快捷鍵支持
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!lightboxVisible) return;
      
      switch (event.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          if (lightboxFiles.length > 1) {
            goToPrevious();
          }
          break;
        case 'ArrowRight':
          if (lightboxFiles.length > 1) {
            goToNext();
          }
          break;
        case 'r':
        case 'R':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            rotateImage('right');
          }
          break;
        case 'l':
        case 'L':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            rotateImage('left');
          }
          break;
        case 'h':
        case 'H':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            flipImage('horizontal');
          }
          break;
        case 'v':
        case 'V':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            flipImage('vertical');
          }
          break;
        case '+':
        case '=':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            zoomImage('in');
          }
          break;
        case '-':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            zoomImage('out');
          }
          break;
        case '0':
          if (getFileType(lightboxFile?.fileName) === 'image') {
            resetTransform();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxVisible, lightboxFiles, lightboxFile]);

  const loadEformInstances = async () => {
    try {
      setLoadingEforms(true);
      console.log(t('workflowMonitor.loadingEformInstances', { instanceId: instance.id }));
      
      const response = await fetch(`/api/workflowexecutions/${instance.id}/eform-instances`);
      console.log(t('workflowMonitor.apiResponseStatus'), response.status);
      console.log(t('workflowMonitor.apiResponseStatusText'), response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(t('workflowMonitor.apiEndpointNotExists'));
          // 如果 API 端點不存在，顯示提示信息
          setEformInstances([]);
          message.warning(t('workflowMonitor.eformApiNotImplemented'));
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(t('workflowMonitor.loadedEformData'), data);
      setEformInstances(data);
    } catch (error) {
      console.error(t('workflowMonitor.loadEformInstancesFailed'), error);
      
      // 根據錯誤類型顯示不同的提示信息
      if (error.message.includes('404')) {
        message.error(t('workflowMonitor.eformApiNotExists'));
      } else if (error.message.includes('500')) {
        message.error(t('workflowMonitor.backendServerError'));
      } else {
        message.error(t('workflowMonitor.loadEformInstancesFailed') + ': ' + error.message);
      }
      
      setEformInstances([]);
    } finally {
      setLoadingEforms(false);
    }
  };

  const loadProcessVariables = async () => {
    try {
      setLoadingProcessVariables(true);
      console.log(t('workflowMonitor.loadingProcessVariables', { instanceId: instance.id }));
      
      const response = await fetch(`/api/processvariables/instance-values/${instance.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(t('workflowMonitor.processVariablesApiNotExists'));
          setProcessVariables([]);
          message.warning(t('workflowMonitor.processVariablesApiNotImplemented'));
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(t('workflowMonitor.loadedProcessVariablesData'), data);
      setProcessVariables(data.data || []);
    } catch (error) {
      console.error(t('workflowMonitor.loadProcessVariablesFailed'), error);
      
      if (error.message.includes('404')) {
        message.error(t('workflowMonitor.processVariablesApiNotExists'));
      } else if (error.message.includes('500')) {
        message.error(t('workflowMonitor.backendServerError'));
      } else {
        message.error(t('workflowMonitor.loadProcessVariablesFailed') + ': ' + error.message);
      }
      
      setProcessVariables([]);
    } finally {
      setLoadingProcessVariables(false);
    }
  };

  const loadMediaFiles = async () => {
    try {
      setLoadingMediaFiles(true);
      console.log('🔵 [WorkflowMonitor] loadMediaFiles STARTED for instance:', instance.id);
      console.log(t('workflowMonitor.loadingMediaFiles', { instanceId: instance.id }));
      
      // 並行獲取媒體文件、步驟執行信息和消息驗證記錄
      const [mediaFilesResponse, stepExecutionsResponse, messageValidationsResponse] = await Promise.all([
        fetch(`/api/workflowexecutions/${instance.id}/media-files`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch(`/api/workflowexecutions/${instance.id}/details`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch(`/api/workflowexecutions/${instance.id}/message-validations`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);
      
      // 處理媒體文件
      let mediaFiles = [];
      if (mediaFilesResponse.ok) {
        const mediaData = await mediaFilesResponse.json();
        mediaFiles = mediaData.data || [];
        console.log('🔵 [WorkflowMonitor] Raw media files loaded:', mediaFiles.length, mediaFiles);
      } else if (mediaFilesResponse.status === 404) {
        console.log(t('workflowMonitor.mediaFilesApiNotExists'));
        setMediaFiles([]);
        message.warning(t('workflowMonitor.mediaFilesApiNotImplemented'));
        return;
      } else {
        throw new Error(`HTTP ${mediaFilesResponse.status}: ${mediaFilesResponse.statusText}`);
      }
      
      // 處理步驟執行信息
      let stepExecutions = [];
      if (stepExecutionsResponse.ok) {
        const stepData = await stepExecutionsResponse.json();
        stepExecutions = stepData.stepExecutions || [];
      } else {
        console.warn('Failed to load step executions:', stepExecutionsResponse.status);
      }
      
      // 處理消息驗證記錄
      let messageValidations = [];
      if (messageValidationsResponse.ok) {
        const validationData = await messageValidationsResponse.json();
        messageValidations = validationData.data || [];
      } else {
        console.warn('Failed to load message validations:', messageValidationsResponse.status);
      }
      
      // 創建步驟索引到步驟名稱的映射
      const stepIndexToNameMap = {};
      stepExecutions.forEach(step => {
        stepIndexToNameMap[step.stepIndex] = step.stepName || step.stepType || `Step ${step.stepIndex}`;
      });
      
      console.log('[WorkflowMonitor] Step index to name map:', stepIndexToNameMap);
      
      // 創建媒體URL到步驟索引的映射（通過消息驗證記錄）
      // ✅ 現在 Meta Flows 的圖片也會創建 MessageValidation 記錄，所以統一通過這個映射匹配
      const mediaUrlToStepIndexMap = {};
      messageValidations.forEach(validation => {
        if (validation.mediaUrl) {
          // 標準化路徑格式以便匹配
          const normalizedUrl = validation.mediaUrl.replace(/\\/g, '/');
          mediaUrlToStepIndexMap[normalizedUrl] = validation.stepIndex;
        }
      });
      
      console.log('[WorkflowMonitor] Media URL to step index map:', mediaUrlToStepIndexMap);
      console.log('[WorkflowMonitor] Total media files to enrich:', mediaFiles.length);
      
      // 為每個媒體文件添加步驟信息
      const enrichedMediaFiles = mediaFiles.map((file, index) => {
        // 標準化文件路徑以便匹配
        const normalizedFilePath = file.filePath.replace(/\\/g, '/');
        // 移除前導斜線以便匹配
        const normalizedFilePathNoLeading = normalizedFilePath.startsWith('/') 
          ? normalizedFilePath.substring(1) 
          : normalizedFilePath;
        
        // 嘗試從消息驗證記錄中獲取步驟索引
        let stepIndex = null;
        let stepName = '未知步驟';
        
        console.log(`[WorkflowMonitor] Processing file ${index + 1}/${mediaFiles.length}:`, {
          fileName: file.fileName,
          filePath: file.filePath,
          normalizedFilePath,
          normalizedFilePathNoLeading
        });
        
        // 方法1: 通過完整的文件路徑匹配（帶前導斜線）
        if (mediaUrlToStepIndexMap[normalizedFilePath]) {
          stepIndex = mediaUrlToStepIndexMap[normalizedFilePath];
          console.log(`[WorkflowMonitor] Matched via method 1 (full path with leading slash): stepIndex=${stepIndex}`);
        }
        // 方法2: 通過完整的文件路徑匹配（不帶前導斜線）
        else if (mediaUrlToStepIndexMap[normalizedFilePathNoLeading]) {
          stepIndex = mediaUrlToStepIndexMap[normalizedFilePathNoLeading];
          console.log(`[WorkflowMonitor] Matched via method 2 (full path without leading slash): stepIndex=${stepIndex}`);
        }
        // 方法3: 通過文件名匹配（如果路徑不完整）
        if (stepIndex === null) {
          const fileName = file.fileName;
          console.log(`[WorkflowMonitor] Trying method 3 (filename matching) for: ${fileName}`);
          for (const [url, idx] of Object.entries(mediaUrlToStepIndexMap)) {
            // 標準化 URL 以便匹配
            const normalizedUrl = url.replace(/\\/g, '/');
            const normalizedUrlNoLeading = normalizedUrl.startsWith('/') 
              ? normalizedUrl.substring(1) 
              : normalizedUrl;
            
            // 檢查是否包含文件名
            if (normalizedUrl.includes(fileName) || normalizedUrlNoLeading.includes(fileName)) {
              stepIndex = idx;
              console.log(`[WorkflowMonitor] Matched via method 3a (URL contains filename): stepIndex=${stepIndex}, url=${url}`);
              break;
            }
            // 也檢查反向匹配（文件名包含 URL 的一部分）
            const urlFileName = normalizedUrl.split('/').pop() || normalizedUrlNoLeading.split('/').pop();
            if (urlFileName && (fileName.includes(urlFileName) || urlFileName.includes(fileName))) {
              stepIndex = idx;
              console.log(`[WorkflowMonitor] Matched via method 3b (filename contains URL filename): stepIndex=${stepIndex}, urlFileName=${urlFileName}`);
              break;
            }
          }
        }
        
        // 如果找到了步驟索引，獲取步驟名稱
        if (stepIndex !== null && stepIndexToNameMap[stepIndex]) {
          stepName = stepIndexToNameMap[stepIndex];
        }
        
        console.log('[WorkflowMonitor] Enriching media file result:', {
          fileName: file.fileName,
          filePath: file.filePath,
          stepIndex,
          stepName,
          availableStepIndices: Object.keys(stepIndexToNameMap),
          availableMediaUrls: Object.keys(mediaUrlToStepIndexMap)
        });
        
        return {
          ...file,
          stepIndex: stepIndex,
          stepName: stepName
        };
      });
      
      console.log('🔵 [WorkflowMonitor] Enriched media files:', enrichedMediaFiles);
      const grouped = enrichedMediaFiles.reduce((acc, file) => {
        const stepName = file.stepName || '未知步驟';
        if (!acc[stepName]) acc[stepName] = [];
        acc[stepName].push(file);
        return acc;
      }, {});
      console.log('🔵 [WorkflowMonitor] Grouped by step:', grouped);
      console.log('🔵 [WorkflowMonitor] Step names:', Object.keys(grouped));
      
      setMediaFiles(enrichedMediaFiles);
      console.log('🔵 [WorkflowMonitor] loadMediaFiles COMPLETED, setMediaFiles called with', enrichedMediaFiles.length, 'files');
    } catch (error) {
      console.error(t('workflowMonitor.loadMediaFilesFailed'), error);
      
      if (error.message.includes('404')) {
        message.error(t('workflowMonitor.mediaFilesApiNotExists'));
      } else if (error.message.includes('500')) {
        message.error(t('workflowMonitor.backendServerError'));
      } else {
        message.error(t('workflowMonitor.loadMediaFilesFailed') + ': ' + error.message);
      }
      
      setMediaFiles([]);
    } finally {
      setLoadingMediaFiles(false);
    }
  };

  const loadMessageValidations = async () => {
    try {
      setLoadingMessageValidations(true);
      console.log('加載消息驗證記錄...', instance.id);
      
      const response = await fetch(`/api/workflowexecutions/${instance.id}/message-validations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        console.log('消息驗證記錄 API 調用失敗:', response.status);
        setMessageValidations([]);
        return;
      }
      
      const data = await response.json();
      console.log('已載入消息驗證記錄:', data);
      setMessageValidations(data.data || []);
    } catch (error) {
      console.error('載入消息驗證記錄失敗:', error);
      setMessageValidations([]);
    } finally {
      setLoadingMessageValidations(false);
    }
  };


  const getEformStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'orange';
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      default: return 'default';
    }
  };

  const getEformStatusText = (status) => {
    switch (status) {
      case 'Pending': return t('workflowMonitor.eformStatusPending');
      case 'Approved': return t('workflowMonitor.eformStatusApproved');
      case 'Rejected': return t('workflowMonitor.eformStatusRejected');
      default: return status;
    }
  };

  const getSendReasonTag = (sendReason) => {
    const reasonConfig = {
      normal: { color: 'blue', text: t('workflowMonitor.sendReasonNormal') },
      retry: { color: 'orange', text: t('workflowMonitor.sendReasonRetry') },
      escalation: { color: 'red', text: t('workflowMonitor.sendReasonEscalation') },
      overdue: { color: 'purple', text: t('workflowMonitor.sendReasonOverdue') }
    };
    
    const config = reasonConfig[sendReason] || reasonConfig.normal;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const formatVariableValue = (value, dataType) => {
    if (value === null || value === undefined) {
      return '-';
    }

    switch (dataType.toLowerCase()) {
      case 'datetime':
        return TimezoneUtils.formatDateWithTimezone(value, userTimezoneOffset);
      case 'boolean':
        return value ? t('workflowMonitor.yes') : t('workflowMonitor.no');
      case 'json':
        try {
          const parsed = JSON.parse(value);
          // ✅ 如果是對象，使用 convertJsonToHtmlTable 轉換為 HTML 表格
          if (parsed && typeof parsed === 'object') {
            return <div dangerouslySetInnerHTML={{ __html: convertJsonToHtmlTable(parsed) }} />;
          }
          return JSON.stringify(parsed, null, 2);
        } catch {
          return value.toString();
        }
      case 'text':
        // ✅ 檢測 text 類型是否為 JSON 字符串
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 0) {
            try {
              const parsed = JSON.parse(value);
              // ✅ 如果是對象，使用 convertJsonToHtmlTable 轉換為 HTML 表格
              if (parsed && typeof parsed === 'object') {
                return <div dangerouslySetInnerHTML={{ __html: convertJsonToHtmlTable(parsed) }} />;
              }
              // 如果是數組或其他類型，格式化顯示
              return JSON.stringify(parsed, null, 2);
            } catch (e) {
              // 解析失敗，返回原始字符串
              return value.toString();
            }
          }
        }
        return value.toString();
      default:
        return value.toString();
    }
  };

  const getDataTypeColor = (dataType) => {
    switch (dataType.toLowerCase()) {
      case 'string': return 'blue';
      case 'int': 
      case 'decimal': return 'green';
      case 'datetime': return 'purple';
      case 'boolean': return 'orange';
      case 'text': return 'cyan';
      case 'json': return 'magenta';
      default: return 'default';
    }
  };

  // 媒體文件相關函數
  const getFileIcon = (fileName, file = null) => {
    if (!fileName) {
      return <FileOutlined style={{ color: '#8c8c8c', fontSize: '48px' }} />;
    }
    
    // 處理文件名，移除路徑，只保留文件名
    const fileNameOnly = fileName.split('/').pop().split('\\').pop();
    const fileNameLower = fileNameOnly.toLowerCase();
    
    // 提取擴展名
    let extension = '';
    if (fileNameOnly.includes('.')) {
      extension = fileNameOnly.split('.').pop().toLowerCase().trim();
    }
    
    // 檢查文件對象中的其他字段
    let fileType = null;
    let mimeType = null;
    let contentType = null;
    if (file) {
      fileType = file.fileType || file.type;
      mimeType = file.mimeType || file.mime;
      contentType = file.contentType || file.content_type;
    }
    
    console.log('[WorkflowMonitor] getFileIcon:', { 
      fileName, 
      fileNameOnly, 
      fileNameLower, 
      extension,
      fileType,
      mimeType,
      contentType,
      file
    });
    
    // 優先根據 MIME 類型判斷
    if (mimeType || contentType) {
      const mime = (mimeType || contentType).toLowerCase();
      console.log('[WorkflowMonitor] MIME type check:', mime);
      
      // PDF
      if (mime.includes('pdf') || mime === 'application/pdf') {
        return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '48px' }} />;
      }
      
      // Word 文檔
      if (mime.includes('word') || 
          mime.includes('msword') || 
          mime.includes('document.wordprocessingml') ||
          mime.includes('application/msword') ||
          mime.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')) {
        return <FileWordOutlined style={{ color: '#1890ff', fontSize: '48px' }} />;
      }
      
      // Excel 表格
      if (mime.includes('excel') || 
          mime.includes('spreadsheet') || 
          mime.includes('ms-excel') ||
          mime.includes('spreadsheetml') ||
          mime.includes('application/vnd.ms-excel') ||
          mime.includes('application/vnd.openxmlformats-officedocument.spreadsheetml')) {
        return <FileExcelOutlined style={{ color: '#52c41a', fontSize: '48px' }} />;
      }
      
      // PowerPoint 簡報
      if (mime.includes('powerpoint') || 
          mime.includes('presentation') || 
          mime.includes('ms-powerpoint') ||
          mime.includes('presentationml') ||
          mime.includes('application/vnd.ms-powerpoint') ||
          mime.includes('application/vnd.openxmlformats-officedocument.presentationml')) {
        return <FilePptOutlined style={{ color: '#fa8c16', fontSize: '48px' }} />;
      }
    }
    
    // 根據擴展名判斷
    if (extension) {
      switch (extension) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
        case 'webp':
        case 'svg':
        case 'tiff':
        case 'ico':
          return <FileImageOutlined style={{ color: '#52c41a', fontSize: '48px' }} />;
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
        case 'flv':
        case 'webm':
        case 'mkv':
        case 'm4v':
        case '3gp':
          return <VideoCameraOutlined style={{ color: '#1890ff', fontSize: '48px' }} />;
        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'aac':
        case 'flac':
        case 'm4a':
        case 'wma':
          return <FileOutlined style={{ color: '#fa8c16', fontSize: '48px' }} />;
        case 'pdf':
          return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '48px' }} />;
        case 'doc':
        case 'docx':
          return <FileWordOutlined style={{ color: '#1890ff', fontSize: '48px' }} />;
        case 'xls':
        case 'xlsx':
          return <FileExcelOutlined style={{ color: '#52c41a', fontSize: '48px' }} />;
        case 'ppt':
        case 'pptx':
          return <FilePptOutlined style={{ color: '#fa8c16', fontSize: '48px' }} />;
      }
    }
    
    // 如果沒有擴展名，根據文件名關鍵字判斷
    // 優先檢查具體的文件類型關鍵字
    if (fileNameLower.includes('pdf') || fileNameLower.endsWith('.pdf')) {
      return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '48px' }} />;
    }
    if (fileNameLower.includes('word') || fileNameLower.includes('doc') || fileNameLower.endsWith('.doc') || fileNameLower.endsWith('.docx')) {
      return <FileWordOutlined style={{ color: '#1890ff', fontSize: '48px' }} />;
    }
    if (fileNameLower.includes('excel') || fileNameLower.includes('xls') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.xlsx')) {
      return <FileExcelOutlined style={{ color: '#52c41a', fontSize: '48px' }} />;
    }
    if (fileNameLower.includes('powerpoint') || fileNameLower.includes('ppt') || fileNameLower.endsWith('.ppt') || fileNameLower.endsWith('.pptx')) {
      return <FilePptOutlined style={{ color: '#fa8c16', fontSize: '48px' }} />;
    }
    
    // 檢查文件對象中的其他字段
    if (file) {
      // 檢查 fileType 字段
      const fileTypeStr = (file.fileType || file.type || '').toLowerCase();
      if (fileTypeStr.includes('pdf')) {
        return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '48px' }} />;
      }
      if (fileTypeStr.includes('word') || fileTypeStr.includes('doc')) {
        return <FileWordOutlined style={{ color: '#1890ff', fontSize: '48px' }} />;
      }
      if (fileTypeStr.includes('excel') || fileTypeStr.includes('xls')) {
        return <FileExcelOutlined style={{ color: '#52c41a', fontSize: '48px' }} />;
      }
      if (fileTypeStr.includes('powerpoint') || fileTypeStr.includes('ppt')) {
        return <FilePptOutlined style={{ color: '#fa8c16', fontSize: '48px' }} />;
      }
      
      // 檢查文件名中的其他字段（如 originalFileName）
      if (file.originalFileName) {
        const originalLower = file.originalFileName.toLowerCase();
        if (originalLower.includes('pdf') || originalLower.endsWith('.pdf')) {
          return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '48px' }} />;
        }
        if (originalLower.includes('word') || originalLower.includes('doc') || originalLower.endsWith('.doc') || originalLower.endsWith('.docx')) {
          return <FileWordOutlined style={{ color: '#1890ff', fontSize: '48px' }} />;
        }
        if (originalLower.includes('excel') || originalLower.includes('xls') || originalLower.endsWith('.xls') || originalLower.endsWith('.xlsx')) {
          return <FileExcelOutlined style={{ color: '#52c41a', fontSize: '48px' }} />;
        }
        if (originalLower.includes('powerpoint') || originalLower.includes('ppt') || originalLower.endsWith('.ppt') || originalLower.endsWith('.pptx')) {
          return <FilePptOutlined style={{ color: '#fa8c16', fontSize: '48px' }} />;
        }
      }
    }
    
    // 檢查其他媒體類型關鍵字
    if (fileNameLower.includes('image') || fileNameLower.includes('img') || fileNameLower.includes('photo') || fileNameLower.includes('picture')) {
      return <FileImageOutlined style={{ color: '#52c41a', fontSize: '48px' }} />;
    }
    if (fileNameLower.includes('video') || fileNameLower.includes('movie') || fileNameLower.includes('film')) {
      return <VideoCameraOutlined style={{ color: '#1890ff', fontSize: '48px' }} />;
    }
    if (fileNameLower.includes('audio') || fileNameLower.includes('sound') || fileNameLower.includes('music')) {
      return <FileOutlined style={{ color: '#fa8c16', fontSize: '48px' }} />;
    }
    
    // 對於 "document" 關鍵字，如果沒有其他信息，默認顯示 PDF 圖標（因為 WhatsApp 中 document 通常是 PDF）
    if (fileNameLower.includes('document') && !fileNameLower.includes('word') && !fileNameLower.includes('excel') && !fileNameLower.includes('powerpoint')) {
      return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '48px' }} />;
    }
    
    // 默認返回通用文件圖標
    return <FileOutlined style={{ color: '#8c8c8c', fontSize: '48px' }} />;
  };

  const getFileType = (fileName) => {
    if (!fileName) {
      return 'document';
    }
    
    // 處理文件名，移除路徑，只保留文件名
    const fileNameOnly = fileName.split('/').pop().split('\\').pop();
    const extension = fileNameOnly.includes('.') 
      ? fileNameOnly.split('.').pop().toLowerCase().trim()
      : '';
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
      case 'tiff':
      case 'ico':
        return 'image';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
      case 'mkv':
      case 'm4v':
      case '3gp':
        return 'video';
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'aac':
      case 'flac':
      case 'm4a':
      case 'wma':
        return 'audio';
      default:
        return 'document';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const groupFilesByFolder = (files) => {
    const grouped = {};
    files.forEach(file => {
      const folder = file.folderPath || 'root';
      if (!grouped[folder]) {
        grouped[folder] = [];
      }
      grouped[folder].push(file);
    });
    return grouped;
  };

  // Lightbox 相關函數
  const openLightbox = (file, allFiles = []) => {
    const imageVideoFiles = allFiles.filter(f => {
      const fileType = getFileType(f.fileName);
      return fileType === 'image' || fileType === 'video';
    });
    
    const currentIndex = imageVideoFiles.findIndex(f => f.id === file.id);
    
    setLightboxFiles(imageVideoFiles);
    setLightboxFile(file);
    setLightboxCurrentIndex(currentIndex >= 0 ? currentIndex : 0);
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
    setLightboxVisible(true);
  };

  const closeLightbox = () => {
    setLightboxVisible(false);
    setLightboxFile(null);
    setLightboxFiles([]);
    setLightboxCurrentIndex(0);
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
  };

  const goToPrevious = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex > 0 ? lightboxCurrentIndex - 1 : lightboxFiles.length - 1;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
      setLightboxTransform({
        rotate: 0,
        scale: 1,
        flipH: false,
        flipV: false
      });
    }
  };

  const goToNext = () => {
    if (lightboxFiles.length > 0) {
      const newIndex = lightboxCurrentIndex < lightboxFiles.length - 1 ? lightboxCurrentIndex + 1 : 0;
      setLightboxCurrentIndex(newIndex);
      setLightboxFile(lightboxFiles[newIndex]);
      setLightboxTransform({
        rotate: 0,
        scale: 1,
        flipH: false,
        flipV: false
      });
    }
  };

  const rotateImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      rotate: prev.rotate + (direction === 'left' ? -90 : 90)
    }));
  };

  const flipImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      flipH: direction === 'horizontal' ? !prev.flipH : prev.flipH,
      flipV: direction === 'vertical' ? !prev.flipV : prev.flipV
    }));
  };

  const zoomImage = (direction) => {
    setLightboxTransform(prev => ({
      ...prev,
      scale: direction === 'in' 
        ? Math.min(prev.scale * 1.2, 5) 
        : Math.max(prev.scale / 1.2, 0.1)
    }));
  };

  const resetTransform = () => {
    setLightboxTransform({
      rotate: 0,
      scale: 1,
      flipH: false,
      flipV: false
    });
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={t('workflowMonitor.executionHistory')} key="history">
          <Timeline>
            <Timeline.Item color="green">
              <p>{t('workflowMonitor.workflowStarted')}</p>
              <p>{TimezoneUtils.formatDateWithTimezone(instance.startedAt, userTimezoneOffset)}</p>
            </Timeline.Item>
            {instance.stepExecutions && instance.stepExecutions.length > 0 ? (
              instance.stepExecutions.map((step, index) => {
                // 調試信息：檢查步驟數據結構
                console.log(t('workflowMonitor.stepData', { stepNumber: index + 1 }), step);
                console.log(t('workflowMonitor.stepAvailableFields', { stepNumber: index + 1 }), Object.keys(step));
                console.log('🔍 Step Type Fields:', {
                  stepType: step.stepType,
                  nodeType: step.nodeType,
                  type: step.type,
                  taskType: step.taskType,
                  stepName: step.stepName,
                  nodeName: step.nodeName
                });
                console.log(t('workflowMonitor.stepOutputJson', { stepNumber: index + 1 }), step.outputJson);
                console.log(t('workflowMonitor.stepOutputJsonCapital', { stepNumber: index + 1 }), step.OutputJson);
                console.log(t('workflowMonitor.stepOutput', { stepNumber: index + 1 }), step.output);
                console.log(t('workflowMonitor.stepErrorMessage', { stepNumber: index + 1 }), step.errorMessage);
                
                // 解析 OutputJson 來判斷是否為錯誤
                let outputData = null;
                let isError = false;
                let displayMessage = '';
                
                // 嘗試多個可能的字段名稱
                const jsonContent = step.outputJson || step.OutputJson || step.output;
                
                if (jsonContent) {
                  try {
                    outputData = JSON.parse(jsonContent);
                    console.log(t('workflowMonitor.stepParsedData', { stepNumber: index + 1 }), outputData);
                    
                    // 優先檢查 success 字段
                    if (outputData.success === true) {
                      isError = false;
                      displayMessage = outputData.message || t('workflowMonitor.operationSuccess');
                      console.log(t('workflowMonitor.stepDetectedSuccess', { stepNumber: index + 1 }));
                    }
                    // 檢查是否包含錯誤信息
                    else if (outputData.error) {
                      isError = true;
                      displayMessage = outputData.error;
                      console.log(t('workflowMonitor.stepDetectedError', { stepNumber: index + 1 }));
                    } 
                    // 檢查 message 字段
                    else if (outputData.message) {
                      // 檢查是否為成功的狀態更新消息
                      if (outputData.message.includes("User replied, continuing workflow") || 
                          outputData.message.includes("EForm sent successfully") ||
                          outputData.message.includes("Form already processed") ||
                          outputData.message.includes("waiting for approval") ||
                          outputData.message.includes("Waiting for user reply")) {
                        isError = false;
                        displayMessage = outputData.message;
                        console.log(t('workflowMonitor.stepDetectedSuccessMessage', { stepNumber: index + 1 }));
                      } else {
                        // 默認情況下，message 字段通常表示信息，不是錯誤
                        isError = false;
                        displayMessage = outputData.message;
                        console.log(t('workflowMonitor.stepDetectedNormalMessage', { stepNumber: index + 1 }));
                      }
                    }
                    // 檢查是否為 switch 節點的正常輸出（包含 selectedPaths 等字段）
                    else if (outputData.selectedPaths || outputData.selectedPath || outputData.evaluatedAt) {
                      isError = false;
                      displayMessage = JSON.stringify(outputData, null, 2);
                      console.log(t('workflowMonitor.stepDetectedSwitchOutput', { stepNumber: index + 1 }));
                    }
                    // 如果沒有明確的字段，檢查整個 JSON 內容
                    else {
                      // 如果沒有明確的錯誤標識，通常不是錯誤
                      isError = false;
                      displayMessage = JSON.stringify(outputData, null, 2);
                      console.log(t('workflowMonitor.stepNoClearFields', { stepNumber: index + 1 }));
                    }
                  } catch (parseError) {
                    console.error(t('workflowMonitor.stepParseJsonFailed', { stepNumber: index + 1 }), parseError);
                    // 如果解析失敗，將原始內容作為普通信息顯示
                    displayMessage = jsonContent;
                    isError = false; // 解析失敗不一定是錯誤
                  }
                } else {
                  console.log(t('workflowMonitor.stepNoJsonContentField', { stepNumber: index + 1 }));
                }
                
                console.log(t('workflowMonitor.stepFinalResult', { stepNumber: index + 1 }), { isError, displayMessage });
                
                // 檢查是否為發送消息的節點
                const isMessageSendNode = (step.stepName && (
                  step.stepName.includes('sendWhatsApp') || 
                  step.stepName.includes('sendWhatsAppTemplate') ||
                  step.stepName.includes('sendEForm')
                )) || (step.stepType && (
                  step.stepType.includes('sendWhatsApp') || 
                  step.stepType.includes('sendWhatsAppTemplate') ||
                  step.stepType.includes('sendEForm')
                ));

                // 優先使用 taskName，如果沒有則使用 stepName
                const displayName = step.taskName || step.stepName || `${t('workflowMonitor.step')} ${index + 1}`;
                const nodeType = step.stepType || step.nodeType || step.type;
                
                // 檢查是否為 dataSetQuery 節點
                const isDataSetQueryNode = (step.stepName && step.stepName.includes('dataSetQuery')) || 
                                         (step.stepType && step.stepType.includes('dataSetQuery')) ||
                                         (nodeType === 'dataSetQuery');
                
                // 調試 dataSetQuery 節點
                if (isDataSetQueryNode) {
                  console.log('🔍 dataSetQuery 節點檢測:', {
                    stepName: step.stepName,
                    stepType: step.stepType,
                    nodeType: nodeType,
                    outputData: outputData,
                    hasQueryResult: outputData && outputData.queryResult,
                    hasQueryResultId: outputData && outputData.queryResultId,
                    stepId: step.id
                  });
                }
                
                // 調試信息
                if (step.stepName && step.stepName.includes('sendWhatsApp')) {
                  console.log(t('workflowMonitor.stepIsSendWhatsAppNode', { stepNumber: index + 1, stepName: step.stepName }), {
                    stepName: step.stepName,
                    stepType: step.stepType,
                    status: step.status,
                    isMessageSendNode: isMessageSendNode,
                    outputData: outputData,
                    hasMessageSendId: outputData && outputData.messageSendId
                  });
                }

                // 查找該步驟的用戶回覆（waitReply 或 waitForQRCode）
                // 使用 step.stepIndex 而不是數組索引 index
                const stepValidations = messageValidations.filter(mv => mv.stepIndex === step.stepIndex);
                const isWaitNode = nodeType === 'waitReply' || nodeType === 'waitForQRCode' || nodeType === 'waitforqrcode';
                
                // 調試日誌
                if (isWaitNode) {
                  console.log(`🔍 等待節點 "${displayName}" (stepIndex: ${step.stepIndex}):`, {
                    nodeType,
                    stepIndex: step.stepIndex,
                    totalValidations: messageValidations.length,
                    matchedValidations: stepValidations.length,
                    validations: stepValidations
                  });
                }

                return (
                  <Timeline.Item 
                    key={step.id} 
                    color={(step.status === 'Completed' || step.status === 'completed') ? 'green' : (step.status === 'Failed' || step.status === 'failed') ? 'red' : 'blue'}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Text strong style={{ fontSize: '15px' }}>
                          {displayName}
                        </Text>
                        {nodeType && (
                          <Tag color="blue">
                            {nodeType}
                          </Tag>
                        )}
                      </div>
                      <p>{t('workflowMonitor.stepStatus')}: {step.status}</p>
                      <p>{t('workflowMonitor.stepStartTime')}: {step.startedAt ? TimezoneUtils.formatDateWithTimezone(step.startedAt, userTimezoneOffset) : '-'}</p>
                      {step.endedAt && (
                        <p>{t('workflowMonitor.stepEndTime')}: {TimezoneUtils.formatDateWithTimezone(step.endedAt, userTimezoneOffset)}</p>
                      )}
                        
                        {/* 顯示用戶回覆（waitReply 或 waitForQRCode 節點） */}
                        {isWaitNode && stepValidations.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <Text strong style={{ color: '#1890ff' }}>{t('workflowMonitor.userReplies')}:</Text>
                            
                            {/* 按驗證狀態分組顯示 */}
                            {(() => {
                              // 分組：有效的和無效的
                              const validValidations = stepValidations.filter(v => v.isValid);
                              const invalidValidations = stepValidations.filter(v => !v.isValid);
                              
                              const renderValidationGroup = (validations, isValid, nodeType) => {
                                if (validations.length === 0) return null;
                                
                                // 分離文本消息和圖片消息
                                const textValidations = validations.filter(v => v.messageType === 'text');
                                const imageValidations = validations.filter(v => v.messageType === 'image');
                                
                                // 判斷是否為 QR Code 節點
                                const isQRCodeNode = nodeType === 'waitForQRCode' || nodeType === 'waitforqrcode';
                                
                                // 為 QR Code 節點的 invalid 使用不同的樣式（橙色）
                                const bgColor = isValid ? '#f6ffed' : (isQRCodeNode ? '#fff7e6' : '#fff2f0');
                                const borderColor = isValid ? '#b7eb8f' : (isQRCodeNode ? '#ffd591' : '#ffccc7');
                                
                                return (
                                  <div 
                                    style={{
                                      marginTop: '8px',
                                      padding: '12px',
                                      backgroundColor: bgColor,
                                      border: `1px solid ${borderColor}`,
                                      borderRadius: '6px'
                                    }}
                                  >
                                    {/* 文本消息 */}
                                    {textValidations.map((validation, idx) => (
                                      <div key={validation.id} style={{ marginBottom: idx < textValidations.length - 1 ? '8px' : '0' }}>
                                        <Text>{validation.userMessage}</Text>
                                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                                          {TimezoneUtils.formatDateWithTimezone(validation.createdAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss')}
                      </div>
                                      </div>
                                    ))}
                                    
                                    {/* 圖片消息 - 網格顯示 */}
                                    {imageValidations.length > 0 && (
                                      <div style={{ marginTop: textValidations.length > 0 ? '12px' : '0' }}>
                                        {/* 顯示所有 QR Code 結果和 Caption */}
                                        <div style={{ marginBottom: '8px' }}>
                                          {imageValidations.map((validation, idx) => {
                                            try {
                                              const processedData = validation.processedData ? JSON.parse(validation.processedData) : null;
                                              
                                              // waitForQRCode 節點：userMessage = QR Code 值，caption 在 processedData 中
                                              // waitReply 節點：userMessage = caption（圖片文字說明），processedData 可能沒有 caption
                                              let qrCodeValue = null;
                                              let caption = null;
                                              
                                              if (isQRCodeNode) {
                                                // QR Code 節點
                                                qrCodeValue = validation.userMessage;
                                                caption = processedData?.caption || '';
                                              } else {
                                                // waitReply 節點：直接使用 userMessage 作為文字說明
                                                caption = validation.userMessage || '';
                                              }
                                              
                                              return (
                                                <div key={validation.id} style={{ marginBottom: '4px' }}>
                                                  {/* 只在 waitForQRCode 節點顯示 QR Code 標籤 */}
                                                  {isQRCodeNode && qrCodeValue && (
                                                    <Tag color="green">QR Code: {qrCodeValue}</Tag>
                                                  )}
                                                  
                                                  {/* 顯示 Caption（圖片文字說明） */}
                                                  {caption && (
                                                    <Text style={{ marginLeft: (isQRCodeNode && qrCodeValue) ? '8px' : '0' }}>
                                                      <strong>{t('workflowMonitor.caption')}</strong>
                                                      {caption}
                                                    </Text>
                                                  )}
                                                  
                                                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                                    {TimezoneUtils.formatDateWithTimezone(validation.createdAt, userTimezoneOffset, 'HH:mm:ss')}
                                                  </span>
                                                </div>
                                              );
                                            } catch (e) {
                                              // 解析失敗時的後備顯示
                                              const displayText = validation.userMessage;
                                              return displayText ? (
                                                <div key={validation.id} style={{ marginBottom: '4px' }}>
                                                  {/* waitReply 節點直接顯示文字，不加標籤 */}
                                                  {isQRCodeNode ? (
                                                    <Tag color="green">QR Code: {displayText}</Tag>
                                                  ) : (
                                                    <Text>{displayText}</Text>
                                                  )}
                                                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                                    {TimezoneUtils.formatDateWithTimezone(validation.createdAt, userTimezoneOffset, 'HH:mm:ss')}
                                                  </span>
                                                </div>
                                              ) : null;
                                            }
                                          })}
                                        </div>
                                        
                                        {/* 圖片網格 - 響應式布局 */}
                                        <div style={{ 
                                          display: 'flex',
                                          flexWrap: 'wrap',
                                          gap: '8px',
                                          marginTop: '8px'
                                        }}>
                                          {imageValidations.map((validation) => (
                                            <div
                                              key={validation.id}
                                              style={{
                                                width: '100px',
                                                height: '100px',
                                                border: '1px solid #d9d9d9',
                                                borderRadius: '4px',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s, box-shadow 0.2s'
                                              }}
                                              onClick={() => {
                                                // 點擊打開 Lightbox，顯示所有圖片
                                                const allImages = imageValidations.map(v => ({
                                                  id: v.id,
                                                  fileName: `reply_${v.id}.jpg`,
                                                  filePath: v.mediaUrl,
                                                  fileSize: 0,
                                                  createdAt: v.createdAt
                                                }));
                                                const currentIndex = imageValidations.findIndex(v => v.id === validation.id);
                                                openLightbox(allImages[currentIndex], allImages);
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = 'none';
                                              }}
                                            >
                                              <img
                                                src={validation.mediaUrl}
                                                alt="User reply"
                                                style={{
                                                  width: '100%',
                                                  height: '100%',
                                                  objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* 驗證狀態標籤 */}
                                    <div style={{ 
                                      marginTop: '12px',
                                      paddingTop: '8px',
                                      borderTop: '1px solid ' + (isValid ? '#d9f7be' : (isQRCodeNode ? '#ffe7ba' : '#ffccc7'))
                                    }}>
                                      {/* 根據節點類型顯示不同的標籤 */}
                                      {isValid ? (
                                        <Tag color="success">
                                          {t('workflowMonitor.validationPassed')}
                                        </Tag>
                                      ) : (
                                        <Tag color={isQRCodeNode ? 'orange' : 'error'}>
                                          {isQRCodeNode ? t('workflowMonitor.others') : t('workflowMonitor.validationFailed')}
                                        </Tag>
                                      )}
                                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                                        {validations.length} {validations.length === 1 ? t('workflowMonitor.reply') : t('workflowMonitor.replies')}
                                      </span>
                                    </div>
                                  </div>
                                );
                              };
                              
                              return (
                                <>
                                  {renderValidationGroup(validValidations, true, nodeType)}
                                  {renderValidationGroup(invalidValidations, false, nodeType)}
                                </>
                              );
                            })()}
                          </div>
                        )}
                    
                    {/* 顯示輸出信息，正確區分錯誤和正常信息 */}
                    {displayMessage && (
                      <div style={{ 
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        lineHeight: '1.5',
                        backgroundColor: isError ? '#fff2f0' : '#f6ffed',
                        border: `1px solid ${isError ? '#ffccc7' : '#b7eb8f'}`,
                        color: isError ? '#cf1322' : '#389e0d'
                      }}>
                        <strong>{isError ? t('workflowMonitor.error') + ': ' : t('workflowMonitor.information') + ': '}</strong>
                        {displayMessage}
                        
                        {/* 如果有額外的輸出數據，顯示更多信息 */}
                        {outputData && outputData.timestamp && (
                          <div style={{ 
                            marginTop: '4px', 
                            fontSize: '12px', 
                            opacity: 0.7 
                          }}>
                            {t('workflowMonitor.time')}: {TimezoneUtils.formatDateWithTimezone(outputData.timestamp, userTimezoneOffset)}
                          </div>
                        )}
                        
                        {outputData && outputData.userResponse && (
                          <div style={{ 
                            marginTop: '4px', 
                            fontSize: '12px', 
                            opacity: 0.7 
                          }}>
                            {t('workflowMonitor.userResponse')}: {outputData.userResponse}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* 智能處理 errorMessage 字段，只顯示真正的錯誤信息 */}
                    {step.errorMessage && (
                      (() => {
                        // 檢查 errorMessage 是否與 outputJson 內容相同，如果相同則不顯示（避免重複）
                        const jsonContent = step.outputJson || step.OutputJson || step.output;
                        if (jsonContent && step.errorMessage === jsonContent) {
                          console.log(t('workflowMonitor.stepErrorMessageSameAsOutputJson', { stepNumber: index + 1 }));
                          return null; // 不顯示重複內容
                        }
                        
                        // 檢查 errorMessage 是否包含成功的狀態更新消息
                        try {
                          const errorData = JSON.parse(step.errorMessage);
                          // 如果 errorMessage 包含 success: true 或特定的成功消息，則不顯示
                          if (errorData.success === true || 
                              (errorData.message && (
                                errorData.message.includes("User replied, continuing workflow") ||
                                errorData.message.includes("EForm sent successfully") ||
                                errorData.message.includes("Form already processed") ||
                                errorData.message.includes("waiting for approval") ||
                                errorData.message.includes("Waiting for user reply")
                              )) ||
                              // 檢查是否為 switch 節點的正常輸出
                              errorData.selectedPaths || errorData.selectedPath || errorData.evaluatedAt) {
                            console.log(t('workflowMonitor.stepErrorMessageContainsSuccess', { stepNumber: index + 1 }));
                            return null; // 不顯示
                          }
                        } catch (parseError) {
                          // 如果解析失敗，可能是純文本錯誤信息，正常顯示
                          console.log(t('workflowMonitor.stepErrorMessageParseFailed', { stepNumber: index + 1 }));
                        }
                        
                        // 顯示真正的錯誤信息
                        return (
                          <p style={{ color: 'red' }}>{t('workflowMonitor.error')}: {step.errorMessage}</p>
                        );
                      })()
                    )}
                    
                    {/* ✅ 操作按鈕區域 - 放在最底部 */}
                    {((isMessageSendNode || isWaitNode) || (isDataSetQueryNode && outputData && outputData.queryResultId)) && (
                      <div style={{ 
                        marginTop: '16px', 
                        paddingTop: '12px', 
                        borderTop: '1px solid #f0f0f0',
                        display: 'flex',
                        gap: '8px'
                      }}>
                        {/* sendWhatsApp、waitReply、waitForQRCode、sendEForm 節點按鈕 */}
                        {(isMessageSendNode || isWaitNode) && (
                          <>
                            <Button 
                              type="default" 
                              size="small" 
                              icon={<BarChartOutlined />}
                              onClick={async () => {
                                try {
                                  let messageSendId = null;
                                  
                                  // 對於所有消息發送節點，優先從 outputData 獲取
                                  if (isMessageSendNode && outputData && outputData.messageSendId) {
                                    messageSendId = outputData.messageSendId;
                                    console.log('從 outputData 獲取 messageSendId:', messageSendId);
                                  } else {
                                    // ✅ 對於所有節點，使用 stepExecutionId 查找
                                    console.log('📞 使用 stepExecutionId 查詢 messageSendId:', step.id);
                                    
                                    const response = await fetch(`/api/workflowexecutions/step/${step.id}/message-send-id`, {
                                      headers: {
                                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                                      }
                                    });
                                    
                                    if (response.ok) {
                                      const data = await response.json();
                                      messageSendId = data.messageSendId;
                                      console.log('✅ 從 API 獲取 messageSendId:', messageSendId);
                                    } else {
                                      console.warn('❌ 找不到消息發送記錄，stepExecutionId:', step.id);
                                      message.warning(t('workflowMonitor.cannotFindMessageSendId'));
                                      return;
                                    }
                                  }
                                  
                                  // 打開消息發送狀態模態框
                                  if (messageSendId) {
                                    onViewMessageSendDetail(messageSendId);
                                  } else {
                                    message.warning(t('workflowMonitor.cannotFindMessageSendId'));
                                  }
                                } catch (error) {
                                  console.error('查詢消息發送記錄時發生錯誤:', error);
                                  message.error('查詢消息發送記錄失敗');
                                }
                              }}
                            >
                              {t('workflowMonitor.viewMessageSendStatus')}
                            </Button>
                            
                            {/* sendEForm 節點額外顯示查看表單實例按鈕 */}
                            {nodeType === 'sendEForm' && outputData && outputData.formInstanceId && (
                              <Button 
                                type="default" 
                                size="small" 
                                icon={<FileTextOutlined />}
                                onClick={() => {
                                  // 調用父組件傳入的函數來顯示內嵌表單
                                  if (onViewFormInstance) {
                                    onViewFormInstance(outputData.formInstanceId);
                                  }
                                }}
                              >
                                {t('workflowMonitor.viewFormInstance')}
                              </Button>
                            )}
                          </>
                        )}
                        
                        {/* dataSetQuery 節點按鈕 */}
                        {isDataSetQueryNode && outputData && outputData.queryResultId && (
                          <Button 
                            type="default" 
                            size="small" 
                            icon={<BarChartOutlined />}
                            onClick={async () => {
                              try {
                                // 獲取查詢結果詳情
                                const response = await fetch(`/api/workflowexecutions/step/${step.id}/data-set-query-result`, {
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                                  }
                                });
                                
                                if (response.ok) {
                                  const data = await response.json();
                                  // 在同一界面中顯示數據集查詢結果
                                  onViewDataSetQuery(data);
                                } else {
                                  message.error('無法獲取查詢結果詳情');
                                }
                              } catch (error) {
                                console.error('獲取數據集查詢結果時發生錯誤:', error);
                                message.error('獲取查詢結果失敗');
                              }
                            }}
                          >
                            {t('workflowMonitor.viewDataSet')}
                          </Button>
                        )}
                      </div>
                    )}
                    </div>
                  </Timeline.Item>
                );
              })
            ) : (
              <Timeline.Item color="blue">
                <p>{t('workflowMonitor.noStepExecutionRecords')}</p>
              </Timeline.Item>
            )}
            {instance.status === 'completed' && (
              <Timeline.Item color="green">
                <p>{t('workflowMonitor.workflowCompleted')}</p>
                <p>{TimezoneUtils.formatDateWithTimezone(instance.endedAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss')}</p>
              </Timeline.Item>
            )}
          </Timeline>
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.processVariables')} key="variables">
          {loadingProcessVariables ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingProcessVariables')}</p>
            </div>
          ) : processVariables.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {processVariables.map((variable) => (
                <Card 
                  key={variable.variableName}
                  size="small"
                  style={{ 
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    gap: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '12px' 
                      }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                          {variable.displayName || variable.variableName}
                        </h4>
                        <Tag color={getDataTypeColor(variable.dataType)}>
                          {variable.dataType}
                        </Tag>
                        {variable.isRequired && (
                          <Tag color="red">{t('workflowMonitor.required')}</Tag>
                        )}
                        {variable.hasValue ? (
                          <Tag color="green">{t('workflowMonitor.hasValue')}</Tag>
                        ) : (
                          <Tag color="default">{t('workflowMonitor.noValue')}</Tag>
                        )}
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        fontSize: '14px'
                      }}>
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.variableName')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {variable.variableName}
                          </div>
                        </div>
                        
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.dataType')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {variable.dataType}
                          </div>
                        </div>
                        
                        {variable.description && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.description')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '8px 12px',
                              backgroundColor: '#f6ffed',
                              border: '1px solid #b7eb8f',
                              borderRadius: '6px',
                              fontSize: '14px',
                              lineHeight: '1.5'
                            }}>
                              {variable.description}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.currentValue')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '8px 12px',
                            backgroundColor: variable.hasValue ? '#f6ffed' : '#fff7e6',
                            border: `1px solid ${variable.hasValue ? '#b7eb8f' : '#ffd591'}`,
                            borderRadius: '6px',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            wordBreak: 'break-all'
                          }}>
                            {formatVariableValue(variable.value, variable.dataType)}
                          </div>
                        </div>
                        
                        {variable.defaultValue && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.defaultValue')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {variable.defaultValue}
                            </div>
                          </div>
                        )}
                        
                        {variable.setAt && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.setAt')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {TimezoneUtils.formatDateWithTimezone(variable.setAt, userTimezoneOffset)}
                            </div>
                          </div>
                        )}
                        
                        {variable.setBy && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.setBy')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {variable.setBy}
                            </div>
                          </div>
                        )}
                        
                        {variable.sourceType && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.sourceType')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {variable.sourceType}
                            </div>
                          </div>
                        )}
                        
                        {variable.sourceReference && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.sourceReference')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8',
                              wordBreak: 'break-all'
                            }}>
                              {variable.sourceReference}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty 
              description={t('workflowMonitor.noProcessVariables')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.receivedMedia')} key="media">
          {loadingMediaFiles ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingMediaFiles')}</p>
            </div>
          ) : mediaFiles.length > 0 ? (
            <div>
              <div style={{ 
                marginBottom: '16px',
                paddingBottom: '8px',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <Text strong style={{ fontSize: '16px' }}>
                  {t('workflowMonitor.totalFiles')}: {mediaFiles.length}
                </Text>
              </div>
              
              {/* 按步驟分組顯示 */}
              {(() => {
                // 按步驟名稱分組
                const groupedByStep = mediaFiles.reduce((acc, file) => {
                  const stepName = file.stepName || '未知步驟';
                  if (!acc[stepName]) {
                    acc[stepName] = [];
                  }
                  acc[stepName].push(file);
                  return acc;
                }, {});
                
                // 獲取所有步驟名稱並排序
                const stepNames = Object.keys(groupedByStep).sort();
                
                console.log('[WorkflowMonitor] Grouping media files:', {
                  totalFiles: mediaFiles.length,
                  filesWithStepName: mediaFiles.filter(f => f.stepName && f.stepName !== '未知步驟').length,
                  filesWithoutStepName: mediaFiles.filter(f => !f.stepName || f.stepName === '未知步驟').length,
                  groupedByStep,
                  stepNames
                });
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {stepNames.map((stepName) => {
                      const files = groupedByStep[stepName];
                      console.log(`[WorkflowMonitor] Rendering step group "${stepName}" with ${files.length} files`);
                      return (
                        <div key={stepName} style={{ marginBottom: '8px' }}>
                          {/* 步驟標題 */}
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#f0f8ff',
                            border: '1px solid #91d5ff',
                            borderRadius: '4px',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <Text strong style={{ fontSize: '13px', color: '#1890ff' }}>
                              {stepName}
                            </Text>
                            <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>
                              {files.length} 個文件
                            </Tag>
                          </div>
                          
                          {/* 該步驟的文件列表 */}
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '16px'
                          }}>
                            {files.map((file) => {
                              console.log('[WorkflowMonitor] Rendering media file:', { 
                                fileName: file.fileName, 
                                filePath: file.filePath,
                                originalFileName: file.originalFileName,
                                name: file.name,
                                fileType: file.fileType,
                                mimeType: file.mimeType,
                                contentType: file.contentType,
                                stepName: file.stepName,
                                stepIndex: file.stepIndex,
                                file: file 
                              });
                              // 使用原始文件名或文件名
                              const displayFileName = file.originalFileName || file.name || file.fileName || '';
                              const fileType = getFileType(displayFileName);
                              const isImage = fileType === 'image';
                              const isVideo = fileType === 'video';
                              const isAudio = fileType === 'audio';
                              const isDocument = fileType === 'document';
                              
                              return (
                                <Card
                                  key={file.id}
                                  size="small"
                                  hoverable
                                  style={{ 
                                    border: '1px solid #e8e8e8',
                                    borderRadius: '8px',
                                    overflow: 'hidden'
                                  }}
                                  bodyStyle={{ padding: '8px' }}
                                >
                                  <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center'
                                  }}>
                                    {/* 文件預覽 */}
                                    <div 
                                      style={{ 
                                        width: '100%', 
                                        height: '120px',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '6px',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        cursor: (isImage || isVideo) ? 'pointer' : 'default'
                                      }}
                                      onClick={() => {
                                        if (isImage || isVideo) {
                                          openLightbox(file, mediaFiles);
                                        }
                                      }}
                                    >
                                      {isImage ? (
                                        <img
                                          src={file.filePath}
                                          alt={file.fileName}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '4px'
                                          }}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : isVideo ? (
                                        <video
                                          src={file.filePath}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '4px'
                                          }}
                                          controls={false}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      
                                      {/* 備用圖標 */}
                                      <div style={{ 
                                        display: isImage || isVideo ? 'none' : 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        height: '100%',
                                        backgroundColor: '#f0f0f0'
                                      }}>
                                        {getFileIcon(displayFileName, file)}
                                      </div>
                                    </div>
                                    
                                    {/* 文件信息 */}
                                    <div style={{ width: '100%' }}>
                                      <Text 
                                        strong 
                                        style={{ 
                                          fontSize: '12px',
                                          display: 'block',
                                          marginBottom: '4px',
                                          wordBreak: 'break-all',
                                          lineHeight: '1.2'
                                        }}
                                        title={displayFileName}
                                      >
                                        {displayFileName.length > 20 ? 
                                          displayFileName.substring(0, 20) + '...' : 
                                          displayFileName
                                        }
                                      </Text>
                                      
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        color: '#666'
                                      }}>
                                        <span>{formatFileSize(file.fileSize || 0)}</span>
                                        <Tag 
                                          color={isImage ? 'green' : isVideo ? 'blue' : isAudio ? 'orange' : 'default'}
                                          style={{ fontSize: '10px', margin: 0 }}
                                        >
                                          {isImage ? t('workflowMonitor.image') : 
                                           isVideo ? t('workflowMonitor.video') : 
                                           isAudio ? t('workflowMonitor.audio') :
                                           t('workflowMonitor.document')}
                                        </Tag>
                                      </div>
                                      
                                      {file.createdAt && (
                                        <div style={{ 
                                          fontSize: '10px', 
                                          color: '#999',
                                          marginTop: '4px'
                                        }}>
                                          {new Date(file.createdAt).toLocaleDateString('zh-TW')}
                                        </div>
                                      )}
                                      
                                      {/* 操作按鈕 */}
                                      <div style={{ 
                                        marginTop: '8px',
                                        display: 'flex',
                                        gap: '4px',
                                        justifyContent: 'center'
                                      }}>
                                        <Button 
                                          type="text" 
                                          size="small"
                                          icon={<EyeOutlined />}
                                          onClick={() => {
                                            if (isImage || isVideo) {
                                              openLightbox(file, mediaFiles);
                                            } else {
                                              // 對於非圖片/視頻文件，在新標籤頁中打開
                                              window.open(file.filePath, '_blank');
                                            }
                                          }}
                                          style={{ fontSize: '10px', padding: '2px 6px' }}
                                        >
                                          {t('workflowMonitor.view')}
                                        </Button>
                                        <Button 
                                          type="text" 
                                          size="small"
                                          icon={<DownloadOutlined />}
                                          onClick={() => {
                                            // 下載文件
                                            const link = document.createElement('a');
                                            link.href = file.filePath;
                                            link.download = file.fileName;
                                            link.click();
                                          }}
                                          style={{ fontSize: '10px', padding: '2px 6px' }}
                                        >
                                          {t('workflowMonitor.download')}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <Empty 
              description={t('workflowMonitor.noMediaFiles')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.formInstances')} key="forms">
          {loadingEforms ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingEformInstances')}</p>
            </div>
          ) : eformInstances.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {eformInstances.map((eform) => (
                <Card 
                  key={eform.id}
                  size="small"
                  style={{ 
                    border: '1px solid #e8e8e8',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    gap: '16px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginBottom: '12px' 
                      }}>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                          {eform.formName || t('workflowMonitor.unnamedForm')}
                        </h4>
                        <Tag color={getEformStatusColor(eform.status)}>
                          {getEformStatusText(eform.status)}
                        </Tag>
                        {eform.fillType && (
                          <Tag color={
                            eform.fillType === 'Manual' ? 'blue' : 
                            eform.fillType === 'AI' ? 'green' : 
                            eform.fillType === 'MetaFlows' ? 'purple' : 
                            'orange'
                          }>
                            {eform.fillType}
                          </Tag>
                        )}
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        fontSize: '14px'
                      }}>
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.instanceName')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {eform.instanceName || '-'}
                          </div>
                        </div>
                        
                        <div>
                          <strong style={{ color: '#595959' }}>{t('workflowMonitor.createdAt')}:</strong>
                          <div style={{ 
                            marginTop: '4px',
                            padding: '4px 8px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8'
                          }}>
                            {eform.createdAt ? TimezoneUtils.formatDateWithTimezone(eform.createdAt, userTimezoneOffset) : '-'}
                          </div>
                        </div>
                        
                        {eform.userMessage && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.userInput')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '8px 12px',
                              backgroundColor: '#f6ffed',
                              border: '1px solid #b7eb8f',
                              borderRadius: '6px',
                              fontSize: '14px',
                              lineHeight: '1.5'
                            }}>
                              {(() => {
                                const result = extractAiAnalysisResult(eform.userMessage);
                                // 如果結果包含 HTML 標籤，使用 dangerouslySetInnerHTML
                                if (typeof result === 'string' && result.includes('<table')) {
                                  return <div dangerouslySetInnerHTML={{ __html: result }} />;
                                }
                                return result;
                              })()}
                            </div>
                          </div>
                        )}
                        
                        {eform.approvalBy && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.approvalBy')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {eform.approvalBy}
                            </div>
                          </div>
                        )}
                        
                        {eform.approvalAt && (
                          <div>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.approvalAt')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '4px 8px',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              border: '1px solid #e8e8e8'
                            }}>
                              {TimezoneUtils.formatDateWithTimezone(eform.approvalAt, userTimezoneOffset)}
                            </div>
                          </div>
                        )}
                        
                        {eform.approvalNote && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong style={{ color: '#595959' }}>{t('workflowMonitor.approvalNote')}:</strong>
                            <div style={{ 
                              marginTop: '4px',
                              padding: '8px 12px',
                              backgroundColor: '#fff7e6',
                              border: '1px solid #ffd591',
                              borderRadius: '6px',
                              fontSize: '14px',
                              lineHeight: '1.5'
                            }}>
                              {eform.approvalNote}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ flexShrink: 0 }}>
                      <Space>
                        <Button 
                          type="primary" 
                          size="small"
                          onClick={() => {
                            // 調用父組件傳入的函數來顯示內嵌表單
                            if (onViewFormInstance) {
                              onViewFormInstance(eform.id);
                            }
                          }}
                          style={{ 
                            backgroundColor: '#1890ff',
                            borderColor: '#1890ff'
                          }}
                        >
                          {t('workflowMonitor.viewEmbedded')}
                        </Button>
                      </Space>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty 
              description={t('workflowMonitor.noEformInstances')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
      </Tabs>
      
      {/* Lightbox 組件 */}
      <Modal
        title={lightboxFile ? lightboxFile.fileName : ''}
        visible={lightboxVisible}
        onCancel={closeLightbox}
        footer={null}
        width="95%"
        style={{ top: 10 }}
        bodyStyle={{ 
          padding: 0, 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '85vh',
          backgroundColor: '#000',
          position: 'relative'
        }}
        closable={false}
      >
        {lightboxFile && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center',
            width: '100%',
            height: '100%',
            position: 'relative'
          }}>
            {/* 關閉按鈕 */}
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={closeLightbox}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 1000,
                color: '#fff',
                fontSize: '20px',
                width: '40px',
                height: '40px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: 'none'
              }}
            />
            
            {/* 導航按鈕 */}
            {lightboxFiles.length > 1 && (
              <>
                <Button
                  type="text"
                  icon={<LeftOutlined />}
                  onClick={goToPrevious}
                  style={{
                    position: 'absolute',
                    left: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    fontSize: '24px',
                    width: '50px',
                    height: '50px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
                <Button
                  type="text"
                  icon={<RightOutlined />}
                  onClick={goToNext}
                  style={{
                    position: 'absolute',
                    right: 20,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    color: '#fff',
                    fontSize: '24px',
                    width: '50px',
                    height: '50px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    border: 'none'
                  }}
                />
              </>
            )}
            
            {/* 媒體內容 */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              transform: `
                rotate(${lightboxTransform.rotate}deg) 
                scale(${lightboxTransform.scale}) 
                scaleX(${lightboxTransform.flipH ? -1 : 1}) 
                scaleY(${lightboxTransform.flipV ? -1 : 1})
              `,
              transition: 'transform 0.3s ease'
            }}>
              {getFileType(lightboxFile.fileName) === 'image' ? (
                <img
                  src={lightboxFile.filePath || lightboxFile.dataUrl}
                  alt={lightboxFile.fileName}
                  style={{
                    maxWidth: '90%',
                    maxHeight: '80vh',
                    objectFit: 'contain'
                  }}
                />
              ) : getFileType(lightboxFile.fileName) === 'video' ? (
                <video
                  src={lightboxFile.filePath || lightboxFile.dataUrl}
                  controls
                  style={{
                    maxWidth: '90%',
                    maxHeight: '80vh'
                  }}
                />
              ) : null}
            </div>
            
            {/* 工具欄 */}
            {getFileType(lightboxFile.fileName) === 'image' && (
              <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '8px 16px',
                borderRadius: '8px',
                zIndex: 1000
              }}>
                <Button
                  type="text"
                  icon={<RotateLeftOutlined />}
                  onClick={() => rotateImage('left')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.rotateLeft')}
                />
                <Button
                  type="text"
                  icon={<RotateRightOutlined />}
                  onClick={() => rotateImage('right')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.rotateRight')}
                />
                <Button
                  type="text"
                  icon={<SwapOutlined />}
                  onClick={() => flipImage('horizontal')}
                  style={{ 
                    color: '#fff',
                    transform: lightboxTransform.flipH ? 'scaleX(-1)' : 'none'
                  }}
                  title={t('workflowMonitor.flipHorizontal')}
                />
                <Button
                  type="text"
                  icon={<SwapOutlined />}
                  onClick={() => flipImage('vertical')}
                  style={{ 
                    color: '#fff',
                    transform: lightboxTransform.flipV ? 'scaleY(-1)' : 'none'
                  }}
                  title={t('workflowMonitor.flipVertical')}
                />
                <Button
                  type="text"
                  icon={<ZoomInOutlined />}
                  onClick={() => zoomImage('in')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.zoomIn')}
                />
                <Button
                  type="text"
                  icon={<ZoomOutOutlined />}
                  onClick={() => zoomImage('out')}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.zoomOut')}
                />
                <Button
                  type="text"
                  icon={<ResetOutlined />}
                  onClick={resetTransform}
                  style={{ color: '#fff' }}
                  title={t('workflowMonitor.reset')}
                />
              </div>
            )}
            
            {/* 文件信息 */}
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              zIndex: 1000
            }}>
              {lightboxFiles.length > 1 && (
                <div>{lightboxCurrentIndex + 1} / {lightboxFiles.length}</div>
              )}
              <div>{formatFileSize(lightboxFile.fileSize || 0)}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// 消息發送詳情組件
const MessageSendDetailModal = ({ messageSend, onClose, userTimezoneOffset }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('basic');
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // 載入收件人數據
  useEffect(() => {
    if (messageSend && messageSend.recipients) {
      setRecipients(messageSend.recipients);
    }
  }, [messageSend]);

  const getStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      InProgress: { color: 'processing', text: t('workflowMonitor.statusInProgress') },
      Completed: { color: 'success', text: t('workflowMonitor.statusCompleted') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      PartiallyFailed: { color: 'warning', text: t('workflowMonitor.statusPartiallyFailed') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      Sent: { color: 'processing', text: t('workflowMonitor.statusSent') },
      Delivered: { color: 'success', text: t('workflowMonitor.statusDelivered') },
      Read: { color: 'success', text: t('workflowMonitor.statusRead') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      Retrying: { color: 'warning', text: t('workflowMonitor.statusRetrying') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientTypeTag = (type) => {
    const typeConfig = {
      User: { color: 'blue', text: t('workflowMonitor.recipientTypeUser') },
      Contact: { color: 'green', text: t('workflowMonitor.recipientTypeContact') },
      Group: { color: 'orange', text: t('workflowMonitor.recipientTypeGroup') },
      Hashtag: { color: 'purple', text: t('workflowMonitor.recipientTypeHashtag') },
      Initiator: { color: 'red', text: t('workflowMonitor.recipientTypeInitiator') }
    };
    
    const config = typeConfig[type] || typeConfig.User;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getSendReasonTag = (sendReason) => {
    const reasonConfig = {
      normal: { color: 'blue', text: t('workflowMonitor.sendReasonNormal') },
      retry: { color: 'orange', text: t('workflowMonitor.sendReasonRetry') },
      escalation: { color: 'red', text: t('workflowMonitor.sendReasonEscalation') },
      overdue: { color: 'purple', text: t('workflowMonitor.sendReasonOverdue') }
    };
    
    const config = reasonConfig[sendReason] || reasonConfig.normal;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={t('workflowMonitor.basicInfo')} key="basic">
          <Descriptions bordered column={2}>
            <Descriptions.Item label={t('workflowMonitor.messageSendId')}>{messageSend.id}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.workflowExecutionId')}>{messageSend.workflowExecutionId}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.nodeId')}>{messageSend.nodeId}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.nodeType')}>{messageSend.nodeType}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.messageType')}>{messageSend.messageType}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.status')}>{getStatusTag(messageSend.status)}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.totalRecipients')}>{messageSend.totalRecipients}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.successCount')}>{messageSend.successCount}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.failedCount')}>{messageSend.failedCount}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.startedAt')}>
              {TimezoneUtils.formatDateWithTimezone(messageSend.startedAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.completedAt')}>
              {messageSend.completedAt ? TimezoneUtils.formatDateWithTimezone(messageSend.completedAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.createdBy')}>{messageSend.createdBy}</Descriptions.Item>
            <Descriptions.Item label={t('workflowMonitor.sendReason')}>{getSendReasonTag(messageSend.sendReason)}</Descriptions.Item>
            {messageSend.relatedStepExecutionId && (
              <Descriptions.Item label={t('workflowMonitor.relatedStepExecutionId')}>{messageSend.relatedStepExecutionId}</Descriptions.Item>
            )}
          </Descriptions>
          
          {messageSend.messageContent && (
            <div style={{ marginTop: 16 }}>
              <Text strong>{t('workflowMonitor.messageContent')}:</Text>
              <div style={{ 
                marginTop: 8,
                padding: 12,
                backgroundColor: '#f5f5f5',
                borderRadius: 6,
                border: '1px solid #d9d9d9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {messageSend.messageContent}
              </div>
            </div>
          )}
          
          {messageSend.errorMessage && (
            <Alert
              message={t('workflowMonitor.errorMessage')}
              description={messageSend.errorMessage}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.recipientDetails')} key="recipients">
          {loadingRecipients ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingRecipientDetails')}</p>
            </div>
          ) : recipients.length > 0 ? (
            <>
              <Table
                dataSource={recipients}
                rowKey="id"
                pagination={false}
                scroll={{ x: 800 }}
              columns={[
                {
                  title: t('workflowMonitor.recipient'),
                  dataIndex: 'recipientName',
                  key: 'recipientName',
                  width: 200,
                  render: (text, record) => (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{text}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{record.phoneNumber}</div>
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.type'),
                  dataIndex: 'recipientType',
                  key: 'recipientType',
                  width: 100,
                  render: (type) => getRecipientTypeTag(type)
                },
                {
                  title: t('workflowMonitor.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status) => getRecipientStatusTag(status)
                },
                {
                  title: t('workflowMonitor.whatsAppMessageId'),
                  dataIndex: 'whatsAppMessageId',
                  key: 'whatsAppMessageId',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                },
                {
                  title: t('workflowMonitor.sentAt'),
                  dataIndex: 'sentAt',
                  key: 'sentAt',
                  width: 150,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.deliveredAt'),
                  dataIndex: 'deliveredAt',
                  key: 'deliveredAt',
                  width: 150,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.readAt'),
                  dataIndex: 'readAt',
                  key: 'readAt',
                  width: 150,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.errorMessage'),
                  dataIndex: 'errorMessage',
                  key: 'errorMessage',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                }
              ]}
            />
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <Pagination
                current={1}
                pageSize={10}
                total={recipients.length}
                showSizeChanger
                showQuickJumper
                pageSizeOptions={['5', '10', '20', '50']}
                showTotal={(total, range) => 
                  `第 ${range[0]}-${range[1]} 條，共 ${total} 條記錄`
                }
                onChange={(page, pageSize) => {
                  // 處理分頁變更
                }}
                onShowSizeChange={(current, size) => {
                  // 處理每頁條數變更
                }}
              />
            </div>
            </>
          ) : (
            <Empty 
              description={t('workflowMonitor.noRecipientRecords')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>
      </Tabs>
    </div>
  );
};

// 消息發送詳細狀態組件
const MessageSendStatusDetailModal = ({ messageSend, onClose, onViewMessageSend, onViewMessageSendDetail, userTimezoneOffset }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [statistics, setStatistics] = useState({
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending: 0
  });

  // 載入收件人數據
  useEffect(() => {
    if (messageSend && messageSend.recipients) {
      setRecipients(messageSend.recipients);
      calculateStatistics(messageSend.recipients);
    }
  }, [messageSend]);

  const calculateStatistics = (recipientsData) => {
    const stats = {
      total: recipientsData.length,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0
    };

    recipientsData.forEach(recipient => {
      switch (recipient.status) {
        case 'Sent':
          stats.sent++;
          break;
        case 'Delivered':
          stats.delivered++;
          break;
        case 'Read':
          stats.read++;
          break;
        case 'Failed':
          stats.failed++;
          break;
        case 'Pending':
        default:
          stats.pending++;
          break;
      }
    });

    setStatistics(stats);
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      InProgress: { color: 'processing', text: t('workflowMonitor.statusInProgress') },
      Completed: { color: 'success', text: t('workflowMonitor.statusCompleted') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      PartiallyFailed: { color: 'warning', text: t('workflowMonitor.statusPartiallyFailed') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientStatusTag = (status) => {
    const statusConfig = {
      Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
      Sent: { color: 'processing', text: t('workflowMonitor.statusSent') },
      Delivered: { color: 'success', text: t('workflowMonitor.statusDelivered') },
      Read: { color: 'success', text: t('workflowMonitor.statusRead') },
      Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
      Retrying: { color: 'warning', text: t('workflowMonitor.statusRetrying') }
    };
    
    const config = statusConfig[status] || statusConfig.Pending;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getRecipientTypeTag = (type) => {
    const typeConfig = {
      User: { color: 'blue', text: t('workflowMonitor.recipientTypeUser') },
      Contact: { color: 'green', text: t('workflowMonitor.recipientTypeContact') },
      Group: { color: 'orange', text: t('workflowMonitor.recipientTypeGroup') },
      Hashtag: { color: 'purple', text: t('workflowMonitor.recipientTypeHashtag') },
      Initiator: { color: 'red', text: t('workflowMonitor.recipientTypeInitiator') },
      PhoneNumber: { color: 'cyan', text: t('workflowMonitor.recipientTypePhoneNumber') }
    };
    
    const config = typeConfig[type] || typeConfig.User;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  const getSendReasonTag = (sendReason) => {
    const reasonConfig = {
      normal: { color: 'blue', text: t('workflowMonitor.sendReasonNormal') },
      retry: { color: 'orange', text: t('workflowMonitor.sendReasonRetry') },
      escalation: { color: 'red', text: t('workflowMonitor.sendReasonEscalation') },
      overdue: { color: 'purple', text: t('workflowMonitor.sendReasonOverdue') }
    };
    
    const config = reasonConfig[sendReason] || reasonConfig.normal;
    
    return (
      <Tag color={config.color}>
        {config.text}
      </Tag>
    );
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={t('workflowMonitor.sendOverview')} key="overview">
          {/* 統計卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.totalRecipients')}
                  value={statistics.total}
                  prefix={<MessageOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.sent')}
                  value={statistics.sent}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.delivered')}
                  value={statistics.delivered}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.read')}
                  value={statistics.read}
                  prefix={<EyeOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.failed')}
                  value={statistics.failed}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card>
                <Statistic
                  title={t('workflowMonitor.pending')}
                  value={statistics.pending}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 基本信息 */}
          <Card title={t('workflowMonitor.sendBasicInfo')} style={{ marginBottom: 16 }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label={t('workflowMonitor.messageSendId')}>{messageSend.id}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.workflowExecutionId')}>{messageSend.workflowExecutionId}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.nodeId')}>{messageSend.nodeId}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.nodeType')}>{messageSend.nodeType}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.messageType')}>{messageSend.messageType}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.status')}>{getStatusTag(messageSend.status)}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.totalRecipients')}>{messageSend.totalRecipients}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.successCount')}>{messageSend.successCount}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.failedCount')}>{messageSend.failedCount}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.startedAt')}>
                {TimezoneUtils.formatDateWithTimezone(messageSend.startedAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.completedAt')}>
                {messageSend.completedAt ? TimezoneUtils.formatDateWithTimezone(messageSend.completedAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.createdBy')}>{messageSend.createdBy}</Descriptions.Item>
              <Descriptions.Item label={t('workflowMonitor.sendReason')}>{getSendReasonTag(messageSend.sendReason)}</Descriptions.Item>
              {messageSend.relatedStepExecutionId && (
                <Descriptions.Item label={t('workflowMonitor.relatedStepExecutionId')}>{messageSend.relatedStepExecutionId}</Descriptions.Item>
              )}
            </Descriptions>
            
            {messageSend.messageContent && (
              <div style={{ marginTop: 16 }}>
                <Text strong>{t('workflowMonitor.messageContent')}:</Text>
                <div style={{ 
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {messageSend.messageContent}
                </div>
              </div>
            )}
            
            {messageSend.errorMessage && (
              <Alert
                message={t('workflowMonitor.errorMessage')}
                description={messageSend.errorMessage}
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>

          {/* 所有相關消息發送記錄 */}
          <Card title={t('workflowMonitor.allRelatedMessageSends')} style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <Text type="secondary">
                調試信息: allMessageSends = {JSON.stringify(messageSend.allMessageSends)}
              </Text>
            </div>
            {messageSend.allMessageSends && messageSend.allMessageSends.length > 0 ? (
              <Table
                dataSource={messageSend.allMessageSends}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1000 }}
                columns={[
                  {
                    title: t('workflowMonitor.messageSendId'),
                    dataIndex: 'id',
                    key: 'id',
                    width: 150,
                    ellipsis: true,
                    render: (text, record) => (
                      <Text code style={{ fontSize: '12px' }}>
                        {text.substring(0, 8)}...
                        {record.id === messageSend.id && (
                          <Tag color="blue" style={{ marginLeft: 8 }}>當前</Tag>
                        )}
                      </Text>
                    )
                  },
                  {
                    title: t('workflowMonitor.nodeId'),
                    dataIndex: 'nodeId',
                    key: 'nodeId',
                    width: 100,
                    render: (text) => text || '-'
                  },
                  {
                    title: t('workflowMonitor.sendReason'),
                    dataIndex: 'sendReason',
                    key: 'sendReason',
                    width: 120,
                    render: (sendReason) => getSendReasonTag(sendReason)
                  },
                  {
                    title: t('workflowMonitor.status'),
                    dataIndex: 'status',
                    key: 'status',
                    width: 100,
                    render: (status) => {
                      const statusConfig = {
                        Pending: { color: 'default', text: t('workflowMonitor.statusPending') },
                        InProgress: { color: 'processing', text: t('workflowMonitor.statusInProgress') },
                        Completed: { color: 'success', text: t('workflowMonitor.statusCompleted') },
                        Failed: { color: 'error', text: t('workflowMonitor.statusFailed') },
                        PartiallyFailed: { color: 'warning', text: t('workflowMonitor.statusPartiallyFailed') }
                      };
                      const config = statusConfig[status] || statusConfig.Pending;
                      return <Tag color={config.color}>{config.text}</Tag>;
                    }
                  },
                  {
                    title: t('workflowMonitor.totalRecipients'),
                    dataIndex: 'totalRecipients',
                    key: 'totalRecipients',
                    width: 80,
                    align: 'center'
                  },
                  {
                    title: t('workflowMonitor.successCount'),
                    dataIndex: 'successCount',
                    key: 'successCount',
                    width: 80,
                    align: 'center'
                  },
                  {
                    title: t('workflowMonitor.failedCount'),
                    dataIndex: 'failedCount',
                    key: 'failedCount',
                    width: 80,
                    align: 'center'
                  },
                  {
                    title: t('workflowMonitor.createdBy'),
                    dataIndex: 'createdBy',
                    key: 'createdBy',
                    width: 100,
                    render: (text) => text || '-'
                  },
                  {
                    title: t('workflowMonitor.startedAt'),
                    dataIndex: 'startedAt',
                    key: 'startedAt',
                    width: 120,
                    render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'MM-DD HH:mm:ss') : '-'
                  },
                  {
                    title: t('workflowMonitor.actions'),
                    key: 'actions',
                    width: 100,
                    fixed: 'right',
                    render: (_, record) => (
                      <Space>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => onViewMessageSendDetail(record.id)}
                          disabled={record.id === messageSend.id}
                        >
                          {record.id === messageSend.id ? t('workflowMonitor.current') : t('workflowMonitor.viewDetails')}
                        </Button>
                      </Space>
                    )
                  }
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">暫無相關消息發送記錄</Text>
              </div>
            )}
          </Card>
        </TabPane>
        
        <TabPane tab={t('workflowMonitor.recipientDetails')} key="recipients">
          {loadingRecipients ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <p style={{ marginTop: 16 }}>{t('workflowMonitor.loadingRecipientDetails')}</p>
            </div>
          ) : recipients.length > 0 ? (
            <Table
              dataSource={recipients}
              rowKey="id"
              className="pagination-left-table"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1000 }}
              columns={[
                {
                  title: t('workflowMonitor.recipient'),
                  dataIndex: 'recipientName',
                  key: 'recipientName',
                  width: 200,
                  render: (text, record) => (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{text || t('workflowMonitor.unnamed')}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{record.phoneNumber}</div>
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.type'),
                  dataIndex: 'recipientType',
                  key: 'recipientType',
                  width: 100,
                  render: (type) => getRecipientTypeTag(type)
                },
                {
                  title: t('workflowMonitor.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status) => getRecipientStatusTag(status)
                },
                {
                  title: t('workflowMonitor.whatsAppMessageId'),
                  dataIndex: 'whatsAppMessageId',
                  key: 'whatsAppMessageId',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                },
                {
                  title: t('workflowMonitor.sentAt'),
                  dataIndex: 'sentAt',
                  key: 'sentAt',
                  width: 150,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.deliveredAt'),
                  dataIndex: 'deliveredAt',
                  key: 'deliveredAt',
                  width: 150,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.readAt'),
                  dataIndex: 'readAt',
                  key: 'readAt',
                  width: 150,
                  render: (date) => date ? TimezoneUtils.formatDateWithTimezone(date, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : '-'
                },
                {
                  title: t('workflowMonitor.retryCount'),
                  dataIndex: 'retryCount',
                  key: 'retryCount',
                  width: 80,
                  render: (count, record) => (
                    <div>
                      <Text>{count || 0}</Text>
                      {record.maxRetries && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          / {record.maxRetries}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  title: t('workflowMonitor.errorMessage'),
                  dataIndex: 'errorMessage',
                  key: 'errorMessage',
                  width: 200,
                  ellipsis: true,
                  render: (text) => text || '-'
                }
              ]}
            />
          ) : (
            <Empty 
              description={t('workflowMonitor.noRecipientRecords')} 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0' }}
            />
          )}
        </TabPane>

        <TabPane tab={t('workflowMonitor.statusAnalysis')} key="analysis">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title={t('workflowMonitor.sendStatusDistribution')} style={{ height: '300px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.read')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.read / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#52c41a"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.read}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.delivered')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.delivered / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#52c41a"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.delivered}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.sent')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.sent / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#1890ff"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.sent}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.failed')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.failed / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#ff4d4f"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.failed}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('workflowMonitor.pending')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Progress 
                        percent={statistics.total > 0 ? Math.round((statistics.pending / statistics.total) * 100) : 0} 
                        size="small" 
                        strokeColor="#faad14"
                        style={{ width: '100px' }}
                      />
                      <span>{statistics.pending}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title={t('workflowMonitor.timeAnalysis')} style={{ height: '300px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <Text strong>{t('workflowMonitor.sendStartTime')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {TimezoneUtils.formatDateWithTimezone(messageSend.startedAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss')}
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.sendCompleteTime')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {messageSend.completedAt ? TimezoneUtils.formatDateWithTimezone(messageSend.completedAt, userTimezoneOffset, 'YYYY-MM-DD HH:mm:ss') : t('workflowMonitor.inProgress')}
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.totalSendTime')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {messageSend.completedAt ? 
                        `${TimezoneUtils.calculateDurationInMinutes(messageSend.startedAt, messageSend.completedAt).toFixed(1)} ${t('workflowMonitor.minutes')}` : 
                        t('workflowMonitor.inProgress')
                      }
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.successRate')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {statistics.total > 0 ? 
                        `${((statistics.sent / statistics.total) * 100).toFixed(1)}%` : 
                        '0%'
                      }
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('workflowMonitor.deliveryRate')}:</Text>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {statistics.total > 0 ? 
                        `${((statistics.delivered / statistics.total) * 100).toFixed(1)}%` : 
                        '0%'
                      }
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

// 數據集查詢結果表格組件
const DataSetQueryResultTable = ({ data, recordCount }) => {
  // 處理數據格式，支持多種數據結構
  const processedData = React.useMemo(() => {
    if (!data) return [];
    
    // 如果是數組，直接使用
    if (Array.isArray(data)) {
      return data;
    }
    
    // 如果是對象，嘗試找到數組字段
    if (typeof data === 'object') {
      // 查找可能的數組字段
      const possibleArrayFields = ['results', 'data', 'records', 'items', 'rows'];
      for (const field of possibleArrayFields) {
        if (data[field] && Array.isArray(data[field])) {
          return data[field];
        }
      }
      
      // 如果沒有找到數組字段，將對象轉為單個記錄的數組
      return [data];
    }
    
    return [];
  }, [data]);

  // 獲取所有唯一的欄位名
  const columns = React.useMemo(() => {
    if (processedData.length === 0) return [];
    
    const allKeys = new Set();
    processedData.forEach(record => {
      if (typeof record === 'object' && record !== null) {
        Object.keys(record).forEach(key => allKeys.add(key));
      }
    });
    
    return Array.from(allKeys).map(key => ({
      title: key,
      dataIndex: key,
      key: key,
      width: 150,
      ellipsis: true,
      render: (value) => {
        if (value === null || value === undefined) {
          return <span style={{ color: '#999', fontStyle: 'italic' }}>空值</span>;
        }
        if (typeof value === 'object') {
          return (
            <Tooltip title={JSON.stringify(value, null, 2)}>
              <span style={{ color: '#1890ff', cursor: 'help' }}>
                {JSON.stringify(value)}
              </span>
            </Tooltip>
          );
        }
        return <span>{String(value)}</span>;
      }
    }));
  }, [processedData]);

  if (processedData.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px', 
        color: '#999',
        background: '#fafafa',
        borderRadius: '6px'
      }}>
        <BarChartOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
        <div>暫無查詢結果數據</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        marginBottom: '16px', 
        padding: '8px 12px', 
        background: '#f6ffed', 
        border: '1px solid #b7eb8f',
        borderRadius: '4px',
        color: '#52c41a'
      }}>
        <strong>共找到 {recordCount || processedData.length} 條記錄</strong>
      </div>
      
      <Table
        dataSource={processedData.map((record, index) => ({
          ...record,
          key: index
        }))}
        columns={columns}
        pagination={false}
        scroll={{ x: 'max-content', y: 400 }}
        size="small"
        bordered
        style={{
          background: '#fff'
        }}
      />
    </div>
  );
};

export default WorkflowMonitorPage;
