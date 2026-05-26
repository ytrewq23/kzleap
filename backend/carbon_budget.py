import numpy as np
from typing import Dict, List


BASE_YEAR_CO2   = 290.0
NDC_2030_PCT    = -15
NDC_COND_PCT    = -25
NEUTRALITY_YEAR = 2060


def compute_carbon_budget(scenarios_compare: Dict) -> Dict:
    """
    Given compare_scenarios() output, compute:
    - Remaining carbon budget vs IPCC 1.5C / 2C pathways (Kazakhstan share)
    - NDC compliance year-by-year
    - Year each scenario crosses NDC thresholds
    - Annual carbon deficit/surplus
    - Budget exhaustion year per scenario
    """

    IPCC_GLOBAL_15C_GT  = 400.0
    IPCC_GLOBAL_20C_GT  = 1150.0
    KZ_SHARE            = 0.006

    kz_budget_15c_mt = IPCC_GLOBAL_15C_GT * 1000 * KZ_SHARE
    kz_budget_20c_mt = IPCC_GLOBAL_20C_GT * 1000 * KZ_SHARE

    ndc_target_mt      = BASE_YEAR_CO2 * (1 + NDC_2030_PCT / 100)
    ndc_conditional_mt = BASE_YEAR_CO2 * (1 + NDC_COND_PCT / 100)

    results = {}

    for sc_name, sc_data in scenarios_compare.items():
        years = sc_data.get("years", [])
        co2   = sc_data.get("co2",   [])

        if not years or not co2:
            continue

        years_arr = np.array(years)
        co2_arr   = np.array(co2)

        base_idx = np.searchsorted(years_arr, 2023)
        base_co2 = co2_arr[base_idx] if base_idx < len(co2_arr) else co2_arr[0]

        ndc_compliance = []
        cumulative_emissions = 0.0
        budget_15c_exhausted = None
        budget_20c_exhausted = None
        cumulative_from_2024 = 0.0

        for i, yr in enumerate(years):
            if yr < 2024:
                continue
            emission = co2_arr[i]
            step     = 1.0
            cumulative_from_2024 += emission * step

            pct_vs_1990 = round((emission / BASE_YEAR_CO2 - 1) * 100, 1)
            meets_ndc      = emission <= ndc_target_mt
            meets_cond_ndc = emission <= ndc_conditional_mt

            ndc_compliance.append({
                "year":            int(yr),
                "co2_mt":          round(float(emission), 1),
                "pct_vs_1990":     pct_vs_1990,
                "ndc_target_mt":   round(ndc_target_mt, 1),
                "cond_target_mt":  round(ndc_conditional_mt, 1),
                "meets_ndc":       bool(meets_ndc),
                "meets_cond_ndc":  bool(meets_cond_ndc),
                "surplus_mt":      round(float(ndc_target_mt - emission), 1),
                "cumulative_mt":   round(float(cumulative_from_2024), 1),
            })

            if budget_15c_exhausted is None and cumulative_from_2024 >= kz_budget_15c_mt:
                budget_15c_exhausted = int(yr)
            if budget_20c_exhausted is None and cumulative_from_2024 >= kz_budget_20c_mt:
                budget_20c_exhausted = int(yr)

        ndc_cross_year     = None
        cond_ndc_cross_yr  = None
        neutrality_yr_proj = None

        for row in ndc_compliance:
            if row["meets_ndc"] and ndc_cross_year is None:
                ndc_cross_year = row["year"]
            if row["meets_cond_ndc"] and cond_ndc_cross_yr is None:
                cond_ndc_cross_yr = row["year"]

        for i in range(len(ndc_compliance) - 1):
            if ndc_compliance[i]["co2_mt"] > 5 and ndc_compliance[i+1]["co2_mt"] <= 5:
                neutrality_yr_proj = ndc_compliance[i+1]["year"]

        remaining_budget_15c = round(kz_budget_15c_mt - cumulative_from_2024, 0)
        remaining_budget_20c = round(kz_budget_20c_mt - cumulative_from_2024, 0)

        yr_2030_rows = [r for r in ndc_compliance if r["year"] == 2030]
        co2_2030     = yr_2030_rows[0]["co2_mt"] if yr_2030_rows else None
        co2_2060_rows = [r for r in ndc_compliance if r["year"] == 2060]
        co2_2060     = co2_2060_rows[0]["co2_mt"] if co2_2060_rows else None

        results[sc_name] = {
            "ndc_compliance":         ndc_compliance,
            "ndc_target_mt":          round(ndc_target_mt, 1),
            "cond_ndc_target_mt":     round(ndc_conditional_mt, 1),
            "ndc_achieved_year":      ndc_cross_year,
            "cond_ndc_achieved_year": cond_ndc_cross_yr,
            "neutrality_projected_yr":neutrality_yr_proj,
            "co2_2030_mt":            co2_2030,
            "co2_2060_mt":            co2_2060,
            "cumulative_2024_2060_mt":round(float(cumulative_from_2024), 0),
            "budget_15c_mt":          round(kz_budget_15c_mt, 0),
            "budget_20c_mt":          round(kz_budget_20c_mt, 0),
            "remaining_budget_15c_mt":remaining_budget_15c,
            "remaining_budget_20c_mt":remaining_budget_20c,
            "budget_15c_exhausted_yr":budget_15c_exhausted,
            "budget_20c_exhausted_yr":budget_20c_exhausted,
            "pct_budget_15c_used":    round(min(cumulative_from_2024 / kz_budget_15c_mt * 100, 100), 1),
            "pct_budget_20c_used":    round(min(cumulative_from_2024 / kz_budget_20c_mt * 100, 100), 1),
        }

    return {
        "scenarios":          results,
        "ndc_target_mt":      round(ndc_target_mt, 1),
        "cond_ndc_target_mt": round(ndc_conditional_mt, 1),
        "base_year_1990_mt":  BASE_YEAR_CO2,
        "neutrality_target_year": NEUTRALITY_YEAR,
        "budget_15c_mt":      round(kz_budget_15c_mt, 0),
        "budget_20c_mt":      round(kz_budget_20c_mt, 0),
        "ipcc_kz_share_pct":  KZ_SHARE * 100,
    }


def compute_custom_target(
    scenarios_compare: Dict,
    neutrality_year: int,
    reduction_pct_2030: float,
    reduction_pct_2050: float,
) -> Dict:
    """
    Given a user-defined CO2 target path, compute:
    - Required annual CO2 trajectory from 2024 to neutrality_year
    - Which existing scenarios are compatible
    - Remaining budget under the custom path
    - Gap between each scenario and the custom target at key milestones
    - Required annual reduction rate to meet the target
    """
    IPCC_GLOBAL_15C_GT = 400.0
    IPCC_GLOBAL_20C_GT = 1150.0
    KZ_SHARE           = 0.006

    kz_budget_15c_mt = IPCC_GLOBAL_15C_GT * 1000 * KZ_SHARE
    kz_budget_20c_mt = IPCC_GLOBAL_20C_GT * 1000 * KZ_SHARE

    base_co2  = BASE_YEAR_CO2
    target_2030_mt = round(base_co2 * (1 - reduction_pct_2030 / 100), 1)
    target_2050_mt = round(base_co2 * (1 - reduction_pct_2050 / 100), 1)

    years = list(range(2024, 2061))
    custom_trajectory = []
    cumulative = 0.0
    budget_15c_exhausted = None
    budget_20c_exhausted = None

    for yr in years:
        if yr <= 2030:
            t = (yr - 2024) / (2030 - 2024)
            co2 = base_co2 + (target_2030_mt - base_co2) * t
        elif yr <= 2050:
            t = (yr - 2030) / (2050 - 2030)
            co2 = target_2030_mt + (target_2050_mt - target_2030_mt) * t
        elif yr <= neutrality_year:
            t = (yr - 2050) / max(neutrality_year - 2050, 1)
            co2 = target_2050_mt * (1 - t)
        else:
            co2 = 0.0

        co2 = max(round(co2, 1), 0.0)
        cumulative += co2

        if budget_15c_exhausted is None and cumulative >= kz_budget_15c_mt:
            budget_15c_exhausted = yr
        if budget_20c_exhausted is None and cumulative >= kz_budget_20c_mt:
            budget_20c_exhausted = yr

        custom_trajectory.append({
            "year":          yr,
            "co2_mt":        co2,
            "cumulative_mt": round(cumulative, 1),
        })

    # Required annual reduction rate 2024-2030
    ann_reduction_rate_2030 = round((base_co2 - target_2030_mt) / base_co2 / 6 * 100, 2)
    ann_reduction_rate_2050 = round((target_2030_mt - target_2050_mt) / target_2030_mt / 20 * 100, 2) if target_2030_mt > 0 else 0

    # Compare each standard scenario to custom target
    scenario_gaps = {}
    for sc_name, sc_data in scenarios_compare.items():
        sc_years = sc_data.get("years", [])
        sc_co2   = sc_data.get("co2", [])
        if not sc_years:
            continue

        gaps = {}
        for milestone in [2030, 2040, 2050, 2060]:
            if milestone not in sc_years:
                continue
            idx = sc_years.index(milestone)
            sc_val = sc_co2[idx]

            tgt_row = next((r for r in custom_trajectory if r["year"] == milestone), None)
            tgt_val = tgt_row["co2_mt"] if tgt_row else None

            if tgt_val is not None:
                gap = round(sc_val - tgt_val, 1)
                gaps[milestone] = {
                    "scenario_co2_mt": round(sc_val, 1),
                    "target_co2_mt":   tgt_val,
                    "gap_mt":          gap,
                    "meets_target":    gap <= 0,
                }

        compatible = all(v["meets_target"] for v in gaps.values() if v)
        scenario_gaps[sc_name] = {
            "gaps":          gaps,
            "compatible":    compatible,
            "closest_year":  min(gaps.keys(), key=lambda y: abs(gaps[y]["gap_mt"])) if gaps else None,
        }

    remaining_15c = round(kz_budget_15c_mt - cumulative, 1)
    remaining_20c = round(kz_budget_20c_mt - cumulative, 1)

    return {
        "neutrality_year":          neutrality_year,
        "reduction_pct_2030":       reduction_pct_2030,
        "reduction_pct_2050":       reduction_pct_2050,
        "target_2030_mt":           target_2030_mt,
        "target_2050_mt":           target_2050_mt,
        "base_co2_mt":              base_co2,
        "custom_trajectory":        custom_trajectory,
        "cumulative_2024_2060_mt":  round(cumulative, 1),
        "budget_15c_mt":            round(kz_budget_15c_mt, 1),
        "budget_20c_mt":            round(kz_budget_20c_mt, 1),
        "remaining_budget_15c_mt":  remaining_15c,
        "remaining_budget_20c_mt":  remaining_20c,
        "budget_15c_exhausted_yr":  budget_15c_exhausted,
        "budget_20c_exhausted_yr":  budget_20c_exhausted,
        "pct_budget_15c_used":      round(min(cumulative / kz_budget_15c_mt * 100, 100), 1),
        "pct_budget_20c_used":      round(min(cumulative / kz_budget_20c_mt * 100, 100), 1),
        "ann_reduction_rate_2030":  ann_reduction_rate_2030,
        "ann_reduction_rate_2050":  ann_reduction_rate_2050,
        "scenario_gaps":            scenario_gaps,
    }
