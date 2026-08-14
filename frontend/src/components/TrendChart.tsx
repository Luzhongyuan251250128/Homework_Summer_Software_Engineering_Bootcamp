import { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function TrendChart({ data }: { data: { date: string; commits: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: data.map((d) => d.date) },
      yAxis: { type: "value" },
      series: [{ type: "line", smooth: true, data: data.map((d) => d.commits) }],
    });
    return () => chart.dispose();
  }, [data]);

  return <div ref={ref} style={{ height: 260 }} data-testid="trend-chart" />;
}
