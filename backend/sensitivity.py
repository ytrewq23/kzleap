import pulp
import copy
from typing import Dict, List, Optional


def run_sensitivity_analysis(
    base_demand_twh: float,
    scenario: str,
    year: int,
    renewables_target: float,
    nuclear_available_gw: float,
    technologies: dict,
    discount_rate: float,
    shocks: List[Dict],
) -> Dict:

    _solve_counter = [0]

    def _solve(
        tech_overrides: dict,
        demand_twh: float,
        carbon_price_usd_t: float = 0.0,
        relax_fossil_floors: bool = False,
    ):
        _solve_counter[0] += 1
        uid = _solve_counter[0]

        techs_local = copy.deepcopy(technologies)
        for key, val in tech_overrides.items():
            t, param = key.split(".", 1)
            if t in techs_local:
                techs_local[t][param] = val

        prob    = pulp.LpProblem(f"SA_{uid}", pulp.LpMinimize)
        techs   = list(techs_local.keys())
        gen     = {t: pulp.LpVariable(f"gen_{t}_{uid}",     lowBound=0) for t in techs}
        cap_new = {t: pulp.LpVariable(f"cap_new_{t}_{uid}", lowBound=0) for t in techs}

        cost_terms = []
        for t in techs:
            p         = techs_local[t]
            var_cost  = (p["vopex_mwh"] + p["fuel_cost_gj"] * p["heat_rate_gj_mwh"] * 1000) * 1_000_000
            ann_capex = p["capex_mw"] * (discount_rate / (1 - (1 + discount_rate) ** -p["lifetime_yr"]))
            fix_cost  = (ann_capex + p["fopex_mw_yr"]) * 1000
            co2_cost  = carbon_price_usd_t * p["co2_factor_t_mwh"] * 1_000_000
            cost_terms += [
                (var_cost + co2_cost) * gen[t],
                fix_cost * cap_new[t],
            ]
        prob += pulp.lpSum(cost_terms)

        total = pulp.lpSum(gen[t] for t in techs)
        prob += total >= demand_twh * 1.10, "Demand"

        for t in techs:
            p    = techs_local[t]
            base = nuclear_available_gw if t == "nuclear" else p["existing_gw"]
            prob += gen[t] <= (base + cap_new[t]) * p["cf"] * 8760 / 1000, f"Cap_{t}"

        re_techs = ["wind", "solar", "hydro"]
        prob += pulp.lpSum(gen[t] for t in re_techs) >= renewables_target * total, "RE_Min"
        prob += cap_new["hydro"] <= 1.0, "Hydro_Exp"

        if nuclear_available_gw == 0.0:
            prob += cap_new["nuclear"] == 0, "No_Nuc_New"
            prob += gen["nuclear"]     == 0, "No_Nuc_Gen"

        # Oil: только существующие мощности, новые не строятся
        if "oil" in techs_local:
            prob += cap_new["oil"] == 0,          "Oil_No_New"
            prob += gen["oil"]     <= 0.08 * total, "Oil_Max"

        prob += gen["hydro"]   <= 0.15 * total, "Hydro_Max"
        prob += gen["nuclear"] <= 0.20 * total, "Nuclear_Max"

        if relax_fossil_floors:
            re_ceiling = min(0.85 + carbon_price_usd_t / 300, 0.92)
            solar_ceil = min(0.50 + carbon_price_usd_t / 500, 0.60)
            wind_ceil  = min(0.40 + carbon_price_usd_t / 600, 0.50)
            coal_floor = max(0.05 - carbon_price_usd_t / 800,  0.01)
            gas_floor  = max(0.05 - carbon_price_usd_t / 1200, 0.01)
            prob += pulp.lpSum(gen[t] for t in re_techs) <= re_ceiling * total, "RE_Max"
            prob += gen["solar"] <= solar_ceil * total, "Solar_Max"
            prob += gen["wind"]  <= wind_ceil  * total, "Wind_Max"
            prob += gen["coal"]  >= coal_floor * total, "Coal_Min"
            prob += gen["gas"]   >= gas_floor  * total, "Gas_Min"
        else:
            prob += pulp.lpSum(gen[t] for t in re_techs) <= 0.70 * total, "RE_Max"
            prob += gen["solar"] <= 0.35 * total, "Solar_Max"
            prob += gen["wind"]  <= 0.25 * total, "Wind_Max"
            prob += gen["coal"]  >= 0.10 * total, "Coal_Min"
            prob += gen["gas"]   >= 0.08 * total, "Gas_Min"

        prob.solve(pulp.PULP_CBC_CMD(msg=0))

        if pulp.LpStatus[prob.status] not in ("Optimal", "Feasible"):
            return None

        tot     = sum(pulp.value(gen[t]) or 0 for t in techs)
        co2_tot = sum((pulp.value(gen[t]) or 0) * techs_local[t]["co2_factor_t_mwh"] for t in techs)
        re_gen  = sum((pulp.value(gen[t]) or 0) for t in re_techs)
        oil_gen = (pulp.value(gen["oil"]) or 0) if "oil" in techs_local else 0.0
        fossil_gen = sum(
            (pulp.value(gen[t]) or 0)
            for t in ("coal", "gas", "oil")
            if t in techs_local
        )

        mix = {}
        for t in techs:
            g = pulp.value(gen[t]) or 0
            mix[t] = {
                "generation_twh":  round(g, 2),
                "share_pct":       round(g / tot * 100, 1) if tot > 0 else 0,
                "new_capacity_gw": round(pulp.value(cap_new[t]) or 0, 2),
                "co2_mt":          round(g * techs_local[t]["co2_factor_t_mwh"], 2),
            }

        return {
            "total_cost_bn_usd": round(pulp.value(prob.objective) / 1e9, 3),
            "total_co2_mt":      round(co2_tot, 2),
            "re_share_pct":      round(re_gen    / tot * 100, 1) if tot > 0 else 0,
            "oil_share_pct":     round(oil_gen   / tot * 100, 1) if tot > 0 else 0,
            "fossil_share_pct":  round(fossil_gen / tot * 100, 1) if tot > 0 else 0,
            "lcoe_usd_mwh":      round(pulp.value(prob.objective) / (tot * 1e6), 2) if tot > 0 else 0,
            "total_gen_twh":     round(tot, 1),
            "mix":               mix,
        }

    # ── Маппинг параметров шоков → (технология, поле) ──────────────────────
    PARAM_MAP = {
        "gas_fuel_cost":  ("gas",     "fuel_cost_gj"),
        "coal_fuel_cost": ("coal",    "fuel_cost_gj"),
        "oil_fuel_cost":  ("oil",     "fuel_cost_gj"),   # нефть
        "solar_capex":    ("solar",   "capex_mw"),
        "wind_capex":     ("wind",    "capex_mw"),
        "nuclear_capex":  ("nuclear", "capex_mw"),
        "coal_capex":     ("coal",    "capex_mw"),
        "oil_capex":      ("oil",     "capex_mw"),        # нефть
    }

    # ── Baseline ────────────────────────────────────────────────────────────
    baseline = _solve({}, base_demand_twh)
    if baseline is None:
        return {"error": "Baseline LP infeasible"}

    # ── Шоки ────────────────────────────────────────────────────────────────
    results = []
    for shock in shocks:
        param     = shock["param"]
        delta_pct = shock.get("delta_pct", 0.0) or 0.0

        if param == "demand":
            shocked_demand = base_demand_twh * (1 + delta_pct / 100)
            result = _solve({}, shocked_demand, relax_fossil_floors=True)

        elif param == "carbon_price":
            carbon_usd_t = float(shock.get("value") or 0.0)
            result = _solve(
                {},
                base_demand_twh,
                carbon_price_usd_t=carbon_usd_t,
                relax_fossil_floors=True,
            )

        elif param in PARAM_MAP:
            t, field = PARAM_MAP[param]
            # Если технологии нет в словаре (например, oil не добавлен) — пропускаем
            if t not in technologies:
                continue
            base_val = technologies[t][field]
            new_val  = base_val * (1 + delta_pct / 100)
            result   = _solve({f"{t}.{field}": new_val}, base_demand_twh, relax_fossil_floors=True)

        else:
            continue

        if result is None:
            result = {"error": "infeasible"}

        co2_base  = baseline["total_co2_mt"]
        lcoe_base = baseline["lcoe_usd_mwh"]

        # Дельта по нефти (pp)
        oil_delta_ppt = None
        if "error" not in result and "oil_share_pct" in result and "oil_share_pct" in baseline:
            oil_delta_ppt = round(result["oil_share_pct"] - baseline["oil_share_pct"], 1)

        results.append({
            "param":          param,
            "delta_pct":      delta_pct,
            "label":          shock.get("label", f"{param} {delta_pct:+.0f}%"),
            "result":         result,
            "cost_delta_pct": round((result.get("total_cost_bn_usd", 0) / baseline["total_cost_bn_usd"] - 1) * 100, 1)
                              if "error" not in result else None,
            "co2_delta_pct":  round((result.get("total_co2_mt", 0) / co2_base - 1) * 100, 1)
                              if "error" not in result and co2_base > 0 else None,
            "re_delta_ppt":   round(result.get("re_share_pct", 0) - baseline["re_share_pct"], 1)
                              if "error" not in result else None,
            "oil_delta_ppt":  oil_delta_ppt,
            "lcoe_delta_pct": round((result.get("lcoe_usd_mwh", 0) / lcoe_base - 1) * 100, 1)
                              if "error" not in result and lcoe_base > 0 else None,
        })

    return {
        "scenario": scenario,
        "year":     year,
        "baseline": baseline,
        "shocks":   results,
    }