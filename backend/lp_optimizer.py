import pulp
from typing import Dict, Optional

TECHNOLOGIES = {
    "coal":    { "capex_mw": 1_200_000, "fopex_mw_yr": 30_000, "vopex_mwh": 5,  "fuel_cost_gj": 2,   "heat_rate_gj_mwh": 10.5, "cf": 0.65, "lifetime_yr": 35, "co2_factor_t_mwh": 0.820, "existing_gw": 14.0 },
    "gas":     { "capex_mw":   900_000, "fopex_mw_yr": 18_000, "vopex_mwh": 4,  "fuel_cost_gj": 5,   "heat_rate_gj_mwh":  7.2, "cf": 0.55, "lifetime_yr": 30, "co2_factor_t_mwh": 0.490, "existing_gw":  5.0 },
    "hydro":   { "capex_mw": 2_500_000, "fopex_mw_yr": 15_000, "vopex_mwh": 2,  "fuel_cost_gj": 0,   "heat_rate_gj_mwh":  0.0, "cf": 0.40, "lifetime_yr": 60, "co2_factor_t_mwh": 0.000, "existing_gw":  2.7 },
    "wind":    { "capex_mw": 1_400_000, "fopex_mw_yr": 25_000, "vopex_mwh": 3,  "fuel_cost_gj": 0,   "heat_rate_gj_mwh":  0.0, "cf": 0.30, "lifetime_yr": 25, "co2_factor_t_mwh": 0.000, "existing_gw":  1.4 },
    "solar":   { "capex_mw":   900_000, "fopex_mw_yr": 10_000, "vopex_mwh": 2,  "fuel_cost_gj": 0,   "heat_rate_gj_mwh":  0.0, "cf": 0.22, "lifetime_yr": 25, "co2_factor_t_mwh": 0.000, "existing_gw":  1.1 },
    "nuclear": { "capex_mw": 5_000_000, "fopex_mw_yr": 70_000, "vopex_mwh": 8,  "fuel_cost_gj": 0.5, "heat_rate_gj_mwh": 10.4, "cf": 0.90, "lifetime_yr": 60, "co2_factor_t_mwh": 0.000, "existing_gw":  0.0 },
}

DISCOUNT_RATE = 0.08


def run_lp_optimization(
    demand_twh: float,
    scenario: str = "MT",
    year: int = 2035,
    renewables_target: float = 0.15,
    co2_budget_mt: Optional[float] = None,
    nuclear_available_gw: float = 0.0,
) -> Dict:

    prob   = pulp.LpProblem("KZLEAP_Dispatch", pulp.LpMinimize)
    techs  = list(TECHNOLOGIES.keys())
    gen     = {t: pulp.LpVariable(f"gen_{t}",     lowBound=0) for t in techs}
    cap_new = {t: pulp.LpVariable(f"cap_new_{t}", lowBound=0) for t in techs}

    # Objective
    cost_terms = []
    for t in techs:
        p = TECHNOLOGIES[t]
        var_cost  = (p["vopex_mwh"] + p["fuel_cost_gj"] * p["heat_rate_gj_mwh"] * 1000) * 1_000_000
        ann_capex = p["capex_mw"] * (DISCOUNT_RATE / (1 - (1 + DISCOUNT_RATE) ** -p["lifetime_yr"]))
        fix_cost  = (ann_capex + p["fopex_mw_yr"]) * 1000
        cost_terms += [var_cost * gen[t], fix_cost * cap_new[t]]
    prob += pulp.lpSum(cost_terms)

    total = pulp.lpSum(gen[t] for t in techs)

    prob += total >= demand_twh * 1.10, "Demand"

    for t in techs:
        p      = TECHNOLOGIES[t]
        base   = nuclear_available_gw if t == "nuclear" else p["existing_gw"]
        max_tw = (base + cap_new[t]) * p["cf"] * 8760 / 1000
        prob  += gen[t] <= max_tw, f"Cap_{t}"

    re_techs = ["wind", "solar", "hydro"]
    prob += pulp.lpSum(gen[t] for t in re_techs) >= renewables_target * total, "RE_Min"

    if co2_budget_mt is not None:
        prob += pulp.lpSum(gen[t] * TECHNOLOGIES[t]["co2_factor_t_mwh"] / 1e6 for t in techs) <= co2_budget_mt, "CO2"

    prob += cap_new["hydro"] <= 1.0, "Hydro_Exp"

    if nuclear_available_gw == 0.0:
        prob += cap_new["nuclear"] == 0, "No_Nuc_New"
        prob += gen["nuclear"]     == 0, "No_Nuc_Gen"

    prob += gen["solar"]  <= 0.35 * total, "Solar_Max_35pct"
    prob += gen["wind"]   <= 0.25 * total, "Wind_Max_25pct"
    prob += gen["hydro"]  <= 0.15 * total, "Hydro_Max_15pct"
    prob += gen["nuclear"]<= 0.20 * total, "Nuclear_Max_20pct"
    prob += pulp.lpSum(gen[t] for t in re_techs) <= 0.70 * total, "RE_Max_70pct"
    prob += gen["coal"]   >= 0.10 * total, "Coal_Min_10pct"
    prob += gen["gas"]    >= 0.08 * total, "Gas_Min_8pct"

    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    if pulp.LpStatus[prob.status] not in ("Optimal", "Feasible"):
        return {"error": f"LP infeasible: {pulp.LpStatus[prob.status]}"}

    tot = sum(pulp.value(gen[t]) or 0 for t in techs)
    mix = {}
    for t in techs:
        g = pulp.value(gen[t]) or 0
        mix[t] = {
            "generation_twh":  round(g, 2),
            "share_pct":       round(g / tot * 100, 1) if tot > 0 else 0,
            "new_capacity_gw": round(pulp.value(cap_new[t]) or 0, 2),
            "co2_mt":          round(g * TECHNOLOGIES[t]["co2_factor_t_mwh"] / 1e6, 2),
        }

    re_gen = sum(mix[t]["generation_twh"] for t in re_techs)
    co2_tot = sum(mix[t]["co2_mt"] for t in techs)

    return {
        "status": pulp.LpStatus[prob.status], "year": year, "scenario": scenario,
        "demand_twh": demand_twh, "total_gen_twh": round(tot, 1),
        "total_co2_mt": round(co2_tot, 2),
        "total_cost_bn_usd": round(pulp.value(prob.objective) / 1e9, 2),
        "mix": mix,
        "re_share_pct": round(re_gen / tot * 100, 1) if tot > 0 else 0,
        "lcoe_estimate_usd_mwh": round(pulp.value(prob.objective) / (tot * 1e6), 1) if tot > 0 else 0,
    }
