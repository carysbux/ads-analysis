#!/usr/bin/env python3
"""Aggregate processed CSVs into JSON for the static dashboard."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pandas as pd


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_performance_rows(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                rows.append(
                    {
                        "date": r["date"],
                        "platform": r["platform"],
                        "industry": (r.get("industry") or "").strip(),
                        "campaign_type": (r.get("campaign_type") or "").strip(),
                        "ad_spend": float(r["ad_spend"]),
                        "revenue": float(r["revenue"]),
                        "CPC": float(r["CPC"]),
                        "CPA": float(r["CPA"]),
                    }
                )
            except (KeyError, ValueError):
                continue
    return rows


def build_platform_spend_bin_curves(rows: list[dict]) -> list[dict]:
    """Same logic as `spend-v-revenue-3.ipynb`: qcut(ad_spend, q=10) per platform, then mean spend/revenue per bin."""
    df = pd.DataFrame(rows)
    curve_rows: list[dict] = []
    for platform, g in df.groupby("platform"):
        work = g[["ad_spend", "revenue"]].dropna().copy()
        if work.empty:
            continue
        work["spend_bin"] = pd.qcut(work["ad_spend"], q=10, duplicates="drop")
        binned = (
            work.groupby("spend_bin", observed=True)
            .agg(
                mean_spend=("ad_spend", "mean"),
                mean_revenue=("revenue", "mean"),
                n=("revenue", "size"),
            )
            .reset_index(drop=True)
            .sort_values("mean_spend")
        )
        points: list[dict] = []
        for _, r in binned.iterrows():
            ms = float(r["mean_spend"])
            mr = float(r["mean_revenue"])
            points.append(
                {
                    "mean_spend": round(ms, 4),
                    "mean_revenue": round(mr, 4),
                    "revenue_per_dollar": round(mr / ms, 6) if ms else 0.0,
                    "n": int(r["n"]),
                }
            )
        curve_rows.append({"platform": str(platform), "points": points})
    return curve_rows


def build_roas_best_by_platform_industry(rows: list[dict]) -> list[dict]:
    """Same logic as `campaign-industry-4.ipynb` cell 1: best campaign type per platform×industry by group ROAS."""
    df = pd.DataFrame(rows)
    if df.empty or "industry" not in df.columns:
        return []
    df = df[df["industry"].astype(str).str.len() > 0].copy()
    agg = (
        df.groupby(["platform", "industry", "campaign_type"], as_index=False)
        .agg(
            total_revenue=("revenue", "sum"),
            total_ad_spend=("ad_spend", "sum"),
        )
    )
    agg["group_roas"] = agg["total_revenue"] / agg["total_ad_spend"]
    best = (
        agg.sort_values(["platform", "industry", "group_roas"], ascending=[True, True, False])
        .groupby(["platform", "industry"], as_index=False)
        .first()
    )
    platform_order = ["Google Ads", "Meta Ads", "TikTok Ads"]
    industries = sorted(best["industry"].astype(str).unique().tolist())
    out: list[dict] = []
    for platform in platform_order:
        sub = best[best["platform"] == platform]
        row_list: list[dict] = []
        for ind in industries:
            m = sub[sub["industry"] == ind]
            if m.empty:
                continue
            r = m.iloc[0]
            row_list.append(
                {
                    "industry": ind,
                    "best_campaign_type": str(r["campaign_type"]),
                    "best_group_roas": round(float(r["group_roas"]), 6),
                }
            )
        out.append({"platform": platform, "rows": row_list})
    return out


def load_platform_cpc_cpa(path: Path) -> list[dict]:
    out: list[dict] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            out.append(
                {
                    "platform": r["platform"],
                    "avg_CPC": float(r["avg_CPC"]),
                    "avg_CPA": float(r["avg_CPA"]),
                }
            )
    return out


def main() -> None:
    root = repo_root()
    perf_path = root / "data" / "processed" / "global_ads_performance_dataset_processed.csv"
    plat_path = root / "data" / "processed" / "platform_avg_cpc_cpa.csv"
    if not perf_path.is_file():
        raise SystemExit(f"Missing dataset: {perf_path}")
    if not plat_path.is_file():
        raise SystemExit(f"Missing platform aggregates: {plat_path}")

    rows = load_performance_rows(perf_path)
    platform_metrics = load_platform_cpc_cpa(plat_path)
    bin_curves = build_platform_spend_bin_curves(rows)
    roas_panels = build_roas_best_by_platform_industry(rows)

    payload = {
        "source": str(perf_path.relative_to(root)),
        "row_count": len(rows),
        "platform_spend_bin_curves": bin_curves,
        "platform_avg_cpc_cpa": platform_metrics,
        "roas_best_by_platform_industry": roas_panels,
    }

    out_dir = root / "dashboard"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "data.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
