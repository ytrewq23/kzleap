import pulp
import copy
import numpy as np
from typing import Dict, List, Optional


TECHNOLOGIES = {
    "coal":    { "capex_mw": 1_200_000, "fopex_mw_yr": 30_000, "vopex_mwh": 5,  "fuel_cost_gj": 2,   "heat_rate_gj_mwh": 10.5, "cf": 0.65, "lifetime_yr": 35, "co2_factor_t_mwh": 0.820, "co2_lifecycle_t_mwh": 0.900, "existing_gw": 14.0 },
    "gas":     { "capex_mw":   900_000, "fopex_mw_yr": 18_000, "vopex_mwh": 4,  "fuel_cost_gj": 5,   "heat_rate_gj_mwh":  7.2, "cf": 0.55, "lifetime_yr": 30, "co2_factor_t_mwh": 0.490, "co2_lifecycle_t_mwh": 0.530, "existing_gw":  5.0 },
    "hydro":   { "capex_mw": 2_500_000, "fopex_mw_yr": 15_000, "vopex_mwh": 2,  "fuel_cost_gj": 0,   "heat_rate_gj_mwh":  0.0, "cf": 0.40, "lifetime_yr": 60, "co2_factor_t_mwh": 0.000, "co2_lifecycle_t_mwh": 0.024, "existing_gw":  2.7 },
    "wind":    { "capex_mw": 1_400_000, "fopex_mw_yr": 25_000, "vopex_mwh": 3,  "fuel_cost_gj": 0,   "heat_rate_gj_mwh":  0.0, "cf": 0.30, "lifetime_yr": 25, "co2_factor_t_mwh": 0.000, "co2_lifecycle_t_mwh": 0.013, "existing_gw":  1.4 },
    "solar":   { "capex_mw":   900_000, "fopex_mw_yr": 10_000, "vopex_mwh": 2,  "fuel_cost_gj": 0,   "heat_rate_gj_mwh":  0.0, "cf": 0.22, "lifetime_yr": 25, "co2_factor_t_mwh": 0.000, "co2_lifecycle_t_mwh": 0.041, "existing_gw":  1.1 },
    "nuclear": { "capex_mw": 5_000_000, "fopex_mw_yr": 70_000, "vopex_mwh": 8,  "fuel_cost_gj": 0.5, "heat_rate_gj_mwh": 10.4, "cf": 0.90, "lifetime_yr": 60, "co2_factor_t_mwh": 0.000, "co2_lifecycle_t_mwh": 0.012, "existing_gw":  0.0 },
}

DISCOUNT_RATE = 0.08
TECH_LABELS = {
    "coal": "Coal", "gas": "Natural Gas", "hydro": "Hydro",
    "wind": "Wind", "solar": "Solar PV", "nuclear": "Nuclear",
}


def _annuity_factor(r, n):
    return r / (1 - (1 + r) ** -n)


def _solve_lp(demand_twh, renewables_target, nuclear_available_gw,
              budget_usd=None, priority="cost",
              tech_overrides=None, uid=0):
    techs_local = copy.deepcopy(TECHNOLOGIES)
    if tech_overrides:
        for t, overrides in tech_overrides.items():
            techs_local[t].update(overrides)

    prob    = pulp.LpProblem(f"IP_{uid}", pulp.LpMinimize)
    techs   = list(techs_local.keys())
    gen     = {t: pulp.LpVariable(f"gen_{t}_{uid}",     lowBound=0) for t in techs}
    cap_new = {t: pulp.LpVariable(f"cap_new_{t}_{uid}", lowBound=0) for t in techs}

    cost_terms = []
    for t in techs:
        p = techs_local[t]
        var_cost  = (p["vopex_mwh"] + p["fuel_cost_gj"] * p["heat_rate_gj_mwh"] * 1000) * 1_000_000
        ann_capex = p["capex_mw"] * _annuity_factor(DISCOUNT_RATE, p["lifetime_yr"])
        fix_cost  = (ann_capex + p["fopex_mw_yr"]) * 1000
        cost_terms += [var_cost * gen[t], fix_cost * cap_new[t]]

    if priority == "co2":
        prob += pulp.lpSum(gen[t] * techs_local[t]["co2_factor_t_mwh"] for t in techs)
    elif priority == "re":
        re_techs_inner = ["wind", "solar", "hydro"]
        prob += -pulp.lpSum(gen[t] for t in re_techs_inner)
    else:
        prob += pulp.lpSum(cost_terms)

    total = pulp.lpSum(gen[t] for t in techs)
    prob += total >= demand_twh * 1.10, "Demand"

    re_ceiling  = min(max(renewables_target + 0.05, 0.70), 0.92)
    solar_ceil  = min(0.35 + max(renewables_target - 0.40, 0) * 0.8, 0.55)
    wind_ceil   = min(0.25 + max(renewables_target - 0.40, 0) * 0.6, 0.42)
    coal_floor  = max(0.10 - max(renewables_target - 0.50, 0) * 0.8, 0.01)
    gas_floor   = max(0.08 - max(renewables_target - 0.50, 0) * 0.6, 0.01)

    for t in techs:
        p    = techs_local[t]
        base = nuclear_available_gw if t == "nuclear" else p["existing_gw"]
        prob += gen[t] <= (base + cap_new[t]) * p["cf"] * 8760 / 1000, f"Cap_{t}"

    re_techs = ["wind", "solar", "hydro"]
    prob += pulp.lpSum(gen[t] for t in re_techs) >= renewables_target * total, "RE_Min"
    prob += pulp.lpSum(gen[t] for t in re_techs) <= re_ceiling * total, "RE_Max"
    prob += cap_new["hydro"]   <= 1.0,             "Hydro_Exp"
    prob += gen["solar"]       <= solar_ceil * total, "Solar_Max"
    prob += gen["wind"]        <= wind_ceil  * total, "Wind_Max"
    prob += gen["hydro"]       <= 0.15 * total,    "Hydro_Max"
    prob += gen["nuclear"]     <= 0.20 * total,    "Nuclear_Max"
    prob += gen["coal"]        >= coal_floor * total, "Coal_Min"
    prob += gen["gas"]         >= gas_floor  * total, "Gas_Min"

    if nuclear_available_gw == 0.0:
        prob += cap_new["nuclear"] == 0, "No_Nuc_New"
        prob += gen["nuclear"]     == 0, "No_Nuc_Gen"

    if budget_usd is not None:
        capex_total = pulp.lpSum(cap_new[t] * 1000 * techs_local[t]["capex_mw"] for t in techs)
        prob += capex_total <= budget_usd, "Budget"

    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    if pulp.LpStatus[prob.status] not in ("Optimal", "Feasible"):
        return None

    tot      = sum(pulp.value(gen[t]) or 0 for t in techs)
    co2_tot  = sum((pulp.value(gen[t]) or 0) * techs_local[t]["co2_factor_t_mwh"] for t in techs)
    re_gen   = sum((pulp.value(gen[t]) or 0) for t in re_techs)
    capex_used = sum((pulp.value(cap_new[t]) or 0) * 1000 * techs_local[t]["capex_mw"] for t in techs)
    op_cost  = pulp.value(prob.objective) if priority == "cost" else sum(
        ((techs_local[t]["vopex_mwh"] + techs_local[t]["fuel_cost_gj"] * techs_local[t]["heat_rate_gj_mwh"] * 1000) * 1_000_000 * (pulp.value(gen[t]) or 0) +
         (_annuity_factor(DISCOUNT_RATE, techs_local[t]["lifetime_yr"]) * techs_local[t]["capex_mw"] + techs_local[t]["fopex_mw_yr"]) * 1000 * (pulp.value(cap_new[t]) or 0))
        for t in techs
    )

    mix = {}
    for t in techs:
        g  = pulp.value(gen[t]) or 0
        cn = pulp.value(cap_new[t]) or 0
        p  = techs_local[t]
        ann_capex = p["capex_mw"] * _annuity_factor(DISCOUNT_RATE, p["lifetime_yr"])
        ann_cost  = (ann_capex + p["fopex_mw_yr"]) * 1000 * cn + \
                    (p["vopex_mwh"] + p["fuel_cost_gj"] * p["heat_rate_gj_mwh"] * 1000) * 1_000_000 * g
        mix[t] = {
            "generation_twh":  round(g, 2),
            "share_pct":       round(g / tot * 100, 1) if tot > 0 else 0,
            "new_capacity_gw": round(cn, 3),
            "capex_bn_usd":    round(cn * 1000 * p["capex_mw"] / 1e9, 3),
            "co2_mt":          round(g * p["co2_factor_t_mwh"], 3),
            "annual_cost_bn":  round(ann_cost / 1e9, 3),
            "lcoe_usd_mwh":    round(ann_cost / (g * 1e6), 1) if g > 0 else 0,
        }

    return {
        "status":          pulp.LpStatus[prob.status],
        "total_gen_twh":   round(tot, 1),
        "total_co2_mt":    round(co2_tot, 3),
        "re_share_pct":    round(re_gen / tot * 100, 1) if tot > 0 else 0,
        "total_cost_bn":   round(op_cost / 1e9, 2),
        "capex_used_bn":   round(capex_used / 1e9, 3),
        "lcoe_usd_mwh":    round(op_cost / (tot * 1e6), 1) if tot > 0 else 0,
        "mix":             mix,
    }


def _compute_mac(demand_twh, renewables_target, nuclear_available_gw, baseline_co2):
    mac_points = []
    uid_counter = [100]

    for tech in ["wind", "solar", "nuclear", "hydro"]:
        if tech == "nuclear" and nuclear_available_gw == 0:
            continue
        p = TECHNOLOGIES[tech]

        # Force 1 GW of this technology
        forced_gw = 1.0 if tech != "nuclear" else min(nuclear_available_gw, 2.0)
        overrides = {tech: {"existing_gw": TECHNOLOGIES[tech]["existing_gw"] + forced_gw}}

        uid_counter[0] += 1
        result = _solve_lp(demand_twh, renewables_target, nuclear_available_gw,
                           tech_overrides=overrides, uid=uid_counter[0])
        if result is None:
            continue

        co2_reduction = baseline_co2 - result["total_co2_mt"]
        capex_bn = forced_gw * 1000 * p["capex_mw"] / 1e9
        cost_change = result["total_cost_bn"] - 0

        if co2_reduction > 0:
            mac_usd_t = round((capex_bn * 1e9) / (co2_reduction * 1e6), 1)
        else:
            mac_usd_t = None

        mac_points.append({
            "technology":     TECH_LABELS[tech],
            "tech_key":       tech,
            "forced_gw":      forced_gw,
            "capex_bn_usd":   round(capex_bn, 3),
            "co2_reduction_mt": round(co2_reduction, 2),
            "mac_usd_per_t":  mac_usd_t,
            "lcoe_usd_mwh":   result["mix"][tech]["lcoe_usd_mwh"],
            "new_re_share":   result["re_share_pct"],
        })

    mac_points.sort(key=lambda x: (x["mac_usd_per_t"] is None, x["mac_usd_per_t"] or 999))
    return mac_points


def _monte_carlo(demand_twh, renewables_target, nuclear_available_gw,
                 budget_usd, priority, n_runs=80):
    rng = np.random.default_rng(42)
    results = []
    uid_base = 1000

    price_ranges = {
        "solar":   {"capex_mw": (0.70, 1.30)},
        "wind":    {"capex_mw": (0.80, 1.25)},
        "gas":     {"fuel_cost_gj": (0.60, 1.80)},
        "coal":    {"fuel_cost_gj": (0.70, 1.50)},
        "nuclear": {"capex_mw": (0.85, 1.20)},
    }

    for i in range(n_runs):
        overrides = {}
        for tech, params in price_ranges.items():
            overrides[tech] = {}
            for param, (lo, hi) in params.items():
                factor = rng.uniform(lo, hi)
                overrides[tech][param] = TECHNOLOGIES[tech][param] * factor

        r = _solve_lp(demand_twh, renewables_target, nuclear_available_gw,
                      budget_usd=budget_usd, priority=priority,
                      tech_overrides=overrides, uid=uid_base + i)
        if r:
            results.append({
                "co2_mt":       r["total_co2_mt"],
                "cost_bn":      r["total_cost_bn"],
                "re_share_pct": r["re_share_pct"],
                "lcoe_usd_mwh": r["lcoe_usd_mwh"],
            })

    if not results:
        return {}

    co2_vals  = [r["co2_mt"]       for r in results]
    cost_vals = [r["cost_bn"]      for r in results]
    re_vals   = [r["re_share_pct"] for r in results]
    lcoe_vals = [r["lcoe_usd_mwh"] for r in results]

    def pct(arr, p): return round(float(np.percentile(arr, p)), 2)

    return {
        "n_runs": len(results),
        "co2_mt": {
            "p10": pct(co2_vals, 10), "p50": pct(co2_vals, 50),
            "p90": pct(co2_vals, 90), "mean": round(float(np.mean(co2_vals)), 2),
            "std": round(float(np.std(co2_vals)), 2),
        },
        "cost_bn": {
            "p10": pct(cost_vals, 10), "p50": pct(cost_vals, 50),
            "p90": pct(cost_vals, 90), "mean": round(float(np.mean(cost_vals)), 2),
            "std": round(float(np.std(cost_vals)), 2),
        },
        "re_share_pct": {
            "p10": pct(re_vals, 10), "p50": pct(re_vals, 50),
            "p90": pct(re_vals, 90), "mean": round(float(np.mean(re_vals)), 1),
        },
        "lcoe_usd_mwh": {
            "p10": pct(lcoe_vals, 10), "p50": pct(lcoe_vals, 50),
            "p90": pct(lcoe_vals, 90), "mean": round(float(np.mean(lcoe_vals)), 1),
        },
    }


def run_investment_plan(
    budget_bn_usd: float,
    horizon_year: int,
    scenario: str,
    demand_twh: float,
    renewables_target: float,
    nuclear_available_gw: float,
    priority: str = "cost",
    run_monte_carlo: bool = True,
) -> Dict:
    budget_usd = budget_bn_usd * 1e9

    # 1. No-investment baseline
    baseline = _solve_lp(demand_twh, renewables_target, nuclear_available_gw,
                         budget_usd=0, uid=1)
    if baseline is None:
        baseline = _solve_lp(demand_twh, renewables_target, nuclear_available_gw, uid=2)

    # 2. Optimal plan within budget
    optimal = _solve_lp(demand_twh, renewables_target, nuclear_available_gw,
                        budget_usd=budget_usd, priority=priority, uid=3)
    if optimal is None:
        return {"error": "LP infeasible with given budget and constraints"}

    # 3. Unconstrained optimum (no budget limit)
    unconstrained = _solve_lp(demand_twh, renewables_target, nuclear_available_gw,
                               priority=priority, uid=4)

    # 4. Budget efficiency curve — solve at 10%, 25%, 50%, 75%, 100%, 150% of budget
    efficiency_curve = []
    for frac in [0.0, 0.10, 0.25, 0.50, 0.75, 1.00, 1.50, 2.00]:
        r = _solve_lp(demand_twh, renewables_target, nuclear_available_gw,
                      budget_usd=budget_usd * frac if frac > 0 else 0,
                      priority=priority, uid=int(10 + frac * 100))
        if r:
            efficiency_curve.append({
                "budget_frac":   frac,
                "budget_bn_usd": round(budget_bn_usd * frac, 2),
                "co2_mt":        r["total_co2_mt"],
                "re_share_pct":  r["re_share_pct"],
                "cost_bn":       r["total_cost_bn"],
                "lcoe_usd_mwh":  r["lcoe_usd_mwh"],
                "capex_used_bn": r["capex_used_bn"],
            })

    # 5. Technology investment breakdown
    investments = []
    if optimal:
        for tech, v in optimal["mix"].items():
            if v["new_capacity_gw"] > 0.001:
                p = TECHNOLOGIES[tech]
                lifetime = p["lifetime_yr"]
                capex    = v["capex_bn_usd"] * 1e9
                ann_savings = (baseline["mix"][tech]["annual_cost_bn"] if baseline else 0) * 1e9
                npv  = -capex + sum(ann_savings / (1 + DISCOUNT_RATE) ** yr for yr in range(1, lifetime + 1))
                irr_approx = ann_savings / capex if capex > 0 else 0
                co2_avoided = ((baseline["mix"][tech]["co2_mt"] if baseline else 0) - v["co2_mt"])
                mac = round(v["capex_bn_usd"] * 1e9 / (co2_avoided * 1e6), 1) if co2_avoided > 0.01 else None

                investments.append({
                    "technology":      TECH_LABELS[tech],
                    "tech_key":        tech,
                    "new_capacity_gw": v["new_capacity_gw"],
                    "capex_bn_usd":    v["capex_bn_usd"],
                    "generation_twh":  v["generation_twh"],
                    "lcoe_usd_mwh":    v["lcoe_usd_mwh"],
                    "co2_avoided_mt":  round(co2_avoided, 3),
                    "mac_usd_per_t":   mac,
                    "npv_bn_usd":      round(npv / 1e9, 2),
                    "irr_approx_pct":  round(irr_approx * 100, 1),
                    "payback_yr":      round(capex / ann_savings, 1) if ann_savings > 0 else None,
                })
        investments.sort(key=lambda x: (x["mac_usd_per_t"] is None, x["mac_usd_per_t"] or 999))

    # 6. MAC curve
    baseline_co2 = baseline["total_co2_mt"] if baseline else 20.0
    mac_curve = _compute_mac(demand_twh, renewables_target, nuclear_available_gw, baseline_co2)

    # 7. Monte Carlo
    mc_results = {}
    if run_monte_carlo:
        mc_results = _monte_carlo(demand_twh, renewables_target, nuclear_available_gw,
                                   budget_usd, priority)

    co2_avoided_total = round((baseline["total_co2_mt"] - optimal["total_co2_mt"]), 2) if baseline else 0
    cost_per_t_avoided = round(budget_bn_usd * 1e9 / (co2_avoided_total * 1e6), 1) if co2_avoided_total > 0 else None

    return {
        "scenario":             scenario,
        "horizon_year":         horizon_year,
        "budget_bn_usd":        budget_bn_usd,
        "priority":             priority,
        "demand_twh":           demand_twh,
        "baseline":             baseline,
        "optimal":              optimal,
        "unconstrained":        unconstrained,
        "co2_avoided_mt":       co2_avoided_total,
        "re_gain_ppt":          round(optimal["re_share_pct"] - (baseline["re_share_pct"] if baseline else 0), 1),
        "cost_per_t_avoided":   cost_per_t_avoided,
        "budget_utilization_pct": round(optimal["capex_used_bn"] / budget_bn_usd * 100, 1) if budget_bn_usd > 0 else 0,
        "investments":          investments,
        "mac_curve":            mac_curve,
        "efficiency_curve":     efficiency_curve,
        "monte_carlo":          mc_results,
    }
