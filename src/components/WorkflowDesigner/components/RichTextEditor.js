import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/**
 * 富文本編輯器組件，支持流程變量插入
 * 
 * @param {Object} props
 * @param {string} props.value - 編輯器的值（HTML 格式）
 * @param {Function} props.onChange - 值變更回調函數
 * @param {string} props.placeholder - 佔位符文本
 * @param {number} props.height - 編輯器高度（像素），默認 300
 * @param {Object} props.quillRef - 可選的 Quill 實例引用（通過 ref 暴露）
 */
const RichTextEditor = forwardRef(({
  value = '',
  onChange,
  placeholder = '',
  height = 300,
}, ref) => {
  const quillRef = useRef(null);
  const isInternalChangeRef = useRef(false);

  console.log('🔵 RichTextEditor 渲染:', { value: value?.substring(0, 50), valueLength: value?.length });

  // 暴露插入變量的方法給父組件
  useImperativeHandle(ref, () => ({
    insertVariable: (variableName) => {
      console.log('🔵 RichTextEditor.insertVariable 被調用:', variableName);
      const quill = quillRef.current?.getEditor();
      if (quill) {
        isInternalChangeRef.current = true;
        const range = quill.getSelection(true);
        if (range) {
          const variableText = `\${${variableName}}`;
          quill.insertText(range.index, variableText, 'user');
          quill.setSelection(range.index + variableText.length);
        } else {
          // 如果沒有選中範圍，插入到末尾
          const length = quill.getLength();
          const variableText = `\${${variableName}}`;
          quill.insertText(length - 1, variableText, 'user');
          quill.setSelection(length - 1 + variableText.length);
        }
        // 觸發 onChange 以同步值
        const newContent = quill.root.innerHTML;
        console.log('🔵 RichTextEditor.insertVariable 完成，新內容:', newContent?.substring(0, 50));
        if (onChange) {
          onChange(newContent);
        }
        isInternalChangeRef.current = false;
      } else {
        console.warn('🔵 RichTextEditor.insertVariable: quill 實例不存在');
      }
    },
    getEditor: () => quillRef.current?.getEditor(),
  }));

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet',
    'align',
    'link'
  ];

  const handleChange = (content, delta, source, editor) => {
    console.log('🔵 RichTextEditor.handleChange:', { 
      content: content?.substring(0, 50), 
      contentLength: content?.length,
      source,
      isInternal: isInternalChangeRef.current 
    });
    // 只有在非內部變化時才觸發 onChange
    if (!isInternalChangeRef.current && onChange) {
      console.log('🔵 RichTextEditor.handleChange 觸發 onChange');
      onChange(content);
    } else {
      console.log('🔵 RichTextEditor.handleChange 跳過 onChange (內部變化)');
    }
  };

  // 確保 value 是字符串
  const safeValue = value || '';
  
  console.log('🔵 RichTextEditor 返回 JSX:', { 
    safeValue: safeValue?.substring(0, 50),
    safeValueLength: safeValue?.length,
    hasQuillRef: !!quillRef.current
  });

  return (
    <div style={{ height: `${height}px` }}>
      <ReactQuill
        ref={quillRef}
        value={safeValue}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{ height: `${height - 42}px` }}
        theme="snow"
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

