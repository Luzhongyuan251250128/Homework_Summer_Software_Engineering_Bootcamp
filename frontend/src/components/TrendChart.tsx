import { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface TrendChartProps {
  data: { date: string; commits: number }[];
  height?: number;
}

/**
 * 提交趋势折线图（ECharts）。
 * 主题取自设计系统令牌（青瓷线条 + 面积渐变 + 深色 tooltip）；
 * 无数据时展示虚线空态；挂载后监听窗口尺寸自动 resize。
 * 容器保留 data-testid="trend-chart"（测试契约）。
 */
export default function TrendChart({ data, height = 260 }: TrendChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: {
        trigger: "axis",
        backgroundColor: "#111827",
        borderWidth: 0,
        padding: [8, 12],
        textStyle: { color: "#f8fafc", fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: "#c9d1da" } },
      },
      grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
      xAxis: {
        type: "category",
        data: data.map((d) => d.date),
        axisLine: { lineStyle: { color: "#c9d1da" } },
        axisTick: { show: false },
        axisLabel: { color: "#667085", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#e9edf2" } },
        axisLabel: { color: "#667085", fontSize: 11 },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 5,
          showSymbol: data.length <= 32,
          lineStyle: { width: 2, color: "#0f766e" },
          itemStyle: { color: "#0f766e", borderColor: "#ffffff", borderWidth: 1.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(15, 118, 110, 0.22)" },
              { offset: 1, color: "rgba(15, 118, 110, 0)" },
            ]),
          },
          data: data.map((d) => d.commits),
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [data]);

  return (
    <div className="trend-chart" data-testid="trend-chart">
      {data.length === 0 ? (
        <div className="trend-chart__empty">暂无趋势数据</div>
      ) : (
        <div ref={ref} className="trend-chart__canvas" style={{ height }} />
      )}
    </div>
  );
}
