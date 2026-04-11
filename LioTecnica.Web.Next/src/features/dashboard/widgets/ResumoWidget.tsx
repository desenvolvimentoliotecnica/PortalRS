"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { Series } from "../dashboardTypes";

export function ResumoWidget({ series }: { series: Series }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // Initialize/update chart when series changes
  useEffect(() => {
    const ctx = canvasRef.current;
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.data.labels = series.labels;
      chartRef.current.data.datasets[0]!.data = series.values;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          {
            label: "CVs recebidos",
            data: series.values,
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        // responsive: false so we control resize manually via ResizeObserver
        responsive: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: "rgba(16,82,144,.10)" }, ticks: { precision: 0 } },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.labels.join("|"), series.values.join("|")]);

  // Resize chart when container size changes (triggered by react-grid-layout)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!chartRef.current) return;
        const { width, height } = container.getBoundingClientRect();
        if (width > 0 && height > 0) {
          chartRef.current.resize(width, height);
        }
      });
    });

    ro.observe(container);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <div className="text-sm font-semibold">Resumo</div>
          <div className="text-muted-foreground text-xs">Últimos 14 dias</div>
        </div>
        <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
          Tendência
        </span>
      </div>
      <div ref={containerRef} className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}
