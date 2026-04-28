/* global Chart, ChartDataLabels */

const PLATFORM_COLORS = {
  "Google Ads": "#1f77b4",
  "Meta Ads": "#ff7f0e",
  "TikTok Ads": "#2ca02c",
};

const SEABORN_LINE_COLORS = PLATFORM_COLORS;

const PLATFORM_ORDER = ["Google Ads", "Meta Ads", "TikTok Ads"];

const AXIS = {
  titleColor: "#1a1d21",
  tickColor: "#4a5058",
  grid: "rgba(0, 0, 0, 0.07)",
  border: "#c5cad3",
};

function colorForPlatform(p) {
  return PLATFORM_COLORS[p] || "#6b7280";
}

function lineColorForPlatform(p) {
  return SEABORN_LINE_COLORS[p] || "#333333";
}

function sortCurvesByPlatform(curves) {
  return [...curves].sort(
    (a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)
  );
}

function applyGlobalChartDefaults() {
  Chart.defaults.color = AXIS.tickColor;
  Chart.defaults.borderColor = AXIS.grid;
  Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
}

function scaleLinear(title) {
  return {
    type: "linear",
    title: {
      display: true,
      text: title,
      color: AXIS.titleColor,
      font: { size: 12, weight: "600" },
    },
    grid: { color: AXIS.grid },
    ticks: { color: AXIS.tickColor },
    border: { color: AXIS.border },
  };
}

function tooltipLight() {
  return {
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    titleColor: "#111",
    bodyColor: "#333",
    borderColor: "#ccc",
    borderWidth: 1,
  };
}

function seabornLineOptions(xTitle, yTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        title: {
          display: true,
          text: "platform",
          color: AXIS.titleColor,
          padding: { top: 4, bottom: 0 },
          font: { size: 11, weight: "600" },
        },
        labels: {
          color: AXIS.titleColor,
          usePointStyle: true,
          pointStyle: "circle",
          padding: 14,
          font: { size: 11 },
        },
      },
      tooltip: tooltipLight(),
      datalabels: { display: false },
    },
    scales: {
      x: scaleLinear(xTitle),
      y: scaleLinear(yTitle),
    },
  };
}

function buildBinSpendRevenueLine(ctx, data) {
  const curves = sortCurvesByPlatform(data.platform_spend_bin_curves || []);
  if (!curves.length) return null;
  const datasets = curves.map((row) => {
    const c = lineColorForPlatform(row.platform);
    return {
      label: row.platform,
      data: row.points.map((p) => ({ x: p.mean_spend, y: p.mean_revenue })),
      borderColor: c,
      backgroundColor: c,
      tension: 0.12,
      spanGaps: true,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: c,
      pointBorderColor: "#ffffff",
      pointBorderWidth: 1.25,
      borderWidth: 2.25,
      fill: false,
    };
  });
  return new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: seabornLineOptions("Average Spend per Bin", "Average Revenue per Bin"),
  });
}

function buildBinRevPerDollarLine(ctx, data) {
  const curves = sortCurvesByPlatform(data.platform_spend_bin_curves || []);
  if (!curves.length) return null;
  const datasets = curves.map((row) => {
    const c = lineColorForPlatform(row.platform);
    return {
      label: row.platform,
      data: row.points.map((p) => ({ x: p.mean_spend, y: p.revenue_per_dollar })),
      borderColor: c,
      backgroundColor: c,
      tension: 0.12,
      spanGaps: true,
      pointRadius: 5,
      pointHoverRadius: 7,
      pointBackgroundColor: c,
      pointBorderColor: "#ffffff",
      pointBorderWidth: 1.25,
      borderWidth: 2.25,
      fill: false,
    };
  });
  return new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: seabornLineOptions("Average Spend per Bin", "Revenue per $1 Spend"),
  });
}

async function loadData() {
  const res = await fetch("data.json");
  if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
  return res.json();
}

function buildCpcCpaScatter(ctx, data) {
  const pts = data.platform_avg_cpc_cpa.map((r) => ({
    x: r.avg_CPC,
    y: r.avg_CPA,
    platform: r.platform,
  }));
  return new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Platforms",
          data: pts,
          backgroundColor: pts.map((p) => colorForPlatform(p.platform)),
          pointRadius: 11,
          pointHoverRadius: 13,
          pointBorderColor: "#fff",
          pointBorderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          ...tooltipLight(),
          callbacks: {
            label(ctx) {
              const { platform, x, y } = ctx.raw;
              return `${platform}: CPC $${x.toFixed(2)}, CPA $${y.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: scaleLinear("Avg CPC ($)"),
        y: scaleLinear("Avg CPA ($)"),
      },
    },
  });
}

const BAR_CPC = "#4C78A8";
const BAR_CPA = "#F58518";
const BAR_ROAS = "#4C78A8";

function maxRoasAcrossPanels(panels) {
  let m = 0;
  for (const panel of panels) {
    for (const row of panel.rows || []) {
      const v = Number(row.best_group_roas);
      if (!Number.isNaN(v)) m = Math.max(m, v);
    }
  }
  return m > 0 ? m * 1.15 : 1;
}

function buildRoasPlatformBar(canvas, panel, yMax) {
  const rows = panel.rows || [];
  if (!rows.length) return null;
  const labels = rows.map((r) => r.industry);
  const values = rows.map((r) => Number(r.best_group_roas));
  const campaigns = rows.map((r) => String(r.best_campaign_type || ""));

  const roasDatalabels =
    typeof ChartDataLabels !== "undefined"
      ? {
          display: true,
          anchor: "end",
          align: "top",
          offset: 2,
          color: "#333",
          font: { size: 8, weight: "500" },
          formatter(_, ctx) {
            const i = ctx.dataIndex;
            return [campaigns[i], values[i].toFixed(2)];
          },
        }
      : undefined;

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Best group ROAS",
          data: values,
          backgroundColor: BAR_ROAS,
          borderColor: BAR_ROAS,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipLight(),
          callbacks: {
            label(ctx) {
              const i = ctx.dataIndex;
              return `${campaigns[i]}: ${values[i].toFixed(3)}`;
            },
          },
        },
        ...(roasDatalabels ? { datalabels: roasDatalabels } : {}),
      },
      scales: {
        x: {
          ticks: {
            color: AXIS.tickColor,
            maxRotation: 40,
            minRotation: 35,
            autoSkip: false,
            font: { size: 9 },
          },
          grid: { display: false },
          border: { color: AXIS.border },
        },
        y: {
          type: "linear",
          beginAtZero: true,
          max: yMax,
          title: {
            display: true,
            text: "Best group ROAS",
            color: AXIS.titleColor,
            font: { size: 11, weight: "600" },
          },
          ticks: { color: AXIS.tickColor },
          grid: { color: AXIS.grid },
          border: { color: AXIS.border },
        },
      },
    },
  });
}

function buildRoasBarCharts(data) {
  const panels = data.roas_best_by_platform_industry || [];
  const canvasByPlatform = {
    "Google Ads": document.getElementById("chartRoasGoogle"),
    "Meta Ads": document.getElementById("chartRoasMeta"),
    "TikTok Ads": document.getElementById("chartRoasTiktok"),
  };
  const yMax = maxRoasAcrossPanels(panels);
  for (const panel of panels) {
    const el = canvasByPlatform[panel.platform];
    if (el) buildRoasPlatformBar(el, panel, yMax);
  }
}

function buildCpcCpaBars(ctx, data) {
  const rows = [...data.platform_avg_cpc_cpa].sort((a, b) => b.avg_CPA - a.avg_CPA);
  const labels = rows.map((r) => r.platform);
  const cpc = rows.map((r) => r.avg_CPC);
  const cpa = rows.map((r) => r.avg_CPA);
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Avg CPC",
          data: cpc,
          backgroundColor: BAR_CPC,
          borderColor: BAR_CPC,
          borderWidth: 1,
        },
        {
          label: "Avg CPA",
          data: cpa,
          backgroundColor: BAR_CPA,
          borderColor: BAR_CPA,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: AXIS.titleColor,
            boxWidth: 14,
            font: { size: 11 },
          },
        },
        datalabels: { display: false },
        tooltip: {
          ...tooltipLight(),
          callbacks: {
            label(ctx) {
              const v = typeof ctx.raw === "number" ? ctx.raw : ctx.parsed.y;
              return `${ctx.dataset.label}: $${v.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: AXIS.tickColor },
          grid: { display: false },
          border: { color: AXIS.border },
        },
        y: {
          type: "linear",
          beginAtZero: true,
          title: {
            display: true,
            text: "Value (USD)",
            color: AXIS.titleColor,
            font: { size: 12, weight: "600" },
          },
          ticks: { color: AXIS.tickColor },
          grid: { color: AXIS.grid },
          border: { color: AXIS.border },
        },
      },
    },
  });
}

async function main() {
  const meta = document.getElementById("metaLine");
  applyGlobalChartDefaults();
  if (typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
    // Without this, the plugin labels every chart with raw numbers.
    Chart.defaults.plugins.datalabels = {
      ...(Chart.defaults.plugins.datalabels || {}),
      display: false,
    };
  }

  try {
    const data = await loadData();
    const warnings = [];

    if (!data.platform_spend_bin_curves || data.platform_spend_bin_curves.length === 0) {
      warnings.push("Bin curves missing — run: python3 scripts/build_dashboard_data.py");
    }
    if (!data.roas_best_by_platform_industry || data.roas_best_by_platform_industry.length === 0) {
      warnings.push("ROAS panels empty — rebuild data with build_dashboard_data.py");
    }

    if (warnings.length) {
      meta.hidden = false;
      meta.textContent = warnings.join(" · ");
    } else {
      meta.textContent = "";
      meta.hidden = true;
    }

    const elBinSpend = document.getElementById("chartBinSpendRevenue");
    const elBinRev = document.getElementById("chartBinRevPerDollar");
    if (data.platform_spend_bin_curves?.length) {
      buildBinSpendRevenueLine(elBinSpend, data);
      buildBinRevPerDollarLine(elBinRev, data);
    }

    buildCpcCpaScatter(document.getElementById("chartCpcCpaScatter"), data);
    buildCpcCpaBars(document.getElementById("chartCpcCpaBars"), data);

    if (data.roas_best_by_platform_industry?.length) {
      buildRoasBarCharts(data);
    }
  } catch (e) {
    meta.hidden = false;
    meta.textContent = e instanceof Error ? e.message : String(e);
    console.error(e);
  }
}

main();
