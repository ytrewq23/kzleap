import numpy as np
from typing import Dict, List, Optional

HISTORICAL_TPES = {
    1990: 105.0, 1995: 75.0,  2000: 57.0,  2005: 68.0,
    2010: 74.0,  2015: 77.0,  2018: 76.0,  2020: 78.0,
    2021: 81.0,  2022: 83.0,  2023: 85.0,
}

HISTORICAL_ELEC = {
    1990: 87.4,  1995: 67.0,  2000: 51.6,  2005: 67.9,
    2010: 82.6,  2015: 90.8,  2020: 107.0, 2021: 109.0,
    2022: 112.0, 2023: 115.0,
}

HISTORICAL_CO2 = {
    1990: 290.0, 1995: 200.0, 2000: 140.0, 2005: 200.0,
    2010: 230.0, 2015: 250.0, 2018: 260.0, 2020: 235.0,
    2021: 245.0, 2022: 240.0, 2023: 242.0,
}

HISTORICAL_GDP = {
    1990: 26.0,  2000: 18.3,  2005: 57.1,  2010: 148.1,
    2015: 184.4, 2020: 171.1, 2022: 220.6, 2023: 261.4, 2024: 288.4,
}

HISTORICAL_POP = {
    1990: 16.5, 1995: 15.7, 2000: 14.9, 2005: 15.2,
    2010: 16.2, 2015: 17.7, 2020: 19.0, 2023: 20.1, 2024: 20.3,
}

ELEC_MIX_2023 = {
    "coal": 61.0, "gas": 24.0, "hydro": 10.0,
    "wind": 3.5,  "solar": 1.5, "nuclear": 0.0,
}

NDC_TARGET_2030_PCT      = -15
NDC_CONDITIONAL_2030_PCT = -25
CARBON_NEUTRALITY_YEAR   = 2060
BASE_YEAR_1990_CO2       = 290.0

SCENARIOS = {
    "BAU": {
        "name": "Business as Usual",
        "description": "Current policy settings, no new climate measures. Coal dominance persists.",
        "gdp_growth": 0.040, "energy_intensity_change": -0.010,
        "coal_share_2050": 0.45, "renewables_2030": 0.08, "renewables_2050": 0.15,
        "nuclear_gw_2035": 0.0, "co2_price_2030": 5, "co2_price_2050": 10, "ev_share_2050": 0.10,
    },
    "MT": {
        "name": "Moderate Transition",
        "description": "NDC targets implemented. Gradual coal phase-down. Nuclear by 2035.",
        "gdp_growth": 0.042, "energy_intensity_change": -0.020,
        "coal_share_2050": 0.25, "renewables_2030": 0.15, "renewables_2050": 0.40,
        "nuclear_gw_2035": 1.2, "co2_price_2030": 20, "co2_price_2050": 50, "ev_share_2050": 0.30,
    },
    "DD": {
        "name": "Deep Decarbonization",
        "description": "Carbon neutrality by 2060. Accelerated renewables, coal phase-out by 2045.",
        "gdp_growth": 0.043, "energy_intensity_change": -0.030,
        "coal_share_2050": 0.05, "renewables_2030": 0.22, "renewables_2050": 0.70,
        "nuclear_gw_2035": 2.4, "co2_price_2030": 50, "co2_price_2050": 150, "ev_share_2050": 0.80,
    },
}

DEMOGRAPHIC_DATA = {
    "population":     {1990: 16.5, 1995: 15.7, 2000: 14.9, 2005: 15.2,
                       2010: 16.2, 2015: 17.7, 2020: 19.0, 2023: 20.1, 2024: 20.3},
    "working_age_pct":{1990: 61.0, 1995: 62.0, 2000: 63.5, 2005: 65.0,
                       2010: 67.0, 2015: 68.5, 2020: 67.0, 2023: 66.5},
    "urban_pct":      {1990: 57.0, 1995: 55.5, 2000: 55.0, 2005: 53.5,
                       2010: 53.5, 2015: 53.5, 2020: 57.5, 2023: 58.0},
    "gdp_per_capita": {1990: 1.6,  2000: 1.2,  2005: 3.7,  2010: 9.1,
                       2015: 10.5, 2020: 9.0,  2023: 13.0, 2024: 14.2},
}

DEMO_PROJECTIONS = {
    "BAU": {"pop_growth": 0.012, "urbanization_rate": 0.003, "working_age_2050": 64.0},
    "MT":  {"pop_growth": 0.011, "urbanization_rate": 0.004, "working_age_2050": 63.5},
    "DD":  {"pop_growth": 0.010, "urbanization_rate": 0.005, "working_age_2050": 63.0},
}
_ACTIVE_DATASET  = None
_BASE_CO2        = 242.0
_BASE_ELEC       = 115.0
_BASE_TPES       = 85.0
_BASE_POP        = 20.1
_BASE_URBAN      = 58.0
_BASE_WORKING    = 66.5
_BASE_GDP_PC     = 13.0
_BASE_YEAR       = 2023
_NON_POWER_COEFF = None 


def _calc_non_power_coeff(base_co2, base_elec, elec_mix):
    #non_power = base_co2 - power_co2(base_year)
    
    coal = elec_mix.get("coal", 61.0) / 100
    gas  = elec_mix.get("gas",  24.0) / 100
    power_co2  = base_elec * coal * 0.82 + base_elec * gas * 0.49
    non_power  = max(base_co2 - power_co2, base_co2 * 0.3)
    return non_power / base_co2


def _refresh_base_values():
    global _BASE_CO2, _BASE_ELEC, _BASE_TPES, _BASE_POP, _BASE_URBAN
    global _BASE_WORKING, _BASE_GDP_PC, _BASE_YEAR, _NON_POWER_COEFF

    if HISTORICAL_CO2:
        last          = max(HISTORICAL_CO2.keys())
        _BASE_YEAR    = last
        _BASE_CO2     = HISTORICAL_CO2.get(last, 242.0)
        _BASE_ELEC    = HISTORICAL_ELEC.get(last, 115.0)
        _BASE_TPES    = HISTORICAL_TPES.get(last, 85.0)
        _BASE_POP     = HISTORICAL_POP.get(last, 20.1) if HISTORICAL_POP else 20.1
        _BASE_URBAN   = DEMOGRAPHIC_DATA.get("urban_pct", {}).get(last, 58.0)
        _BASE_WORKING = DEMOGRAPHIC_DATA.get("working_age_pct", {}).get(last, 66.5)
        _BASE_GDP_PC  = DEMOGRAPHIC_DATA.get("gdp_per_capita", {}).get(last, 13.0)

    _NON_POWER_COEFF = _calc_non_power_coeff(_BASE_CO2, _BASE_ELEC, ELEC_MIX_2023)


_refresh_base_values()


def load_excel_data(parsed: dict):
    global _ACTIVE_DATASET
    global HISTORICAL_TPES, HISTORICAL_ELEC, HISTORICAL_CO2
    global HISTORICAL_GDP, HISTORICAL_POP, ELEC_MIX_2023, SCENARIOS
    global BASE_YEAR_1990_CO2, NDC_TARGET_2030_PCT, NDC_CONDITIONAL_2030_PCT
    global CARBON_NEUTRALITY_YEAR, DEMOGRAPHIC_DATA

    _ACTIVE_DATASET = parsed

    if parsed.get("historical_tpes"):
        HISTORICAL_TPES = {int(k): float(v) for k, v in parsed["historical_tpes"].items() if v is not None}
    if parsed.get("historical_elec"):
        HISTORICAL_ELEC = {int(k): float(v) for k, v in parsed["historical_elec"].items() if v is not None}
    if parsed.get("historical_co2"):
        HISTORICAL_CO2  = {int(k): float(v) for k, v in parsed["historical_co2"].items()  if v is not None}
    if parsed.get("historical_gdp"):
        HISTORICAL_GDP  = {int(k): float(v) for k, v in parsed["historical_gdp"].items()  if v is not None}
    if parsed.get("historical_pop"):
        HISTORICAL_POP  = {int(k): float(v) for k, v in parsed["historical_pop"].items()  if v is not None}

    if parsed.get("elec_mix_base"):
        for key in ("coal", "gas", "hydro", "wind", "solar", "nuclear"):
            ELEC_MIX_2023.setdefault(key, 0.0)
        ELEC_MIX_2023.update({k: float(v) for k, v in parsed["elec_mix_base"].items()})

    if parsed.get("scenarios"):
        for key in ("BAU", "MT", "DD"):
            if key in parsed["scenarios"]:
                SCENARIOS[key].update(parsed["scenarios"][key])

    if parsed.get("ndc_targets"):
        ndc = parsed["ndc_targets"]
        BASE_YEAR_1990_CO2       = float(ndc.get("base_co2", BASE_YEAR_1990_CO2))
        NDC_TARGET_2030_PCT      = float(ndc.get("unconditional_2030_pct", NDC_TARGET_2030_PCT))
        NDC_CONDITIONAL_2030_PCT = float(ndc.get("conditional_2030_pct", NDC_CONDITIONAL_2030_PCT))
        CARBON_NEUTRALITY_YEAR   = int(ndc.get("neutrality_year", CARBON_NEUTRALITY_YEAR))

    for field, target_key in [
        ("historical_pop",         "population"),
        ("historical_working_age", "working_age_pct"),
        ("historical_urban",       "urban_pct"),
        ("historical_gdp",         "gdp_per_capita"),
    ]:
        if parsed.get(field):
            DEMOGRAPHIC_DATA[target_key] = {int(k): float(v)
                                            for k, v in parsed[field].items() if v is not None}

    _refresh_base_values()


def get_active_dataset_info():
    if _ACTIVE_DATASET is None:
        return {"source": "builtin", "filename": None}
    return {
        "source":    "excel",
        "filename":  _ACTIVE_DATASET.get("filename"),
        "base_year": _ACTIVE_DATASET.get("base_year"),
    }

def run_scenario(scenario_key: str, start_year: int = 2024, end_year: int = 2060) -> Dict:
    params    = SCENARIOS[scenario_key]
    years     = list(range(start_year, end_year + 1))
    base_co2  = _BASE_CO2
    base_elec = _BASE_ELEC
    base_tpes = _BASE_TPES
    base_year = _BASE_YEAR
    non_power_coeff = _NON_POWER_COEFF if _NON_POWER_COEFF is not None \
                      else _calc_non_power_coeff(base_co2, base_elec, ELEC_MIX_2023)

    coal_base  = ELEC_MIX_2023.get("coal",  61.0) / 100
    gas_base   = ELEC_MIX_2023.get("gas",   24.0) / 100
    hydro_base = ELEC_MIX_2023.get("hydro", 10.0) / 100
    re_base    = (ELEC_MIX_2023.get("wind", 3.5) + ELEC_MIX_2023.get("solar", 1.5)) / 100

    ndc_2030  = BASE_YEAR_1990_CO2 * (1 + NDC_TARGET_2030_PCT / 100)
    year_30   = base_year + 7
    year_50   = base_year + 27
    year_nuc  = base_year + 12

    results = {
        "scenario": scenario_key, "name": params["name"], "description": params["description"],
        "years": years,
        "tpes": [], "electricity": [], "co2": [], "renewables_share": [],
        "coal_share": [], "gas_share": [], "hydro_share": [], "wind_solar_share": [],
        "nuclear_share": [], "energy_demand": [], "ndc_gap": [],
        "installed_capacity": [], "coal_gw": [], "gas_gw": [], "renewables_gw": [], "nuclear_gw": [],
    }

    for year in years:
        t = year - base_year

        gdp_factor  = (1 + params["gdp_growth"]) ** t
        eff_factor  = (1 + params["energy_intensity_change"]) ** t
        tpes        = base_tpes * gdp_factor * eff_factor
        elec_demand = base_elec * (gdp_factor ** 0.75) * eff_factor

        results["tpes"].append(round(tpes, 1))
        results["electricity"].append(round(elec_demand, 1))

        # возобновляемые источники энергии
        re_t30 = params["renewables_2030"]
        re_t50 = params["renewables_2050"]
        if year <= year_30:
            re_share = re_base + (re_t30 - re_base) * (t / max(year_30 - base_year, 1))
        elif year <= year_50:
            re_share = re_t30 + (re_t50 - re_t30) * ((year - year_30) / max(year_50 - year_30, 1))
        else:
            re_share = re_t50 + (re_t50 * 0.05) * ((year - year_50) / 10)
        re_share = min(re_share, 0.85)

        # атомная энергия - растет за 10 лет
        if year >= year_nuc and params["nuclear_gw_2035"] > 0:
            nuc_ramp  = min((year - year_nuc) / 10, 1.0)
            nuc_share = min((params["nuclear_gw_2035"] * 1.1 * nuc_ramp) / max(elec_demand, 1) * 8760 / 1000, 0.15)
        else:
            nuc_share = 0.0

        hydro_share  = hydro_base
        fossil_share = max(1.0 - re_share - nuc_share - hydro_share, 0.05)

        coal_target   = params["coal_share_2050"]
        span_coal     = max(year_50 - base_year, 1)
        if year <= year_50:
            coal_fraction = coal_base + (coal_target - coal_base) * (t / span_coal)
        else:
            coal_fraction = coal_target + (0.0 - coal_target) * ((year - year_50) / 10)

        coal_share = max(min(coal_fraction, fossil_share), 0.0)
        gas_share  = max(fossil_share - coal_share, 0.0)

        results["renewables_share"].append(round(re_share    * 100, 1))
        results["coal_share"].append(      round(coal_share  * 100, 1))
        results["gas_share"].append(       round(gas_share   * 100, 1))
        results["hydro_share"].append(     round(hydro_share * 100, 1))
        results["wind_solar_share"].append(round(re_share    * 100, 1))
        results["nuclear_share"].append(   round(nuc_share   * 100, 1))

        
        coal_co2      = elec_demand * coal_share * 0.82 #коэффициент для угля, 820 кг со2/мегават час
        gas_co2       = elec_demand * gas_share  * 0.49 #коэффициент для газа, 490 кг со2/мегават час
        non_power_co2 = base_co2 * non_power_coeff * gdp_factor * eff_factor 
        co2           = coal_co2 + gas_co2 + non_power_co2 

        cp           = params["co2_price_2030"] if year <= year_30 else params["co2_price_2050"] #углеродный налог, снижение выбросов
        cp_reduction = max(1.0 - (cp / 1000) * 0.5, 0.5)
        co2         *= cp_reduction

        results["co2"].append(round(co2, 1))
        results["ndc_gap"].append(round(co2 - ndc_2030, 1) if year == year_30 else None)

        capacity_factor_avg = 0.45
        total_gw  = elec_demand / (capacity_factor_avg * 8.760)
        results["installed_capacity"].append(round(total_gw, 1))
        results["coal_gw"].append(round(total_gw * coal_share / 0.65, 1))
        results["gas_gw"].append( round(total_gw * gas_share  / 0.55, 1))
        results["renewables_gw"].append(round(total_gw * re_share / 0.25, 1))
        results["nuclear_gw"].append(params["nuclear_gw_2035"] if year >= year_nuc else 0.0)
        results["energy_demand"].append(round(tpes * 0.965, 1))

    return results


def get_historical_data() -> Dict:
    all_years = sorted(set(
        list(HISTORICAL_CO2.keys()) + list(HISTORICAL_ELEC.keys()) +
        list(HISTORICAL_TPES.keys()) + list(HISTORICAL_GDP.keys()) + list(HISTORICAL_POP.keys())
    ))
    return {
        "years":       all_years,
        "co2":         [HISTORICAL_CO2.get(y)  for y in all_years],
        "tpes":        [HISTORICAL_TPES.get(y) for y in all_years],
        "electricity": [HISTORICAL_ELEC.get(y) for y in all_years],
        "gdp":         [HISTORICAL_GDP.get(y)  for y in all_years],
        "population":  [HISTORICAL_POP.get(y)  for y in all_years],
        "elec_mix_2023": ELEC_MIX_2023,
        "ndc_targets": {
            "base_year":          1990,
            "base_co2":           BASE_YEAR_1990_CO2,
            "unconditional_2030": round(BASE_YEAR_1990_CO2 * (1 + NDC_TARGET_2030_PCT / 100), 1),
            "conditional_2030":   round(BASE_YEAR_1990_CO2 * (1 + NDC_CONDITIONAL_2030_PCT / 100), 1),
            "neutrality_year":    CARBON_NEUTRALITY_YEAR,
        },
        "base_year": _BASE_YEAR,
        "base_co2":  _BASE_CO2,
        "base_elec": _BASE_ELEC,
        "base_tpes": _BASE_TPES,
        "source":    "excel" if _ACTIVE_DATASET else "builtin",
    }


def compare_scenarios() -> Dict:
    results = {}
    for key in SCENARIOS:
        results[key] = run_scenario(key)

    recent_years = sorted(y for y in HISTORICAL_CO2 if y >= _BASE_YEAR - 4)
    hist_co2     = [HISTORICAL_CO2[y] for y in recent_years]

    for key in results:
        results[key]["hist_years"] = recent_years
        results[key]["hist_co2"]   = hist_co2

    results["_targets"] = {
        "ndc_unconditional_2030": round(BASE_YEAR_1990_CO2 * (1 + NDC_TARGET_2030_PCT / 100), 1),
        "ndc_conditional_2030":   round(BASE_YEAR_1990_CO2 * (1 + NDC_CONDITIONAL_2030_PCT / 100), 1),
        "neutrality_2060":        0.0,
    }
    return results


def run_scenario_with_demographics(scenario_key: str, start_year: int = 2024, end_year: int = 2060) -> dict:
    params    = SCENARIOS[scenario_key]
    demo      = DEMO_PROJECTIONS[scenario_key]
    years     = list(range(start_year, end_year + 1))
    base_year = _BASE_YEAR
    year_50   = base_year + 27

    base_pop     = _BASE_POP
    base_urban   = _BASE_URBAN
    base_working = _BASE_WORKING
    base_gdp_pc  = _BASE_GDP_PC
    base_elec_pc = (_BASE_ELEC * 1000) / max(_BASE_POP, 0.1)

    result = run_scenario(scenario_key, start_year, end_year)
    result.update({
        "population": [], "urban_pct": [], "working_age_pct": [],
        "gdp_per_capita": [], "elec_per_capita": [], "co2_per_capita": [],
        "residential_demand": [], "industry_demand": [], "transport_demand": [],
    })

    for i, year in enumerate(years):
        t = year - base_year
        #демография
        pop     = base_pop   * (1 + demo["pop_growth"]) ** t #рост населения
        urban   = min(base_urban + demo["urbanization_rate"] * t * 100, 80.0) #урбанизация, макс 80%
        working = base_working + (demo["working_age_2050"] - base_working) * (t / max(year_50 - base_year, 1))
        gdp_pc  = base_gdp_pc * (1 + params["gdp_growth"]) ** t

        urban_factor  = 1 + (urban - base_urban) / 100 * 0.5
        income_factor = (gdp_pc / max(base_gdp_pc, 0.1)) ** 0.6
        eff_factor    = (1 + params["energy_intensity_change"]) ** t

        elec_pc     = base_elec_pc * urban_factor * income_factor * eff_factor
        residential = pop * elec_pc * 0.25 / 1000

        industry_factor = (working / max(base_working, 0.1)) * ((gdp_pc / max(base_gdp_pc, 0.1)) ** 0.7) * eff_factor
        industry        = result["electricity"][i] * 0.45 * industry_factor

        ev_share       = params["ev_share_2050"] * min(t / max(year_50 - base_year, 1), 1.0)
        transport_base = pop * 0.8 * (gdp_pc / max(base_gdp_pc, 0.1)) ** 0.4
        transport      = transport_base * (1 - ev_share * 0.3) * eff_factor
        co2_pc         = result["co2"][i] / max(pop, 0.1)

        result["population"].append(round(pop, 2))
        result["urban_pct"].append(round(urban, 1))
        result["working_age_pct"].append(round(working, 1))
        result["gdp_per_capita"].append(round(gdp_pc, 1))
        result["elec_per_capita"].append(round(elec_pc, 0))
        result["co2_per_capita"].append(round(co2_pc, 2))
        result["residential_demand"].append(round(residential, 1))
        result["industry_demand"].append(round(industry, 1))
        result["transport_demand"].append(round(transport, 1))

    return result
