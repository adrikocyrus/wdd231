import { formatDate } from "./dashboard.js";

let chart;
let candleSeries;
let observer;

export function renderChart(pair, candles) {
  const container = document.getElementById("price-chart");
  document.getElementById("chart-title").innerHTML =
    `${pair} <span class="muted-heading">· Sample candles</span>`;
  if (!window.LightweightCharts) {
    container.innerHTML = '<p class="muted">The chart library could not load. Check your internet connection and refresh.</p>';
    return;
  }

  if (!chart) {
    chart = window.LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { color: "#111a24" }, textColor: "#8998a6" },
      grid: {
        vertLines: { color: "#1d2a35" },
        horzLines: { color: "#1d2a35" },
      },
      rightPriceScale: { borderColor: "#253441" },
      timeScale: { borderColor: "#253441", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#526777" }, horzLine: { color: "#526777" } },
    });
    candleSeries = chart.addCandlestickSeries({
      upColor: "#41d6a1",
      downColor: "#ff737b",
      borderUpColor: "#41d6a1",
      borderDownColor: "#ff737b",
      wickUpColor: "#41d6a1",
      wickDownColor: "#ff737b",
    });
    observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    observer.observe(container);
  }

  const seriesData = candles.map((candle) => ({
    time: Math.floor(new Date(candle.time).getTime() / 1000),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
  candleSeries.setData(seriesData);
  chart.timeScale().fitContent();
  document.getElementById("chart-status").textContent =
    `Sample data · latest completed candle ${formatDate(candles.at(-1).time)}`;
}
