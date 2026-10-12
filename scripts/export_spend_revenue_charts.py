#!/usr/bin/env python3
"""Write spend/revenue line charts with explicit x and y axis labels (for slides, not the web app)."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "dashboard" / "data.json"
OUT = ROOT / "dashboard" / "exports" / "spend_revenue_curves_xy_labeled.png"

COLORS = {
    "Google Ads": "#1f77b4",
    "Meta Ads": "#ff7f0e",
    "TikTok Ads": "#2ca02c",
}


def main() -> None:
    curves = json.loads(DATA.read_text(encoding="utf-8"))["platform_spend_bin_curves"]
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.2))

    for c in curves:
        col = COLORS.get(c["platform"], "#333333")
        pts = c["points"]
        x = [p["mean_spend"] for p in pts]
        y_rev = [p["mean_revenue"] for p in pts]
        y_rpd = [p["revenue_per_dollar"] for p in pts]
        ax1.plot(x, y_rev, marker="o", label=c["platform"], color=col, linewidth=2)
        ax2.plot(x, y_rpd, marker="o", label=c["platform"], color=col, linewidth=2)

    ax1.set_xlabel("x — mean ad spend in bin (USD)", fontsize=11)
    ax1.set_ylabel("y — mean revenue in bin (USD)", fontsize=11)
    ax1.set_title("Spend vs revenue (by platform)", fontsize=12, fontweight="600")
    ax1.legend(title="Platform")
    ax1.grid(True, alpha=0.35)

    ax2.set_xlabel("x — mean ad spend in bin (USD)", fontsize=11)
    ax2.set_ylabel("y — revenue per $1 spend in bin", fontsize=11)
    ax2.set_title("Revenue per $1 spend by bin (by platform)", fontsize=12, fontweight="600")
    ax2.legend(title="Platform")
    ax2.grid(True, alpha=0.35)

    fig.suptitle("Quantile bins of ad_spend per platform (q=10)", fontsize=10, color="#444")
    plt.tight_layout()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=160, bbox_inches="tight")
    plt.close()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
