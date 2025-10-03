import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Table, Button, Input, Space, Modal, message, Popconfirm, 
  Drawer, Form, Select, Card, Tag, Tooltip, Badge,
  Radio, Checkbox, Divider, Row, Col, Pagination
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, EditOutlined, 
  EyeOutlined, CopyOutlined, MessageOutlined,
  PictureOutlined, VideoCameraOutlined, AudioOutlined, FileOutlined,
  EnvironmentOutlined, UserOutlined, LinkOutlined, SearchOutlined
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { useLanguage } from '../contexts/LanguageContext';

const { Option } = Select;

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

const InternalTemplatePanel = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form] = Form.useForm();

  // 新增狀態用於動態表單
  const [templateType, setTemplateType] = useState('Text');
  const [interactiveType, setInteractiveType] = useState('button');
  const [mediaType, setMediaType] = useState('image');
  const [variables, setVariables] = useState([]);
  const [pendingTemplateData, setPendingTemplateData] = useState(null);
  
  // 新增狀態用於管理按鈕和列表選項
  const [buttons, setButtons] = useState([]);
  const [listOptions, setListOptions] = useState([]);
  
  // 地圖相關狀態
  const [locationMap, setLocationMap] = useState(null);
  const [locationMarker, setLocationMarker] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchMap, setSearchMap] = useState(null);
  const [isMapInitializing, setIsMapInitializing] = useState(false);
  
  // 地圖容器引用
  const locationMapRef = useRef(null);
  const searchMapRef = useRef(null);
  
  // Form 引用
  const formRef = useRef(null);
  
  // 表格列寬調整相關狀態
  const [resizableColumns, setResizableColumns] = useState([]);

  const { t } = useLanguage();

  // 在組件頂部添加調試信息
  useEffect(() => {
    console.log('🔍 [InternalTemplatePanel] 組件初始化');
    console.log('🔍 [InternalTemplatePanel] Token:', localStorage.getItem('token') ? '存在' : '不存在');
    console.log('🔍 [InternalTemplatePanel] UserInfo:', localStorage.getItem('userInfo'));
    
    fetchTemplates();
    fetchCategories();
  }, [currentPage, pageSize, sortField, sortOrder, searchText, categoryFilter, statusFilter]);

  // 處理 URL 參數中的 edit 參數
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId) {
      console.log('🔍 [InternalTemplatePanel] 檢測到 edit 參數:', editId);
      
      // 等待模板列表載入完成後再處理編輯
      if (templates.length > 0) {
      const templateToEdit = templates.find(template => 
        template.id === editId || 
        template.id.toString() === editId ||
        template.name === editId
      );
      
      if (templateToEdit) {
        console.log('🔍 [InternalTemplatePanel] 找到要編輯的模板:', templateToEdit);
        handleEditTemplate(templateToEdit);
        
        // 清除 URL 參數，避免重複觸發
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        } else {
          console.log('❌ [InternalTemplatePanel] 未找到要編輯的模板:', editId);
          message.warning(`未找到 ID 為 ${editId} 的模板`);
        }
      }
    }
  }, [templates]);

  // 獲取模板列表
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 [fetchTemplates] 開始獲取模板列表');
      console.log('🔍 [fetchTemplates] Token:', token ? '存在' : '不存在');
      
      const params = new URLSearchParams({
        page: currentPage,
        pageSize: pageSize,
        sortField: sortField,
        sortOrder: sortOrder,
        search: searchText,
        category: categoryFilter,
        status: statusFilter
      });

      console.log('🔍 [fetchTemplates] 請求參數:', params.toString());

      const response = await fetch(`/api/whatsapptemplates?${params}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(' [fetchTemplates] 響應狀態:', response.status, response.statusText);
      
      const result = await response.json();
      console.log(' [fetchTemplates] 響應數據:', result);
      
      // 適配後端響應格式
      if (result.data !== undefined) {
        console.log('🔍 [fetchTemplates] 設置模板數據:', result.data);
        setTemplates(result.data);
        setTotal(result.total);
      } else {
        console.error('❌ [fetchTemplates] 響應格式錯誤:', result);
        message.error(t('whatsappTemplate.templateGetTemplateListFailed'));
      }
    } catch (error) {
      console.error('❌ [fetchTemplates] 獲取模板列表錯誤:', error);
      message.error(t('whatsappTemplate.templateGetTemplateListFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 獲取分類列表
  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates/categories', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        }
      });
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('獲取分類列表錯誤:', error);
    }
  };

  // 地圖相關函數
  const initializeLocationMap = useCallback(() => {
    // eslint-disable-next-line no-undef
    if (typeof L === 'undefined') {
      console.warn('Leaflet 未載入，請檢查 CDN 連接');
      return;
    }

    // 檢查地圖容器是否存在
    const mapContainer = locationMapRef.current || document.getElementById('locationMap');
    if (!mapContainer) return;

    // 如果地圖已經存在，先銷毀
    if (locationMap) {
      safeRemoveMap(locationMap, '主地圖');
      setLocationMap(null);
    }

    // 檢查容器是否已經被使用，如果是則清理
    if (mapContainer._leaflet_id) {
      console.log('地圖容器已被使用，正在清理...');
      try {
        delete mapContainer._leaflet_id;
      } catch (error) {
        console.warn('清理地圖容器時出現警告:', error);
      }
    }

    // 檢查是否正在初始化
    if (isMapInitializing) {
      console.log('地圖正在初始化中，跳過重複初始化');
      return;
    }

    // 標記正在初始化
    setIsMapInitializing(true);

    // 檢查是否已有經緯度值
    const existingLat = form.getFieldValue('latitude');
    const existingLng = form.getFieldValue('longitude');
    
    let initialLat = 22.3193; // 香港默認位置
    let initialLng = 114.1694;
    let initialZoom = 10;
    
    if (existingLat && existingLng && !isNaN(parseFloat(existingLat)) && !isNaN(parseFloat(existingLng))) {
      initialLat = parseFloat(existingLat);
      initialLng = parseFloat(existingLng);
      initialZoom = 15;
    }
    
    // 創建新地圖
    // eslint-disable-next-line no-undef
    const map = L.map('locationMap').setView([initialLat, initialLng], initialZoom);

    // 添加 OpenStreetMap 瓦片
    // eslint-disable-next-line no-undef
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 如果已有經緯度值，創建標記
    if (existingLat && existingLng && !isNaN(parseFloat(existingLat)) && !isNaN(parseFloat(existingLng))) {
      // eslint-disable-next-line no-undef
      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      setLocationMarker(marker);
      
      // 設置標記拖拽事件
      marker.on('dragend', (e) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng();
        
        // 更新表單值
        form.setFieldsValue({
          latitude: newLat.toFixed(6),
          longitude: newLng.toFixed(6),
        });
        
        // 反向地理編碼獲取新地址
        reverseGeocode(newLat, newLng);
      });
    }

    // 設置地圖點擊事件
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      
      // 更新表單值
      form.setFieldsValue({
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6)
      });

      // 移除舊標記（如果存在）
      if (locationMarker) {
        locationMarker.remove();
        setLocationMarker(null);
      }
      
      // 創建新標記
      // eslint-disable-next-line no-undef
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      setLocationMarker(marker);
      
      // 設置標記拖拽事件
      marker.on('dragend', (e) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng();
        
        // 更新表單值
        form.setFieldsValue({
          latitude: newLat.toFixed(6),
          longitude: newLng.toFixed(6),
        });
        
        // 反向地理編碼獲取新地址
        reverseGeocode(newLat, newLng);
      });

      // 反向地理編碼獲取地址
      reverseGeocode(lat, lng);
    });

    setLocationMap(map);
    
    // 移除初始化標記
    setIsMapInitializing(false);
  }, [form, locationMap, locationMarker]);

  // 獲取當前位置
  const handleGetCurrentLocation = () => {
    setLocationLoading(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // 更新表單值
          form.setFieldsValue({
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6)
          });

          // 移動地圖到當前位置
          if (locationMap) {
            locationMap.setView([latitude, longitude], 15);
            
            // 移除舊標記（如果存在）
            if (locationMarker) {
              locationMarker.remove();
              setLocationMarker(null);
            }
            
            // 創建新標記
            // eslint-disable-next-line no-undef
            const marker = L.marker([latitude, longitude], { draggable: true }).addTo(locationMap);
            setLocationMarker(marker);
            
            // 設置標記拖拽事件
            marker.on('dragend', (e) => {
              const { lat: newLat, lng: newLng } = e.target.getLatLng();
              
              // 更新表單值
              form.setFieldsValue({
                latitude: newLat.toFixed(6),
                longitude: newLng.toFixed(6),
              });
              
              // 反向地理編碼獲取新地址
              reverseGeocode(newLat, newLng);
            });
          }

          // 反向地理編碼獲取地址
          reverseGeocode(latitude, longitude);
          setLocationLoading(false);
        },
        (error) => {
          console.error('獲取位置失敗:', error);
          message.error('無法獲取當前位置，請手動選擇');
          setLocationLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      message.error('您的瀏覽器不支持地理定位');
      setLocationLoading(false);
    }
  };

  // 反向地理編碼
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        // 更新地址字段
        form.setFieldsValue({
          locationAddress: data.display_name
        });
        
        // 如果沒有位置名稱，使用地名
        if (!form.getFieldValue('locationName')) {
          const name = data.name || data.address?.city || data.address?.town || '未知位置';
          form.setFieldsValue({
            locationName: name
          });
        }
      }
    } catch (error) {
      console.error('反向地理編碼失敗:', error);
    }
  };

  // 簡單的防抖函數
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  // 防抖搜索函數
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query.trim()) return;
      
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        );
        const results = await response.json();
        
        if (results.length > 0) {
          const result = results[0];
          setSearchResult(result);
          
          // 在主地圖上顯示搜索結果
          if (locationMap) {
            // 移動地圖到搜索結果位置
            locationMap.setView([result.lat, result.lon], 15);
            
            // 移除舊標記（如果存在）
            if (locationMarker) {
              locationMarker.remove();
              setLocationMarker(null);
            }
            
            // 創建新標記
            // eslint-disable-next-line no-undef
            const marker = L.marker([result.lat, result.lon], { draggable: true }).addTo(locationMap);
            setLocationMarker(marker);
            
            // 設置標記拖拽事件
            marker.on('dragend', (e) => {
              const { lat: newLat, lng: newLng } = e.target.getLatLng();
              
              // 更新表單值
              form.setFieldsValue({
                latitude: newLat.toFixed(6),
                longitude: newLng.toFixed(6),
              });
              
              // 反向地理編碼獲取新地址
              reverseGeocode(newLat, newLng);
            });
            
            // 更新表單值
            form.setFieldsValue({
              latitude: parseFloat(result.lat).toFixed(6),
              longitude: parseFloat(result.lon).toFixed(6),
              locationName: result.name || result.display_name.split(',')[0],
              locationAddress: result.display_name
            });
            
            message.success('地址搜索成功！您可以拖拽標記到更精確的位置');
          } else {
            // 如果主地圖還沒初始化，初始化搜索地圖
            initializeSearchMap(result.lat, result.lon);
          }
        } else {
          message.warning('未找到相關地址');
        }
      } catch (error) {
        console.error('地址搜索失敗:', error);
        message.error('搜索失敗，請稍後重試');
      }
    }, 500),
    [locationMap, locationMarker, form]
  );

  // 地址搜索處理函數
  const handleAddressSearch = (query) => {
    debouncedSearch(query);
  };

  

  const initializeSearchMap = (lat, lon) => {
    // eslint-disable-next-line no-undef
    if (typeof L === 'undefined') return;
    
    const mapContainer = searchMapRef.current || document.getElementById('searchMap');
    if (!mapContainer) return;
    
    // 檢查容器是否已經被使用，如果是則清理
    if (mapContainer._leaflet_id) {
      console.log('搜索地圖容器已被使用，正在清理...');
      try {
        delete mapContainer._leaflet_id;
      } catch (error) {
        console.warn('清理搜索地圖容器時出現警告:', error);
      }
    }
    
    // 如果地圖已經存在，先銷毀
    if (searchMap) {
      safeRemoveMap(searchMap, '搜索地圖');
    }
    
    // 創建新地圖
    // eslint-disable-next-line no-undef
    const map = L.map('searchMap').setView([lat, lon], 15);
    
    // 添加 OpenStreetMap 瓦片
    // eslint-disable-next-line no-undef
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // 添加標記
    // eslint-disable-next-line no-undef
    L.marker([lat, lon]).addTo(map);
    
    setSearchMap(map);
  };

  const handleSelectSearchResult = () => {
    if (!searchResult) return;
    
    // 更新主表單
    form.setFieldsValue({
      latitude: parseFloat(searchResult.lat).toFixed(6),
      longitude: parseFloat(searchResult.lon).toFixed(6),
      locationName: searchResult.name || searchResult.display_name.split(',')[0],
      locationAddress: searchResult.display_name
    });
    
    // 如果主地圖存在，移動到搜索結果位置
    if (locationMap) {
      locationMap.setView([searchResult.lat, searchResult.lon], 15);
      
      // 移除舊標記（如果存在）
      if (locationMarker) {
        locationMarker.remove();
        setLocationMarker(null);
      }
      
      // 創建新標記
      // eslint-disable-next-line no-undef
      const marker = L.marker([searchResult.lat, searchResult.lon], { draggable: true }).addTo(locationMap);
      setLocationMarker(marker);
      
      // 設置標記拖拽事件
      marker.on('dragend', (e) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng();
        
        // 更新表單值
        form.setFieldsValue({
          latitude: newLat.toFixed(6),
          longitude: newLng.toFixed(6),
        });
        
        // 反向地理編碼獲取新地址
        reverseGeocode(newLat, newLng);
      });
    }
    
    // 關閉搜索 Modal
    setShowLocationSearch(false);
    setSearchResult(null);
  };

  // 當模板類型變更時初始化地圖
  useEffect(() => {
    if (templateType === 'Location' && isTemplateModalVisible && !locationMap && !isMapInitializing) {
      // 延遲初始化，確保 DOM 已渲染
      const timer = setTimeout(() => {
        // 檢查地圖容器是否已經準備好
        if (locationMapRef.current || document.getElementById('locationMap')) {
          initializeLocationMap();
        } else {
          console.log('地圖容器尚未準備好，延遲初始化');
          // 再次延遲嘗試
          setTimeout(() => {
            if (locationMapRef.current || document.getElementById('locationMap')) {
              initializeLocationMap();
            }
          }, 200);
        }
      }, 300);
      
      // 清理定時器
      return () => clearTimeout(timer);
    }
  }, [templateType, isTemplateModalVisible, locationMap, isMapInitializing, initializeLocationMap]);

  // 當表單值變化時，如果有經緯度則在地圖上顯示標記
  useEffect(() => {
    if (locationMap && templateType === 'Location') {
      const latitude = form.getFieldValue('latitude');
      const longitude = form.getFieldValue('longitude');
      
      if (latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        // 移動地圖到指定位置
        locationMap.setView([lat, lng], 15);
        
        // 移除舊標記（如果存在）
        if (locationMarker) {
          locationMarker.remove();
          setLocationMarker(null);
        }
        
        // 創建新標記
        // eslint-disable-next-line no-undef
        const marker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
        setLocationMarker(marker);
        
        // 設置標記拖拽事件
        marker.on('dragend', (e) => {
          const { lat: newLat, lng: newLng } = e.target.getLatLng();
          
          // 更新表單值
          form.setFieldsValue({
            latitude: newLat.toFixed(6),
            longitude: newLng.toFixed(6),
          });
          
          // 反向地理編碼獲取新地址
          reverseGeocode(newLat, newLng);
        });
      }
    }
  }, [locationMap, templateType, form, locationMarker]);

  // 當模板 Modal 關閉時清理地圖資源
  useEffect(() => {
    if (!isTemplateModalVisible) {
      // 清理地圖資源
      if (locationMap) {
        safeRemoveMap(locationMap, '主地圖');
        setLocationMap(null);
      }
      if (locationMarker) {
        setLocationMarker(null);
      }
      setIsMapInitializing(false);
      
      // 清理搜索地圖
      if (searchMap) {
        safeRemoveMap(searchMap, '搜索地圖');
        setSearchMap(null);
      }
      setSearchResult(null);
    }
  }, [isTemplateModalVisible, locationMap, locationMarker, searchMap]);

  // 安全清理地圖的函數
  const safeRemoveMap = (map, mapName) => {
    if (map && typeof map.remove === 'function') {
      try {
        // 移除所有事件監聽器
        map.off();
        
        // 移除地圖
        map.remove();
        
        // 清理地圖容器
        const mapContainer = map.getContainer();
        if (mapContainer && mapContainer._leaflet_id) {
          delete mapContainer._leaflet_id;
        }
        
        console.log(`${mapName} 已安全清理`);
      } catch (error) {
        console.warn(`清理 ${mapName} 時出現警告:`, error);
      }
    }
  };

  // 清理地圖資源
  useEffect(() => {
    return () => {
      safeRemoveMap(locationMap, '主地圖');
      safeRemoveMap(searchMap, '搜索地圖');
    };
  }, [locationMap, searchMap]);

  // 表格列寬調整處理
  const handleResize = index => (e, { size }) => {
    const nextColumns = [...resizableColumns];
    nextColumns[index] = { ...nextColumns[index], width: size.width };
    setResizableColumns(nextColumns);
  };

  // 表格變化處理
  const handleTableChange = (pagination, filters, sorter) => {
    if (sorter.field) {
      setSortField(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  // 搜索處理
  const handleSearch = (value) => {
    setSearchText(value);
    setCurrentPage(1);
  };

  // 批量刪除
  const handleBatchDelete = async () => {
    if (selectedTemplates.length === 0) {
      message.warning(t('whatsappTemplate.templatePleaseSelectTemplates'));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      // 將 ID 數組轉換為逗號分隔的字符串
      const templateIdsParam = selectedTemplates.join(',');
      const response = await fetch(`/api/whatsapptemplates/batch-delete?templateIds=${templateIdsParam}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        message.success(`${t('whatsappTemplate.templateSuccessDelete')} ${result.deletedCount} ${t('whatsappTemplate.templateTemplates')}`);
        setSelectedTemplates([]);
        setIsBatchDeleteModalVisible(false);
        fetchTemplates();
      } else {
        message.error(result.error || t('whatsappTemplate.templateDeleteFailed'));
      }
    } catch (error) {
      console.error('批量刪除錯誤:', error);
      message.error(t('whatsappTemplate.templateDeleteFailed'));
    }
  };

  // 單個刪除
  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/whatsapptemplates/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        message.success(t('whatsappTemplate.templateDeleteSuccess'));
        fetchTemplates();
      } else {
        message.error(result.error || t('whatsappTemplate.templateDeleteFailed'));
      }
    } catch (error) {
      console.error('刪除錯誤:', error);
      message.error(t('whatsappTemplate.templateDeleteFailed'));
    }
  };

  // 處理模板類型變化
  const handleTemplateTypeChange = (value) => {
    setTemplateType(value);
    
    // 根據模板類型設置不同的默認值
    if (value === 'Interactive') {
      form.setFieldsValue({
        content: '',
        variables: '',
        buttons: [],
        listOptions: []
      });
      setInteractiveType('button'); // 設置默認的 interactiveType
      setButtons([]); // 重置按鈕狀態
      setListOptions([]); // 重置選項狀態
    } else {
      form.setFieldsValue({
        content: '',
        variables: ''
      });
      setButtons([]); // 重置按鈕狀態
      setListOptions([]); // 重置選項狀態
    }
    
    setVariables([]);
  };

  // 添加變數
  const addVariable = () => {
    const newVariable = {
      name: '',
      type: 'string',
      description: '',
      required: false
    };
    setVariables([...variables, newVariable]);
  };

  // 更新變數
  const updateVariable = (index, field, value) => {
    const newVariables = [...variables];
    newVariables[index][field] = value;
    setVariables(newVariables);
  };

  // 刪除變數
  const removeVariable = (index) => {
    const newVariables = variables.filter((_, i) => i !== index);
    setVariables(newVariables);
  };

  // 生成 JSON 內容
  const generateContent = (values) => {
    switch (values.templateType) {
      case 'Text':
        return {
          type: 'text',
          content: values.content
        };
      case 'Media':
        return {
          type: 'media',
          mediaType: mediaType,
          url: values.mediaUrl,
          caption: values.mediaCaption || ''
        };
      case 'Interactive':
        const interactiveContent = {
          type: 'interactive',
          interactiveType: interactiveType,
          header: values.header || '',
          body: values.body,
          footer: values.footer || ''
        };
        
        // 根據不同的 interactiveType 生成不同的 action 結構
        switch (interactiveType) {
          case 'button':
            // 處理多個按鈕
            const buttons = [];
            if (values.buttons && values.buttons.length > 0) {
              values.buttons.forEach((button, index) => {
                if (button.text && button.value) {
                  // Button 類型只支持 reply 類型的按鈕
                  // WhatsApp Business API 的 Button 類型不支持 url 和 phone_number
                  buttons.push({
                    type: 'reply',
                    reply: {
                      id: button.value || String(index + 1),
                      title: button.text
                    }
                  });
                }
              });
            }
            
            interactiveContent.action = {
              buttons: buttons
            };
            break;
            
          case 'list':
            // 處理列表選項
            const options = [];
            if (values.listOptions && values.listOptions.length > 0) {
              values.listOptions.forEach(option => {
                if (option.id && option.title) {
                  options.push({
                    id: option.id,
                    title: option.title,
                    description: option.description || ''
                  });
                }
              });
            }
            
            interactiveContent.action = {
              button: values.listTitle || '選擇選項',
              sections: [{
                title: values.listTitle || '選項列表',
                rows: options
              }]
            };
            break;
            
          case 'product':
            interactiveContent.action = {
              catalog_id: values.productCatalogId,
              product_retailer_id: values.productId
            };
            break;
            
          default:
            interactiveContent.action = {};
        }
        
        return interactiveContent;
      case 'Location':
        return {
          type: 'location',
          latitude: values.latitude,
          longitude: values.longitude,
          name: values.locationName,
          address: values.locationAddress
        };
      case 'Contact':
        return {
          type: 'contact',
          name: values.contactName,
          phone: values.contactPhone,
          email: values.contactEmail || ''
        };
      default:
        return { type: 'text', content: values.content };
    }
  };

  // 生成變數 JSON
  const generateVariables = () => {
    return variables.map(v => ({
      name: v.name,
      type: v.type,
      description: v.description,
      required: v.required
    }));
  };

  // 修改保存模板函數
  const handleSaveTemplate = async (values) => {
    try {
      const content = generateContent(values);
      const variablesJson = generateVariables();
      
      if (editingTemplate) {
        // 編輯模式 - 使用 WhatsAppTemplateUpdateRequest 結構
        const templateData = {
          name: values.name,
          description: values.description || '',
          category: values.category || 'General',
          templateType: values.templateType || 'Text',
          content: JSON.stringify(content),
          variables: JSON.stringify(variablesJson),
          status: values.status || 'Active',
          language: values.language || 'zh-TW'
        };
        
        console.log('發送更新模板數據:', templateData);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/whatsapptemplates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(templateData)
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
          message.success(t('whatsappTemplate.templateUpdateSuccess'));
          setIsTemplateModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
          setVariables([]);
          setPendingTemplateData(null);
          fetchTemplates();
        } else {
          console.error('更新失敗:', result);
          message.error(result.message || result.error || t('whatsappTemplate.templateUpdateFailed'));
        }
      } else {
        // 創建模式 - 使用 WhatsAppTemplateCreateRequest 結構
        const templateData = {
          name: values.name,
          description: values.description || '',
          category: values.category || 'General',
          templateType: values.templateType || 'Text',
          content: JSON.stringify(content),
          variables: JSON.stringify(variablesJson),
          status: values.status || 'Active',
          language: values.language || 'zh-TW'
        };
        
        console.log('發送創建模板數據:', templateData);
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/whatsapptemplates', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(templateData)
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
          message.success(t('whatsappTemplate.templateCreateSuccess'));
          setIsTemplateModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
          setVariables([]);
          setPendingTemplateData(null);
          fetchTemplates();
        } else {
          console.error('創建失敗:', result);
          message.error(result.message || result.error || t('whatsappTemplate.templateCreateFailed'));
        }
      }
    } catch (error) {
      console.error('保存模板錯誤:', error);
      message.error(t('whatsappTemplate.templateSaveFailed'));
    }
  };

  // 預覽模板
  const handlePreview = async (template) => {
    setPreviewTemplate(template);
    setIsPreviewModalVisible(true);
  };

  // 處理編輯模板數據設置
  const handleEditTemplate = (template) => {
    console.log('編輯模板原始數據:', template);
    console.log('模板 content 字段:', template.content);
    console.log('模板 variables 字段:', template.variables);
    
    setEditingTemplate(template);
    setTemplateType(template.templateType);
    
    // 重置地圖狀態，這樣新的地圖就能正確顯示已有的位置
    if (locationMap) {
      safeRemoveMap(locationMap, '主地圖');
      setLocationMap(null);
    }
    if (locationMarker) {
      setLocationMarker(null);
    }
    setIsMapInitializing(false);
    
    try {
      // 檢查 content 是否存在且不為空
      const content = template.content && template.content !== 'undefined' 
        ? JSON.parse(template.content) 
        : { type: 'text', content: '' };
      
      console.log('解析後的 content:', content);
      
      // 檢查 variables 是否存在且不為空
      const variables = template.variables && template.variables !== 'undefined' && template.variables !== 'null'
        ? JSON.parse(template.variables) 
        : [];
      
      console.log('解析後的 variables:', variables);
      
      setVariables(variables);
      
      // 設置待處理的模板數據
      const pendingData = {
        name: template.name,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        content: content.content || content.body || '',
        mediaUrl: content.url || '',
        mediaCaption: content.caption || '',
        header: content.header || '',
        body: content.body || content.content || '',
        footer: content.footer || '',
        latitude: content.latitude || '',
        longitude: content.longitude || '',
        locationName: content.name || '',
        locationAddress: content.address || '',
        contactName: content.name || '',
        contactPhone: content.phone || '',
        contactEmail: content.email || '',
        status: template.status,
        language: template.language
      };
      
      // 新增：為 Interactive 類型設置 interactiveType 和相關字段
      if (template.templateType === 'Interactive' && content.interactiveType) {
        pendingData.interactiveType = content.interactiveType;
        setInteractiveType(content.interactiveType); // 同步狀態變量
        
        // 根據不同的 interactiveType 恢復對應的字段
        switch (content.interactiveType) {
          case 'button':
            if (content.action && content.action.buttons && content.action.buttons.length > 0) {
              const buttons = content.action.buttons.map(button => {
                let buttonData = { text: '', type: 'quick_reply', value: '' };
                
                if (button.type === 'reply' && button.reply) {
                  buttonData = {
                    text: button.reply.title || '',
                    type: 'quick_reply',
                    value: button.reply.id || ''
                  };
                } else if (button.type === 'url') {
                  buttonData = {
                    text: button.url || '',
                    type: 'url',
                    value: button.url || ''
                  };
                } else if (button.type === 'phone_number') {
                  buttonData = {
                    text: button.phone_number || '',
                    type: 'phone_number',
                    value: button.phone_number || ''
                  };
                }
                
                return buttonData;
              });
              
              pendingData.buttons = buttons;
              setButtons(buttons); // 設置按鈕狀態
            }
            break;
            
          case 'list':
            if (content.action && content.action.sections && content.action.sections.length > 0) {
              const section = content.action.sections[0];
              pendingData.listTitle = section.title || '';
              
              // 將選項轉換為對象數組格式
              if (section.rows && section.rows.length > 0) {
                const options = section.rows.map(row => ({
                  id: row.id || '',
                  title: row.title || '',
                  description: row.description || ''
                }));
                pendingData.listOptions = options;
                setListOptions(options); // 設置選項狀態
              }
            }
            break;
            
          case 'product':
            if (content.action) {
              pendingData.productId = content.action.product_retailer_id || '';
              pendingData.productCatalogId = content.action.catalog_id || '';
              // 產品圖片URL可能需要從其他地方獲取
            }
            break;
        }
      }
      
      // 新增：為 Media 類型設置 mediaType
      if (template.templateType === 'Media' && content.mediaType) {
        pendingData.mediaType = content.mediaType;
        setMediaType(content.mediaType); // 同步狀態變量
      }
      
      console.log('設置的 pendingTemplateData:', pendingData);
      setPendingTemplateData(pendingData);
    } catch (error) {
      console.error('解析模板內容錯誤:', error);
      console.log('模板數據:', template);
      message.error(t('whatsappTemplate.templateParseContentFailed'));
      
      // 設置默認值
      setVariables([]);
      setPendingTemplateData({
        name: template.name,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        content: '',
        mediaUrl: '',
        mediaCaption: '',
        header: '',
        body: '',
        footer: '',
        latitude: '',
        longitude: '',
        locationName: '',
        locationAddress: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        status: template.status,
        language: template.language
      });
    }
    
    setIsTemplateModalVisible(true);
  };

  // 處理複製模板 - 直接複製並保存
  const handleCopyTemplate = async (template) => {
    try {
      // 顯示複製中提示
      message.loading(t('whatsappTemplate.templateCopying'), 0);
      
      // 解析模板內容
      let content, variables;
      try {
        content = template.content && template.content !== 'undefined' 
          ? JSON.parse(template.content) 
          : { type: 'text', content: '' };
        
        variables = template.variables && template.variables !== 'undefined' && template.variables !== 'null'
          ? JSON.parse(template.variables) 
          : [];
      } catch (error) {
        console.error('解析模板內容錯誤:', error);
        // 設置默認值
        content = { type: 'text', content: '' };
        variables = [];
      }
      
      // 準備複製的模板數據
      const templateData = {
        name: `${template.name} (複製)`,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        content: JSON.stringify(content),
        variables: JSON.stringify(variables),
        status: template.status,
        language: template.language
      };
      
      console.log('發送複製模板數據:', templateData);
      
      // 發送創建請求
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(templateData)
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        message.destroy(); // 關閉複製中提示
        message.success(t('whatsappTemplate.templateCopySuccess'));
        // 重新獲取模板列表
        fetchTemplates();
      } else {
        message.destroy(); // 關閉複製中提示
        console.error('複製失敗:', result);
        message.error(result.message || result.error || t('whatsappTemplate.templateCopyFailed'));
      }
    } catch (error) {
      message.destroy(); // 關閉複製中提示
      console.error('複製模板錯誤:', error);
      message.error(t('whatsappTemplate.templateCopyFailed'));
    }
  };

  // 當待處理數據存在時，設置表單值
  useEffect(() => {
    console.log('useEffect 觸發:', { pendingTemplateData, isTemplateModalVisible });
    if (pendingTemplateData && isTemplateModalVisible) {
      console.log('設置表單值:', pendingTemplateData);
      form.setFieldsValue(pendingTemplateData);
      setPendingTemplateData(null);
    }
  }, [pendingTemplateData, isTemplateModalVisible, form]);

  // 表格選擇配置
  const rowSelection = {
    selectedRowKeys: selectedTemplates,
    onChange: (selectedRowKeys) => {
      setSelectedTemplates(selectedRowKeys);
    }
  };

  // 基礎表格列定義
  const baseColumns = [
    {
      title: t('whatsappTemplate.templateName'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      sorter: true,
      render: (text, record) => (
    <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.description}</div>
        </div>
      )
    },
    {
      title: t('whatsappTemplate.category'),
      dataIndex: 'category',
      key: 'category',
      width: 120,
      sorter: true,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: t('whatsappTemplate.type'),
      dataIndex: 'templateType',
      key: 'templateType',
      width: 120,
      render: (text) => {
        const typeColors = {
          'Text': 'green',
          'Media': 'orange',
          'Interactive': 'purple',
          'Location': 'cyan',
          'Contact': 'geekblue'
        };
        const typeIcons = {
          'Text': <MessageOutlined />,
          'Media': <PictureOutlined />,
          'Interactive': <LinkOutlined />,
          'Location': <EnvironmentOutlined />,
          'Contact': <UserOutlined />
        };
        return (
          <Tag color={typeColors[text] || 'default'} icon={typeIcons[text]}>
            {text}
          </Tag>
        );
      }
    },
    {
      title: t('whatsappTemplate.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: true,
      render: (text) => {
        const statusColors = {
          'Active': 'green',
          'Inactive': 'red',
          'Draft': 'orange'
        };
        return <Badge status={statusColors[text] || 'default'} text={text} />;
      }
    },
    {
      title: t('whatsappTemplate.templateLanguage'),
      dataIndex: 'language',
      key: 'language',
      width: 100,
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: t('whatsappTemplate.templateVersion'),
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (text) => <Tag color="geekblue">v{text}</Tag>
    },
    {
      title: t('whatsappTemplate.updatedAt'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      sorter: true,
      render: (text) => new Date(text).toLocaleString('zh-TW')
    },
    {
      title: t('whatsappTemplate.action'),
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('whatsappTemplate.preview')}>
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title={t('whatsappTemplate.edit')}>
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEditTemplate(record)}
            />
          </Tooltip>
          <Tooltip title={t('whatsappTemplate.copy')}>
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => handleCopyTemplate(record)}
            />
          </Tooltip>
            <Popconfirm
              title={t('whatsappTemplate.templateDeleteConfirmLocal')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('whatsappTemplate.confirm')}
              cancelText={t('whatsappTemplate.cancel')}
            >
              <Tooltip title={t('whatsappTemplate.delete')}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
        </Space>
      )
    }
  ];

  // 初始化可調整列寬的列配置
  useEffect(() => {
    if (resizableColumns.length === 0) {
      setResizableColumns(
        baseColumns.map(col => ({ ...col, width: col.width ? parseInt(col.width) : 120 }))
      );
    }
  }, [baseColumns, resizableColumns.length]);

  // 合併列配置，添加調整功能
  const mergedColumns = resizableColumns.map((col, index) => ({
    ...col,
    onHeaderCell: column => ({
      width: col.width,
      onResize: handleResize(index),
    }),
  }));

  // 表格組件配置
  const components = {
    header: {
      cell: ResizableTitle,
    },
  };

  // 渲染動態表單內容
  const renderTemplateForm = () => {
    const currentTemplateType = templateType;
    
    switch (currentTemplateType) {
      case 'Text':
        return (
          <Form.Item
            name="content"
            label={t('whatsappTemplate.messageContent')}
            rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterMessageContent') }]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder={t('whatsappTemplate.pleaseEnterMessageContentWithVariables')}
            />
          </Form.Item>
        );

      case 'Media':
        return (
          <>
            <Form.Item
              name="mediaType"
              label={t('whatsappTemplate.mediaType')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseSelectMediaType') }]}
            >
              <Radio.Group 
                onChange={(e) => {
                  setMediaType(e.target.value);
                  form.setFieldsValue({ mediaType: e.target.value });
                }} 
                value={mediaType}
              >
                <Radio.Button value="image"><PictureOutlined /> {t('whatsappTemplate.image')}</Radio.Button>
                <Radio.Button value="video"><VideoCameraOutlined /> {t('whatsappTemplate.video')}</Radio.Button>
                <Radio.Button value="audio"><AudioOutlined /> {t('whatsappTemplate.audio')}</Radio.Button>
                <Radio.Button value="document"><FileOutlined /> {t('whatsappTemplate.document')}</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              name="mediaUrl"
              label={t('whatsappTemplate.mediaFileUrl')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterMediaFileUrl') }]}
            >
              <Input placeholder={t('whatsappTemplate.pleaseEnterMediaFileUrl')} />
            </Form.Item>
            
            <Form.Item
              name="mediaCaption"
              label={t('whatsappTemplate.mediaCaption')}
            >
              <Input.TextArea 
                rows={3} 
                placeholder={t('whatsappTemplate.pleaseEnterMediaCaption')}
              />
            </Form.Item>
          </>
        );

      case 'Interactive':
        return (
          <>
            <Form.Item
              name="interactiveType"
              label={t('whatsappTemplate.interactiveType')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseSelectInteractiveType') }]}
            >
              <Radio.Group 
                onChange={(e) => {
                  setInteractiveType(e.target.value);
                  form.setFieldsValue({ interactiveType: e.target.value });
                }} 
                value={interactiveType}
              >
                <Radio.Button value="button">{t('whatsappTemplate.button')}</Radio.Button>
                <Radio.Button value="list">{t('whatsappTemplate.list')}</Radio.Button>
                <Radio.Button value="product">{t('whatsappTemplate.product')}</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              name="header"
              label={t('whatsappTemplate.header')}
            >
              <Input placeholder={t('whatsappTemplate.pleaseEnterHeader')} />
            </Form.Item>
            
            <Form.Item
              name="body"
              label={t('whatsappTemplate.mainContent')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterMainContent') }]}
            >
              <Input.TextArea 
                rows={4} 
                placeholder={t('whatsappTemplate.pleaseEnterMainContent')}
              />
            </Form.Item>
            
            <Form.Item
              name="footer"
              label={t('whatsappTemplate.footer')}
            >
              <Input placeholder={t('whatsappTemplate.pleaseEnterFooter')} />
            </Form.Item>
            
            {/* Button 類型的按鈕配置 */}
            {interactiveType === 'button' && (
              <>
                <Divider orientation="left">按鈕配置</Divider>
                <div style={{ marginBottom: 16 }}>
                  <Button 
                    type="dashed" 
                    onClick={() => {
                      if (buttons.length < 3) {
                        const newButtons = [...buttons, { text: '', type: 'quick_reply', value: '' }];
                        setButtons(newButtons);
                        form.setFieldsValue({ buttons: newButtons });
                      } else {
                        message.warning('最多只能添加 3 個按鈕');
                      }
                    }}
                    icon={<PlusOutlined />}
                    disabled={buttons.length >= 3}
                  >
                    添加按鈕
                  </Button>
                  <span style={{ marginLeft: 8, fontSize: '12px', color: '#666' }}>
                    最多 3 個按鈕
                  </span>
                </div>
                
                {buttons.map((button, index) => (
                  <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          name={['buttons', index, 'text']}
                          label={`按鈕 ${index + 1} 文字`}
                          rules={[{ required: true, message: '請輸入按鈕文字' }]}
                        >
                          <Input 
                            placeholder="請輸入按鈕文字"
                            value={button.text}
                            onChange={(e) => {
                              const newButtons = [...buttons];
                              newButtons[index].text = e.target.value;
                              setButtons(newButtons);
                              form.setFieldsValue({ buttons: newButtons });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={['buttons', index, 'type']}
                          label="按鈕類型"
                          rules={[{ required: true, message: '請選擇按鈕類型' }]}
                        >
                          <Select 
                            placeholder="請選擇按鈕類型"
                            value={button.type}
                            onChange={(value) => {
                              const newButtons = [...buttons];
                              newButtons[index].type = value;
                              setButtons(newButtons);
                              form.setFieldsValue({ buttons: newButtons });
                            }}
                          >
                            <Option value="quick_reply">快速回覆</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          name={['buttons', index, 'value']}
                          label="回覆ID"
                          rules={[{ required: true, message: '請輸入回覆ID' }]}
                        >
                          <Input 
                            placeholder="回覆ID（用於識別用戶選擇）"
                            value={button.value}
                            onChange={(e) => {
                              const newButtons = [...buttons];
                              newButtons[index].value = e.target.value;
                              setButtons(newButtons);
                              form.setFieldsValue({ buttons: newButtons });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const newButtons = buttons.filter((_, i) => i !== index);
                            setButtons(newButtons);
                            form.setFieldsValue({ buttons: newButtons });
                          }}
                        />
                      </Col>
                    </Row>
                  </Card>
                ))}
              </>
            )}
            
            {/* List 類型的選項配置 */}
            {interactiveType === 'list' && (
              <>
                <Divider orientation="left">列表選項配置</Divider>
                <Form.Item
                  name="listTitle"
                  label="列表標題"
                  rules={[{ required: true, message: '請輸入列表標題' }]}
                >
                  <Input placeholder="請輸入列表標題" />
                </Form.Item>
                
                <div style={{ marginBottom: 16 }}>
                  <Button 
                    type="dashed" 
                    onClick={() => {
                      if (listOptions.length < 10) {
                        const newOptions = [...listOptions, { id: '', title: '', description: '' }];
                        setListOptions(newOptions);
                        form.setFieldsValue({ listOptions: newOptions });
                      } else {
                        message.warning('最多只能添加 10 個選項');
                      }
                    }}
                    icon={<PlusOutlined />}
                    disabled={listOptions.length >= 10}
                  >
                    添加選項
                  </Button>
                  <span style={{ marginLeft: 8, fontSize: '12px', color: '#666' }}>
                    最多 10 個選項
                  </span>
                </div>
                
                {listOptions.map((option, index) => (
                  <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                    <Row gutter={16}>
                      <Col span={6}>
                        <Form.Item
                          name={['listOptions', index, 'id']}
                          label={`選項 ${index + 1} ID`}
                          rules={[{ required: true, message: '請輸入選項ID' }]}
                        >
                          <Input 
                            placeholder="選項ID"
                            value={option.id}
                            onChange={(e) => {
                              const newOptions = [...listOptions];
                              newOptions[index].id = e.target.value;
                              setListOptions(newOptions);
                              form.setFieldsValue({ listOptions: newOptions });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={['listOptions', index, 'title']}
                          label="選項標題"
                          rules={[{ required: true, message: '請輸入選項標題' }]}
                        >
                          <Input 
                            placeholder="選項標題"
                            value={option.title}
                            onChange={(e) => {
                              const newOptions = [...listOptions];
                              newOptions[index].title = e.target.value;
                              setListOptions(newOptions);
                              form.setFieldsValue({ listOptions: newOptions });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          name={['listOptions', index, 'description']}
                          label="選項描述"
                        >
                          <Input 
                            placeholder="選項描述（可選）"
                            value={option.description}
                            onChange={(e) => {
                              const newOptions = [...listOptions];
                              newOptions[index].description = e.target.value;
                              setListOptions(newOptions);
                              form.setFieldsValue({ listOptions: newOptions });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const newOptions = listOptions.filter((_, i) => i !== index);
                            setListOptions(newOptions);
                            form.setFieldsValue({ listOptions: newOptions });
                          }}
                        />
                      </Col>
                    </Row>
                  </Card>
                ))}
              </>
            )}
            
            {/* Product 類型的產品配置 */}
            {interactiveType === 'product' && (
              <>
                <Divider orientation="left">產品配置</Divider>
                <Form.Item
                  name="productId"
                  label="產品ID"
                  rules={[{ required: true, message: '請輸入產品ID' }]}
                >
                  <Input placeholder="請輸入產品ID" />
                </Form.Item>
                
                <Form.Item
                  name="productCatalogId"
                  label="產品目錄ID"
                  rules={[{ required: true, message: '請輸入產品目錄ID' }]}
                >
                  <Input placeholder="請輸入Facebook產品目錄ID" />
                </Form.Item>
                
                <Form.Item
                  name="productImageUrl"
                  label="產品圖片URL"
                >
                  <Input placeholder="請輸入產品圖片URL" />
                </Form.Item>
              </>
            )}
          </>
        );

      case 'Location':
        return (
          <>
                      <Form.Item
            label={t('whatsappTemplate.mapSelection')}
            help={t('whatsappTemplate.searchAddressOrDragMarker')}
          >
            {/* 地址搜索輸入框 */}
            <div style={{ marginBottom: 16 }}>
              <Input.Search
                placeholder={t('whatsappTemplate.enterAddressToSearch')}
                enterButton={t('whatsappTemplate.search')}
                onSearch={handleAddressSearch}
                style={{ width: '100%' }}
              />
            </div>
              
              {/* 地圖容器 */}
              <div 
                ref={locationMapRef}
                id="locationMap" 
                style={{ 
                  height: '400px', 
                  width: '100%', 
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  marginBottom: '16px'
                }} 
              />
              
              {/* 操作按鈕 */}
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Button 
                    type="primary" 
                    icon={<EnvironmentOutlined />}
                    onClick={handleGetCurrentLocation}
                    loading={locationLoading}
                  >
                    {t('whatsappTemplate.getCurrentLocation')}
                  </Button>
                  <Button 
                    icon={<SearchOutlined />}
                    onClick={() => setShowLocationSearch(true)}
                  >
                    {t('whatsappTemplate.advancedSearch')}
                  </Button>
                </Space>
              </div>
            </Form.Item>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="latitude"
                  label={t('whatsappTemplate.latitude')}
                  rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterLatitude') }]}
                >
                  <Input placeholder={t('whatsappTemplate.pleaseEnterLatitude')} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="longitude"
                  label={t('whatsappTemplate.longitude')}
                  rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterLongitude') }]}
                >
                  <Input placeholder={t('whatsappTemplate.pleaseEnterLongitude')} />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item
              name="locationName"
              label={t('whatsappTemplate.locationName')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterLocationName') }]}
            >
              <Input placeholder={t('whatsappTemplate.pleaseEnterLocationName')} />
            </Form.Item>
            
            <Form.Item
              name="locationAddress"
              label={t('whatsappTemplate.address')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterAddress') }]}
            >
              <Input.TextArea 
                rows={3} 
                placeholder={t('whatsappTemplate.pleaseEnterCompleteAddress')}
              />
            </Form.Item>
          </>
        );

      case 'Contact':
        return (
          <>
            <Form.Item
              name="contactName"
              label={t('whatsappTemplate.contactName')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterContactName') }]}
            >
              <Input placeholder={t('whatsappTemplate.pleaseEnterContactName')} />
            </Form.Item>
            
            <Form.Item
              name="contactPhone"
              label={t('whatsappTemplate.contactPhone')}
              rules={[{ required: true, message: t('whatsappTemplate.pleaseEnterContactPhone') }]}
            >
              <Input placeholder={t('whatsappTemplate.pleaseEnterContactPhone')} />
            </Form.Item>
            
            <Form.Item
              name="contactEmail"
              label={t('whatsappTemplate.contactEmail')}
            >
              <Input placeholder={t('whatsappTemplate.pleaseEnterContactEmail')} />
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  // 渲染變數設定
  const renderVariablesSection = () => {
    return (
      <>
        <Divider orientation="left">{t('whatsappTemplate.variables')}</Divider>
        
        {variables.map((variable, index) => (
          <Card key={index} size="small" style={{ marginBottom: '8px' }}>
            <Row gutter={16}>
              <Col span={6}>
                <Input
                  placeholder={t('whatsappTemplate.variableName')}
                  value={variable.name}
                  onChange={(e) => updateVariable(index, 'name', e.target.value)}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder={t('whatsappTemplate.type')}
                  value={variable.type}
                  onChange={(value) => updateVariable(index, 'type', value)}
                >
                  <Option value="string">{t('whatsappTemplate.text')}</Option>
                  <Option value="number">{t('whatsappTemplate.number')}</Option>
                  <Option value="date">{t('whatsappTemplate.date')}</Option>
                </Select>
              </Col>
              <Col span={8}>
                <Input
                  placeholder={t('whatsappTemplate.description')}
                  value={variable.description}
                  onChange={(e) => updateVariable(index, 'description', e.target.value)}
                />
              </Col>
              <Col span={4}>
                <Checkbox
                  checked={variable.required}
                  onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                >
                  {t('whatsappTemplate.required')}
                </Checkbox>
              </Col>
              <Col span={2}>
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={() => removeVariable(index)}
                />
              </Col>
            </Row>
          </Card>
        ))}
        
        <Button 
          type="dashed" 
          onClick={addVariable}
          icon={<PlusOutlined />}
          style={{ width: '100%' }}
        >
          {t('whatsappTemplate.addVariable')}
        </Button>
      </>
    );
  };

  return (
    <div>
      {/* 操作按鈕 */}
      <div style={{ marginBottom: '16px' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingTemplate(null);
              form.resetFields();
              setTemplateType('Text');
              setVariables([]);
              setPendingTemplateData(null);
              setIsTemplateModalVisible(true);
            }}
          >
            {t('whatsappTemplate.add')}
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={selectedTemplates.length === 0}
            onClick={() => setIsBatchDeleteModalVisible(true)}
          >
            {t('eform.batchDelete')} ({selectedTemplates.length})
          </Button>
        </Space>
      </div>

      {/* 搜索和篩選 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space wrap>
          <Input.Search
            placeholder={t('whatsappTemplate.searchPlaceholder')}
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            onPressEnter={(e) => handleSearch(e.target.value)}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder={t('whatsappTemplate.categorySelect')}
            allowClear
            style={{ width: 150 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
          >
            {categories.map(category => (
              <Option key={category} value={category}>{category}</Option>
            ))}
          </Select>
          <Select
            placeholder={t('whatsappTemplate.statusSelect')}
            allowClear
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Option value="Active">{t('whatsappTemplate.enabled')}</Option>
            <Option value="Inactive">{t('whatsappTemplate.disabled')}</Option>
            <Option value="Draft">{t('whatsappTemplate.draft')}</Option>
          </Select>
          <Button
            onClick={() => {
              setSearchText('');
              setCategoryFilter('');
              setStatusFilter('');
              setCurrentPage(1);
            }}
          >
            {t('eform.clearFilter')}
          </Button>
        </Space>
      </Card>

      {/* 模板列表表格 */}
      <Table
        components={components}
        columns={mergedColumns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        style={{ width: '100%' }}
        onChange={handleTableChange}
        rowSelection={rowSelection}
        scroll={{ x: 1200 }}
      />
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Pagination
          current={currentPage || 1}
          pageSize={pageSize || 10}
          total={total || 0}
          showSizeChanger
          pageSizeOptions={['10', '20', '50', '100']}
          showTotal={(total, range) => `${t('eform.pageRange')}${range[0]}-${range[1]}${t('eform.total')}${total}`}
          onChange={(page, pageSize) => {
            setCurrentPage(page);
            setPageSize(pageSize);
            fetchTemplates();
          }}
          onShowSizeChange={(current, size) => {
            setCurrentPage(1);
            setPageSize(size);
            fetchTemplates();
          }}
        />
      </div>

      {/* 批量刪除確認 Modal */}
      <Modal
        title={t('whatsappTemplate.batchDeleteTitle')}
        open={isBatchDeleteModalVisible}
        onOk={handleBatchDelete}
        onCancel={() => setIsBatchDeleteModalVisible(false)}
        okText={t('whatsappTemplate.confirmDelete')}
        cancelText={t('whatsappTemplate.cancel')}
        okButtonProps={{ danger: true }}
      >
        <p>{t('whatsappTemplate.templateConfirmDeleteSelected')} {selectedTemplates.length} {t('whatsappTemplate.templateConfirmDeleteSelectedSuffix')}</p>
      </Modal>

      {/* 模板編輯 Modal */}
      <Drawer
        title={editingTemplate ? t('whatsappTemplate.editTitle') : t('whatsappTemplate.addTitle')}
        open={isTemplateModalVisible}
        onClose={() => {
          setIsTemplateModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
          setVariables([]);
          setPendingTemplateData(null);
          setButtons([]); // 重置按鈕狀態
          setListOptions([]); // 重置選項狀態
          
          // 清理地圖資源
          if (locationMap) {
            safeRemoveMap(locationMap, '主地圖');
            setLocationMap(null);
          }
          if (locationMarker) {
            setLocationMarker(null);
          }
          setIsMapInitializing(false);
        }}
        width={800}
        extra={
          <Space>
            <Button onClick={() => {
              setIsTemplateModalVisible(false);
              setEditingTemplate(null);
              form.resetFields();
              setVariables([]);
              setPendingTemplateData(null);
              setButtons([]); // 重置按鈕狀態
              setListOptions([]); // 重置選項狀態
            }}>
              {t('whatsappTemplate.cancel')}
            </Button>
            <Button type="primary" onClick={() => formRef.current?.submit()}>
              {t('whatsappTemplate.save')}
            </Button>
          </Space>
        }
      >
        <Form
          ref={formRef}
          form={form}
          layout="vertical"
          onFinish={handleSaveTemplate}
        >
          <Form.Item
            name="name"
            label={t('whatsappTemplate.name')}
            rules={[{ required: true, message: t('whatsappTemplate.nameRequired') }]}
          >
            <Input placeholder={t('whatsappTemplate.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('whatsappTemplate.description')}
          >
            <Input.TextArea rows={3} placeholder={t('whatsappTemplate.descriptionPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="category"
            label={t('whatsappTemplate.category')}
            rules={[{ required: true, message: t('whatsappTemplate.categoryRequired') }]}
          >
            <Select placeholder={t('whatsappTemplate.categoryPlaceholder')}>
              <Option value="Welcome">{t('whatsappTemplate.welcome')}</Option>
              <Option value="Order">{t('whatsappTemplate.order')}</Option>
              <Option value="Marketing">{t('whatsappTemplate.marketing')}</Option>
              <Option value="Support">{t('whatsappTemplate.support')}</Option>
              <Option value="General">{t('whatsappTemplate.general')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="templateType"
            label={t('whatsappTemplate.type')}
            rules={[{ required: true, message: t('whatsappTemplate.typeRequired') }]}
          >
            <Select 
              placeholder={t('whatsappTemplate.typePlaceholder')}
              onChange={handleTemplateTypeChange}
            >
              <Option value="Text">
                <Space><MessageOutlined /> {t('whatsappTemplate.text')}</Space>
              </Option>
              <Option value="Media">
                <Space><PictureOutlined /> {t('whatsappTemplate.media')}</Space>
              </Option>
              <Option value="Interactive">
                <Space><LinkOutlined /> {t('whatsappTemplate.interactive')}</Space>
              </Option>
              <Option value="Location">
                <Space><EnvironmentOutlined /> {t('whatsappTemplate.location')}</Space>
              </Option>
              <Option value="Contact">
                <Space><UserOutlined /> {t('whatsappTemplate.contact')}</Space>
              </Option>
            </Select>
          </Form.Item>

          {/* 動態表單內容 */}
          {renderTemplateForm()}

          {/* 變數設定 */}
          {renderVariablesSection()}

          <Form.Item
            name="status"
            label={t('whatsappTemplate.status')}
            rules={[{ required: true, message: t('whatsappTemplate.statusRequired') }]}
          >
            <Select placeholder={t('whatsappTemplate.statusPlaceholder')}>
              <Option value="Active">{t('whatsappTemplate.enabled')}</Option>
              <Option value="Inactive">{t('whatsappTemplate.disabled')}</Option>
              <Option value="Draft">{t('whatsappTemplate.draft')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="language"
            label={t('whatsappTemplate.language')}
            rules={[{ required: true, message: t('whatsappTemplate.languageRequired') }]}
          >
            <Select placeholder={t('whatsappTemplate.languagePlaceholder')}>
              <Option value="zh-TW">{t('whatsappTemplate.traditionalChinese')}</Option>
              <Option value="zh-CN">{t('whatsappTemplate.simplifiedChinese')}</Option>
              <Option value="en-US">{t('whatsappTemplate.english')}</Option>
            </Select>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 地址搜索 Modal */}
      <Modal
        title={t('whatsappTemplate.searchAddress')}
        open={showLocationSearch}
        onCancel={() => setShowLocationSearch(false)}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder={t('whatsappTemplate.enterAddressToSearch')}
            enterButton={t('whatsappTemplate.search')}
            onSearch={handleAddressSearch}
            style={{ width: '100%' }}
          />
    </div>
        
        <div 
          ref={searchMapRef}
          id="searchMap" 
          style={{ height: '300px', width: '100%', border: '1px solid #d9d9d9' }} 
        />
        
        <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
            onClick={handleSelectSearchResult}
            disabled={!searchResult}
            style={{ width: '100%' }}
          >
            {t('whatsappTemplate.selectThisLocation')}
                </Button>
        </div>
      </Modal>

      {/* 模板預覽 Modal */}
      <Modal
        title={t('whatsappTemplate.preview')}
        open={isPreviewModalVisible}
        onCancel={() => setIsPreviewModalVisible(false)}
        footer={null}
        width={600}
      >
        {previewTemplate && (
          <div>
            <Card title={t('whatsappTemplate.basicInfo')} style={{ marginBottom: '16px' }}>
              <p><strong>{t('whatsappTemplate.name')}:</strong>{previewTemplate.name}</p>
              <p><strong>{t('whatsappTemplate.description')}:</strong>{previewTemplate.description}</p>
              <p><strong>{t('whatsappTemplate.category')}:</strong><Tag color="blue">{previewTemplate.category}</Tag></p>
              <p><strong>{t('whatsappTemplate.type')}:</strong><Tag color="green">{previewTemplate.templateType}</Tag></p>
              <p><strong>{t('whatsappTemplate.status')}:</strong><Badge status="success" text={previewTemplate.status} /></p>
            </Card>
            
            <Card title={t('whatsappTemplate.content')} style={{ marginBottom: '16px' }}>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '4px',
                fontSize: '12px',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {previewTemplate.content}
              </pre>
            </Card>
            
            {previewTemplate.variables && (
              <Card title={t('whatsappTemplate.variableDefinition')}>
                <pre style={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: '12px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {previewTemplate.variables}
                </pre>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InternalTemplatePanel;