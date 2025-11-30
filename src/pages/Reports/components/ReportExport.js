/**
 * 報表匯出工具
 * 支持 Excel 和 PDF 匯出
 */

import * as XLSX from 'xlsx';
import { parseFormFieldValue } from './FormFieldValueParser';
import { extractVisibleFields } from './DynamicFormColumns';
import { TimezoneUtils } from '../../../utils/timezoneUtils';

/**
 * 將表格數據匯出為 Excel
 * @param {Array} dataSource - 數據源
 * @param {Array} columns - 列定義（包含基礎列和動態列）
 * @param {string} fileName - 文件名（不含擴展名）
 * @param {Object} options - 選項
 * @param {string} options.sheetName - 工作表名稱（默認：'報表數據'）
 */
export const exportToExcel = (dataSource, columns, fileName = 'report', options = {}) => {
  try {
    const { sheetName = '報表數據' } = options;

    // 準備工作表數據
    const worksheetData = [];

    // 1. 生成表頭
    const headers = columns
      .filter(col => col.title && col.dataIndex) // 只包含有標題和 dataIndex 的列
      .map(col => col.title);

    worksheetData.push(headers);

    // 2. 生成數據行
    dataSource.forEach(record => {
      const row = columns
        .filter(col => col.title && col.dataIndex)
        .map(col => {
          const dataIndex = col.dataIndex;
          
          // 處理動態列（以 dynamic_ 開頭）
          if (dataIndex && dataIndex.startsWith('dynamic_')) {
            const fieldId = dataIndex.replace('dynamic_', '');
            return parseFormFieldValue(record, fieldId) || '';
          }

          // 處理基礎列
          let value = record[dataIndex];
          
          // 如果有 render 函數，嘗試獲取渲染值
          if (col.render && typeof col.render === 'function') {
            try {
              // 對於簡單的 render 函數，嘗試直接獲取值
              if (value !== undefined && value !== null) {
                // 如果是日期，使用 TimezoneUtils 格式化
                if (value instanceof Date) {
                  return TimezoneUtils.formatDateTime(value, 'YYYY-MM-DD HH:mm:ss');
                }
                // 如果是字符串格式的日期，也嘗試格式化
                if (typeof value === 'string' && (value.includes('T') || value.includes('-'))) {
                  try {
                    const dateValue = new Date(value);
                    if (!isNaN(dateValue.getTime())) {
                      return TimezoneUtils.formatDateTime(value, 'YYYY-MM-DD HH:mm:ss');
                    }
                  } catch (e) {
                    // 如果解析失敗，繼續使用原始值
                  }
                }
                // 如果是對象，轉為字符串
                if (typeof value === 'object') {
                  return JSON.stringify(value);
                }
                return String(value);
              }
            } catch (error) {
              console.warn('匯出時處理 render 函數失敗:', error);
            }
          }

          // 處理特殊值
          if (value === null || value === undefined) {
            return '';
          }
          if (value instanceof Date) {
            return TimezoneUtils.formatDateTime(value, 'YYYY-MM-DD HH:mm:ss');
          }
          // 如果是字符串格式的日期，也嘗試格式化
          if (typeof value === 'string' && (value.includes('T') || value.includes('-'))) {
            try {
              const dateValue = new Date(value);
              if (!isNaN(dateValue.getTime())) {
                return TimezoneUtils.formatDateTime(value, 'YYYY-MM-DD HH:mm:ss');
              }
            } catch (e) {
              // 如果解析失敗，繼續使用原始值
            }
          }
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }

          return String(value);
        });

      worksheetData.push(row);
    });

    // 3. 創建工作簿和工作表
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // 4. 設置列寬（可選）
    const maxWidth = 50;
    const colWidths = headers.map((_, index) => {
      const maxLength = Math.max(
        ...worksheetData.map(row => {
          const cellValue = row[index];
          return cellValue ? String(cellValue).length : 0;
        })
      );
      return { wch: Math.min(maxLength + 2, maxWidth) };
    });
    worksheet['!cols'] = colWidths;

    // 5. 下載文件
    const today = TimezoneUtils.formatDateTime(new Date(), 'YYYY-MM-DD');
    const excelFileName = `${fileName}_${today}.xlsx`;
    XLSX.writeFile(workbook, excelFileName);

    return { success: true, fileName: excelFileName };
  } catch (error) {
    console.error('Excel 匯出失敗:', error);
    throw new Error(`Excel 匯出失敗: ${error.message}`);
  }
};

/**
 * 將表格數據匯出為 PDF（使用 jsPDF 和 html2canvas）
 * @param {Array} dataSource - 數據源
 * @param {Array} columns - 列定義
 * @param {string} fileName - 文件名（不含擴展名）
 * @param {Object} options - 選項
 * @param {string} options.title - 報表標題
 * @param {Object} options.statistics - 統計數據（可選）
 */
export const exportToPdf = async (dataSource, columns, fileName = 'report', options = {}) => {
  try {
    // 動態導入 jsPDF 和 html2canvas（避免增加初始包大小）
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);

    const { title = '報表', statistics = null } = options;

    // 創建臨時容器
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.padding = '20px';
    container.style.backgroundColor = '#fff';
    container.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(container);

    // 1. 添加標題
    const titleElement = document.createElement('h2');
    titleElement.textContent = title;
    titleElement.style.marginBottom = '20px';
    titleElement.style.textAlign = 'center';
    container.appendChild(titleElement);

    // 2. 添加統計信息（如果有）
    if (statistics) {
      const statsElement = document.createElement('div');
      statsElement.style.marginBottom = '20px';
      statsElement.style.padding = '10px';
      statsElement.style.backgroundColor = '#f5f5f5';
      statsElement.style.borderRadius = '4px';
      
      const statsText = Object.entries(statistics)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');
      statsElement.textContent = statsText;
      container.appendChild(statsElement);
    }

    // 3. 創建表格
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '20px';
    table.style.fontSize = '10px';

    // 表頭
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.backgroundColor = '#f0f0f0';
    
    columns
      .filter(col => col.title && col.dataIndex)
      .forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.title;
        th.style.border = '1px solid #ddd';
        th.style.padding = '8px';
        th.style.textAlign = 'left';
        headerRow.appendChild(th);
      });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 表體
    const tbody = document.createElement('tbody');
    dataSource.slice(0, 100).forEach((record, index) => { // 限制前 100 條記錄
      const row = document.createElement('tr');
      row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
      
      columns
        .filter(col => col.title && col.dataIndex)
        .forEach(col => {
          const td = document.createElement('td');
          td.style.border = '1px solid #ddd';
          td.style.padding = '6px';
          
          const dataIndex = col.dataIndex;
          let value = '';

          // 處理動態列
          if (dataIndex && dataIndex.startsWith('dynamic_')) {
            const fieldId = dataIndex.replace('dynamic_', '');
            value = parseFormFieldValue(record, fieldId) || '';
          } else {
            value = record[dataIndex];
            if (value === null || value === undefined) {
              value = '';
            } else if (value instanceof Date) {
              value = TimezoneUtils.formatDateTime(value, 'YYYY-MM-DD HH:mm:ss');
            } else if (typeof value === 'string' && (value.includes('T') || value.includes('-'))) {
              // 嘗試解析字符串格式的日期
              try {
                const dateValue = new Date(value);
                if (!isNaN(dateValue.getTime())) {
                  value = TimezoneUtils.formatDateTime(value, 'YYYY-MM-DD HH:mm:ss');
                } else {
                  value = String(value);
                }
              } catch (e) {
                value = String(value);
              }
            } else if (typeof value === 'object') {
              value = JSON.stringify(value);
            } else {
              value = String(value);
            }
          }

          td.textContent = value;
          row.appendChild(td);
        });
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);

    // 4. 添加頁腳
    const footer = document.createElement('div');
    footer.style.marginTop = '20px';
    footer.style.textAlign = 'center';
    footer.style.fontSize = '10px';
    footer.style.color = '#666';
    const generatedTime = TimezoneUtils.formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss');
    footer.textContent = `生成時間: ${generatedTime} | 共 ${dataSource.length} 條記錄`;
    container.appendChild(footer);

    // 5. 使用 html2canvas 轉換為圖片
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false
    });

    // 6. 創建 PDF
    const pdf = new jsPDF('l', 'mm', 'a4'); // 橫向 A4
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 297; // A4 橫向寬度（mm）
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    // 添加第一頁
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= 210; // A4 高度（mm）

    // 如果內容超過一頁，添加更多頁
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 210;
    }

    // 7. 下載 PDF
    const today = TimezoneUtils.formatDateTime(new Date(), 'YYYY-MM-DD');
    const pdfFileName = `${fileName}_${today}.pdf`;
    pdf.save(pdfFileName);

    // 8. 清理臨時元素
    document.body.removeChild(container);

    return { success: true, fileName: pdfFileName };
  } catch (error) {
    console.error('PDF 匯出失敗:', error);
    throw new Error(`PDF 匯出失敗: ${error.message}`);
  }
};

/**
 * 匯出報表（支持 Excel 和 PDF）
 * @param {string} format - 匯出格式：'excel' 或 'pdf'
 * @param {Array} dataSource - 數據源
 * @param {Array} columns - 列定義
 * @param {string} fileName - 文件名
 * @param {Object} options - 選項
 */
export const exportReport = async (format, dataSource, columns, fileName, options = {}) => {
  if (format === 'excel') {
    return exportToExcel(dataSource, columns, fileName, options);
  } else if (format === 'pdf') {
    return exportToPdf(dataSource, columns, fileName, options);
  } else {
    throw new Error(`不支持的匯出格式: ${format}`);
  }
};

export default {
  exportToExcel,
  exportToPdf,
  exportReport
};

