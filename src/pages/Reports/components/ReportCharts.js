/**
 * 報表圖表組件
 * 提供各種常用的圖表類型
 */

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card } from 'antd';

/**
 * 餅圖組件
 */
export const PieChart = ({ title, data, height = 300, colors }) => {
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: data,
        color: colors
      }
    ]
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 柱狀圖組件
 */
export const BarChart = ({ title, xAxisData, seriesData, height = 300, colors, horizontal = false }) => {
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: horizontal ? '15%' : '3%',
      right: '4%',
      bottom: horizontal ? '3%' : '10%',
      top: '15%',
      containLabel: true
    },
    xAxis: horizontal ? {
      type: 'value'
    } : {
      type: 'category',
      data: xAxisData,
      axisLabel: { rotate: 45 }
    },
    yAxis: horizontal ? {
      type: 'category',
      data: xAxisData,
      axisLabel: { 
        formatter: (value) => {
          // 如果名稱太長，截斷並顯示省略號
          if (value.length > 15) {
            return value.substring(0, 15) + '...';
          }
          return value;
        }
      }
    } : {
      type: 'value'
    },
    series: seriesData.map((series, index) => ({
      ...series,
      type: 'bar',
      itemStyle: {
        color: colors ? colors[index % colors.length] : undefined,
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
      }
    }))
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 折線圖組件
 */
export const LineChart = ({ title, xAxisData, seriesData, height = 300, colors, dualYAxis = false, yAxisName = [] }) => {
  const yAxisConfig = dualYAxis ? [
    {
      type: 'value',
      name: yAxisName[0] || '',
      position: 'left',
      axisLabel: { formatter: '{value}' }
    },
    {
      type: 'value',
      name: yAxisName[1] || '',
      position: 'right',
      axisLabel: { formatter: '{value}%' }
    }
  ] : {
    type: 'value'
  };

  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: seriesData.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: dualYAxis ? '8%' : '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData
    },
    yAxis: yAxisConfig,
    series: seriesData.map((series, index) => ({
      ...series,
      type: 'line',
      smooth: true,
      yAxisIndex: dualYAxis && series.yAxisIndex !== undefined ? series.yAxisIndex : 0,
      lineStyle: {
        color: colors ? colors[index % colors.length] : undefined,
        width: 2
      },
      areaStyle: {
        color: colors ? {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: colors[index % colors.length] + '80' },
            { offset: 1, color: colors[index % colors.length] + '10' }
          ]
        } : undefined
      }
    }))
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 堆疊柱狀圖組件
 */
export const StackedBarChart = ({ title, xAxisData, seriesData, height = 300, colors }) => {
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: seriesData.map(s => s.name),
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xAxisData
    },
    yAxis: {
      type: 'value'
    },
    series: seriesData.map((series, index) => ({
      ...series,
      type: 'bar',
      stack: 'total',
      itemStyle: {
        color: colors ? colors[index % colors.length] : undefined,
        borderRadius: [0, 0, 0, 0]
      }
    }))
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 儀表盤組件
 */
export const GaugeChart = ({ title, value, max = 100, height = 300, color = '#7234CF' }) => {
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      formatter: '{a} <br/>{b}: {c}%'
    },
    series: [
      {
        name: title,
        type: 'gauge',
        progress: {
          show: true
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%'
        },
        data: [
          {
            value: value,
            name: title
          }
        ],
        itemStyle: {
          color: color
        }
      }
    ]
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 散點圖組件
 */
export const ScatterChart = ({ title, data, height = 300, xAxisName, yAxisName, colors }) => {
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        return `${params.seriesName}<br/>${xAxisName}: ${params.value[0]}<br/>${yAxisName}: ${params.value[1]}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: xAxisName,
      nameLocation: 'middle',
      nameGap: 30
    },
    yAxis: {
      type: 'value',
      name: yAxisName,
      nameLocation: 'middle',
      nameGap: 50
    },
    series: [{
      name: title,
      type: 'scatter',
      data: data,
      symbolSize: (data) => Math.sqrt(data[2]) * 2 || 8,
      itemStyle: {
        color: colors?.[0] || '#7234CF',
        opacity: 0.6
      }
    }]
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 熱力圖組件（用於時段分析）
 */
export const HeatmapChart = ({ title, data, height = 300, xAxisData, yAxisData }) => {
  // 將二維數組轉換為熱力圖需要的格式 [x, y, value]
  const heatmapData = [];
  if (data && Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
    data.forEach((row, yIndex) => {
      row.forEach((value, xIndex) => {
        heatmapData.push([xIndex, yIndex, value]);
      });
    });
  }

  const maxValue = heatmapData.length > 0 ? Math.max(...heatmapData.map(d => d[2])) : 0;

  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      position: 'top',
      formatter: (params) => {
        const xLabel = xAxisData && xAxisData[params.value[0]] ? xAxisData[params.value[0]] : params.value[0];
        const yLabel = yAxisData && yAxisData[params.value[1]] ? yAxisData[params.value[1]] : params.value[1];
        return `${yLabel}<br/>${xLabel}: ${params.value[2]}`;
      }
    },
    grid: {
      height: '50%',
      top: '15%'
    },
    xAxis: {
      type: 'category',
      data: xAxisData || [],
      splitArea: { show: true },
      axisLabel: {
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: 'category',
      data: yAxisData || [],
      splitArea: { show: true }
    },
    visualMap: {
      min: 0,
      max: maxValue,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '5%',
      inRange: {
        color: ['#50a3ba', '#eac736', '#d94e5d']
      }
    },
    series: [{
      name: title,
      type: 'heatmap',
      data: heatmapData,
      label: {
        show: true,
        formatter: (params) => params.value[2] > 0 ? params.value[2] : ''
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 漏斗圖組件
 */
export const FunnelChart = ({ title, data, height = 300, colors }) => {
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: { fontSize: 14, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    series: [{
      name: title,
      type: 'funnel',
      left: '10%',
      top: 60,
      bottom: 60,
      width: '80%',
      min: 0,
      max: Math.max(...data.map(d => d.value)),
      minSize: '0%',
      maxSize: '100%',
      sort: 'descending',
      gap: 2,
      label: {
        show: true,
        position: 'inside'
      },
      labelLine: {
        length: 10,
        lineStyle: {
          width: 1,
          type: 'solid'
        }
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1
      },
      emphasis: {
        label: {
          fontSize: 20
        }
      },
      data: data,
      color: colors
    }]
  };

  return (
    <Card style={{ height: '100%' }}>
      <ReactECharts
        option={option}
        style={{ height: height, width: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </Card>
  );
};

/**
 * 3D 散點圖組件（流程步驟執行分佈）
 * 如果沒有 echarts-gl，使用 2D 散點圖替代
 */
export const Scatter3DChart = ({ title, data, height = 600, xAxisName, yAxisName, zAxisName, workflows, steps, colors }) => {
  // 嘗試使用 3D 圖表，如果沒有 echarts-gl 則使用 2D 散點圖
  let use3D = false;
  try {
    // 檢查是否已導入 echarts-gl
    if (typeof window !== 'undefined' && window.echarts && window.echarts.registerMap) {
      // 嘗試動態導入 echarts-gl
      try {
        require('echarts-gl');
        use3D = true;
      } catch (e) {
        console.warn('echarts-gl not available, using 2D scatter chart instead');
      }
    }
  } catch (e) {
    console.warn('Using 2D scatter chart fallback');
  }

  if (use3D) {
    // 3D 散點圖配置
    const option = {
      title: {
        text: title,
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' }
      },
      tooltip: {
        formatter: (params) => {
          const workflow = workflows && workflows[params.value[1]] ? workflows[params.value[1]] : `流程${params.value[1]}`;
          const step = steps && steps[params.value[2]] ? steps[params.value[2]] : `步驟${params.value[2]}`;
          return `${workflow} - ${step}<br/>時間: ${params.value[0]}小時<br/>執行次數: ${params.value[3]}`;
        }
      },
      xAxis3D: {
        type: 'value',
        name: xAxisName,
        nameTextStyle: { color: '#666' }
      },
      yAxis3D: {
        type: 'value',
        name: yAxisName,
        nameTextStyle: { color: '#666' },
        data: workflows || []
      },
      zAxis3D: {
        type: 'value',
        name: zAxisName,
        nameTextStyle: { color: '#666' },
        data: steps || []
      },
      grid3D: {
        boxWidth: 200,
        boxDepth: 80,
        viewControl: {
          projection: 'perspective',
          autoRotate: false,
          autoRotateDirection: 'cw',
          autoRotateSpeed: 10
        },
        light: {
          main: {
            intensity: 1.2,
            shadow: true
          },
          ambient: {
            intensity: 0.3
          }
        }
      },
      series: [{
        type: 'scatter3D',
        data: data,
        symbolSize: (val) => Math.sqrt(val[3]) * 2,
        itemStyle: {
          color: colors ? colors[0] : '#7234CF',
          opacity: 0.8
        }
      }]
    };

    return (
      <Card style={{ height: '100%' }}>
        <ReactECharts
          option={option}
          style={{ height: height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </Card>
    );
  } else {
    // 2D 散點圖替代方案：使用多個 2D 散點圖組合
    // 將 3D 數據轉換為 2D：時間 vs 流程（顏色表示步驟）
    const scatter2DData = data.map(item => ({
      value: [item[0], item[1]], // [時間, 流程索引]
      stepIndex: item[2],
      count: item[3],
      stepName: steps && steps[item[2]] ? steps[item[2]] : `步驟${item[2]}`
    }));

    const stepColors = steps ? steps.map((_, i) => {
      const colorsArray = colors || ['#7234CF', '#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#13c2c2'];
      return colorsArray[i % colorsArray.length];
    }) : ['#7234CF'];

    const option = {
      title: {
        text: title + ' (2D 視圖)',
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 'bold' },
        subtext: 'X軸：時間（小時） | Y軸：流程 | 顏色：步驟類型',
        subtextStyle: { fontSize: 12, color: '#999' }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const workflow = workflows && workflows[params.value[1]] ? workflows[params.value[1]] : `流程${params.value[1]}`;
          return `${workflow}<br/>時間: ${params.value[0]}小時<br/>步驟: ${params.data.stepName}<br/>執行次數: ${params.data.count}`;
        }
      },
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: xAxisName,
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        nameLocation: 'middle',
        nameGap: 50,
        data: workflows || []
      },
      visualMap: {
        min: 0,
        max: steps ? steps.length - 1 : 0,
        dimension: 2,
        calculable: true,
        inRange: {
          color: stepColors
        },
        formatter: (value) => {
          return steps && steps[value] ? steps[value] : `步驟${value}`;
        }
      },
      series: [{
        type: 'scatter',
        data: scatter2DData,
        symbolSize: (data) => Math.sqrt(data.count) * 3,
        itemStyle: {
          color: (params) => {
            const stepIndex = params.data.stepIndex;
            return stepColors[stepIndex % stepColors.length];
          },
          opacity: 0.7
        }
      }]
    };

    return (
      <Card style={{ height: '100%' }}>
        <ReactECharts
          option={option}
          style={{ height: height, width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </Card>
    );
  }
};

export default {
  PieChart,
  BarChart,
  LineChart,
  StackedBarChart,
  GaugeChart,
  ScatterChart,
  HeatmapChart,
  FunnelChart,
  Scatter3DChart
};

