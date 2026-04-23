"""
KZLEAP — LP Optimization Module
Least-cost electricity generation dispatch using PuLP
Kazakhstan power sector 2024–2060
"""

import pulp
from typing import Dict, List, Optional

# ─────────────────────────────────────────────
# TECHNOLOGY PARAMETERS
# Sources: IEA Kazakhstan 2022, IRENA, KEGOC
# ─────────────────────────────────────────────

TECHNOLOGIES = {
    "coal": {
        "capex_mw":      1_200_000,   # USD/MW
        "fopex_mw_yr":      30_000,   # USD/MW/year fixed O&M
        "vopex_mwh":             5,   # USD/MWh variable O&M
        "fuel_cost_gj":          2,   # USD/GJ (cheap domestic coal)
        "heat_rate_gj_mwh":   10.5,   # GJ/MWh (~33% efficiency)
        "cf":                 0.65,   # capacity factor
        "lifetime_yr":          35,
        "co2_factor_t_mwh":  0.820,   # tCO2/MWh
        "existing_gw":        14.0,   # GW installed in 2023
    },
    "gas": {
        "capex_mw":        900_000,
        "fopex_mw_yr":      18_000,
        "vopex_mwh":             4,
        "fuel_cost_gj":          5,
        "heat_rate_gj_mwh":    7.2,   # ~47% efficiency (CCGT)
        "cf":                 0.55,
        "lifetime_yr":          30,
        "co2_factor_t_mwh":  0.490,
        "existing_gw":         5.0,
    },
    "hydro": {
        "capex_mw":      2_500_000,
        "fopex_mw_yr":      15_000,
        "vopex_mwh":             2,
        "fuel_cost_gj":          0,
        "heat_rate_gj_mwh":    0.0,
        "cf":                 0.40,
        "lifetime_yr":          60,
        "co2_factor_t_mwh":  0.000,
        "existing_gw":         2.7,   # limited expansion
    },
    "wind": {
        "capex_mw":      1_400_000,
        "fopex_mw_yr":      25_000,
        "vopex_mwh":             3,
        "fuel_cost_gj":          0,
        "heat_rate_gj_mwh":    0.0,
        "cf":                 0.30,
        "lifetime_yr":          25,
        "co2_factor_t_mwh":  0.000,
        "existing_gw":         1.4,
    },
    "solar": {
        "capex_mw":        900_000,
        "fopex_mw_yr":      10_000,
        "vopex_mwh":             2,
        "fuel_cost_gj":          0,
        "heat_rate_gj_mwh":    0.0,
        "cf":                 0.22,
        "lifetime_yr":          25,
        "co2_factor_t_mwh":  0.000,
        "existing_gw":         1.1,
    },
    "nuclear": {
        "capex_mw":      5_000_000,
        "fopex_mw_yr":      70_000,
        "vopex_mwh":             8,
        "fuel_cost_gj":        0.5,
        "heat_rate_gj_mwh":   10.4,
        "cf":                 0.90,
        "lifetime_yr":          60,
        "co2_factor_t_mwh":  0.000,
        "existing_gw":         0.0,
    },
}

DISCOUNT_RATE = 0.08   # 8% — Kazakhstan cost of capital


def run_lp_optimization(
    demand_twh: float,
    scenario: str = "MT",
    year: int = 2035,
    renewables_target: float = 0.15,
    co2_budget_mt: Optional[float] = None,
    nuclear_available_gw: float = 0.0,
) -> Dict:
    """
    LP optimization: find least-cost generation mix to meet demand.

    Args:
        demand_twh: Total electricity demand (TWh)
        scenario: BAU / MT / DD
        year: Target year
        renewables_target: Min share of RE in generation (fraction)
        co2_budget_mt: Max CO2 from power sector (Mt), None = unconstrained
        nuclear_available_gw: Installed nuclear capacity (GW)

    Returns:
        Dict with optimal generation mix, costs, emissions
    """
    prob = pulp.LpProblem("KZLEAP_Electricity_Dispatch", pulp.LpMinimize)

    techs = list(TECHNOLOGIES.keys())
    gen = {t: pulp.LpVariable(f"gen_{t}", lowBound=0) for t in techs}
    cap_new = {t: pulp.LpVariable(f"cap_new_{t}", lowBound=0) for t in techs}

    # ── Objective: minimize total annual cost (USD) ──
    cost_terms = []
    for t in techs:
        p = TECHNOLOGIES[t]
        existing_gw = p["existing_gw"]
        # Total available capacity
        avail_twh = (existing_gw + nuclear_available_gw if t == "nuclear" else existing_gw) \
                    * p["cf"] * 8760 / 1000

        # Variable cost per TWh
        fuel_cost_twh = p["fuel_cost_gj"] * p["heat_rate_gj_mwh"] * 1000   # USD/MWh → /TWh * 1e6
        var_cost_twh = (p["vopex_mwh"] + fuel_cost_twh) * 1_000_000  # USD/TWh

        # Fixed cost annualized
        ann_capex = p["capex_mw"] * (DISCOUNT_RATE / (1 - (1 + DISCOUNT_RATE) ** -p["lifetime_yr"]))
        fixed_cost_gw_yr = (ann_capex + p["fopex_mw_yr"]) * 1000   # USD/GW/yr

        cost_terms.append(var_cost_twh * gen[t])
        cost_terms.append(fixed_cost_gw_yr * cap_new[t])

    prob += pulp.lpSum(cost_terms), "Total_System_Cost"

    # ── Constraints ──

    # 1. Energy balance: must meet demand (with 10% grid losses)
    prob += pulp.lpSum(gen[t] for t in techs) >= demand_twh * 1.10, "Energy_Balance"

    # 2. Generation ≤ available capacity
    for t in techs:
        p = TECHNOLOGIES[t]
        base_gw = p["existing_gw"]
        if t == "nuclear":
            base_gw = nuclear_available_gw
        max_twh = (base_gw + cap_new[t]) * p["cf"] * 8760 / 1000
        prob += gen[t] <= max_twh, f"Capacity_{t}"

    # 3. Renewables target
    re_techs = ["wind", "solar", "hydro"]
    prob += pulp.lpSum(gen[t] for t in re_techs) >= \
           renewables_target * pulp.lpSum(gen[t] for t in techs), "RE_Target"

    # 4. CO2 budget (optional)
    if co2_budget_mt is not None:
        co2_expr = pulp.lpSum(
            gen[t] * TECHNOLOGIES[t]["co2_factor_t_mwh"] / 1_000_000
            for t in techs
        )
        prob += co2_expr <= co2_budget_mt, "CO2_Budget"

    # 5. Hydro limited expansion (Kazakhstan resource constraint)
    prob += cap_new["hydro"] <= 1.0, "Hydro_Limit"  # max +1 GW new

    # 6. Nuclear only if policy allows
    if nuclear_available_gw == 0.0:
        prob += cap_new["nuclear"] == 0, "No_Nuclear"
        prob += gen["nuclear"] == 0, "No_Nuclear_Gen"

    # ── Solve ──
    solver = pulp.PULP_CBC_CMD(msg=0)
    status = prob.solve(solver)

    if pulp.LpStatus[prob.status] not in ("Optimal", "Feasible"):
        return {"error": f"LP infeasible: {pulp.LpStatus[prob.status]}"}

    # ── Extract results ──
    total_gen = sum(pulp.value(gen[t]) or 0 for t in techs)
    total_co2_mt = sum(
        (pulp.value(gen[t]) or 0) * TECHNOLOGIES[t]["co2_factor_t_mwh"] / 1_000_000
        for t in techs
    )
    total_cost_bn = pulp.value(prob.objective) / 1e9

    mix = {}
    for t in techs:
        g = pulp.value(gen[t]) or 0
        mix[t] = {
            "generation_twh": round(g, 2),
            "share_pct":      round(g / total_gen * 100, 1) if total_gen > 0 else 0,
            "new_capacity_gw": round(pulp.value(cap_new[t]) or 0, 2),
            "co2_mt":         round(g * TECHNOLOGIES[t]["co2_factor_t_mwh"] / 1_000_000, 2),
        }

    return {
        "status":          pulp.LpStatus[prob.status],
        "year":            year,
        "scenario":        scenario,
        "demand_twh":      demand_twh,
        "total_gen_twh":   round(total_gen, 1),
        "total_co2_mt":    round(total_co2_mt, 2),
        "total_cost_bn_usd": round(total_cost_bn, 2),
        "mix":             mix,
        "re_share_pct":    round(
            sum(mix[t]["generation_twh"] for t in ["wind", "solar", "hydro"]) / total_gen * 100, 1
        ) if total_gen > 0 else 0,
        "lcoe_estimate_usd_mwh": round(
            (total_cost_bn * 1e9) / (total_gen * 1e6), 1
        ) if total_gen > 0 else 0,
    }
