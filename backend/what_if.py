from __future__ import annotations
import os
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

router = APIRouter(prefix="/whatif", tags=["whatif"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))


class EnergyDataset:

    def __init__(self, path: Path):
        xl = pd.ExcelFile(path)

        def _parse(sheet: str, key_col: str) -> pd.DataFrame:
            # header=1 — первая строка шаблона это комментарий (#...), данные со второй
            df = xl.parse(sheet, header=1)
            if key_col in df.columns:
                df = df[df[key_col].notna()]
                df = df[~df[key_col].astype(str).str.startswith("#")]
            return df

        he = _parse("historical_energy", "Year")
        he["Year"] = pd.to_numeric(he["Year"], errors="coerce")
        he = he.dropna(subset=["Year"])
        he["Year"] = he["Year"].astype(int)
        self.hist = he.set_index("Year")

        hd = _parse("historical_demo", "Year")
        hd["Year"] = pd.to_numeric(hd["Year"], errors="coerce")
        hd = hd.dropna(subset=["Year"])
        hd["Year"] = hd["Year"].astype(int)
        self.demo = hd.set_index("Year")

        em = _parse("elec_mix", "Source")
        em = em.dropna(subset=["Source"])
        self.elec_mix: dict[str, float] = dict(
            zip(em["Source"].astype(str).str.strip(), pd.to_numeric(em["Share_pct"], errors="coerce").fillna(0))
        )

        sc = _parse("scenarios", "Parameter")
        sc = sc.dropna(subset=["Parameter"])
        sc = sc.set_index("Parameter")
        self.scenarios: dict[str, dict] = {}
        for col in ("BAU", "MT", "DD"):
            if col in sc.columns:
                self.scenarios[col] = sc[col].to_dict()

        ndc_df = _parse("ndc_targets", "Parameter")
        ndc_df = ndc_df.dropna(subset=["Parameter"])
        ndc = ndc_df.set_index("Parameter")["Value"]
        self.ndc = {
            "base_year":         int(ndc.get("base_year", 1990)),
            "base_co2_mt":       float(ndc.get("base_co2_mt", 290)),
            "unconditional_pct": float(ndc.get("ndc_unconditional_pct", -15)),
            "conditional_pct":   float(ndc.get("ndc_conditional_pct", -25)),
            "neutrality_year":   int(ndc.get("neutrality_year", 2060)),
        }

    @property
    def base_year(self) -> int:
        # базовый год = максимальный год в исторических данных
        return int(self.hist.index.max())

    @property
    def base_co2(self) -> float:
        return float(self.hist.loc[self.base_year, "CO2_Mt"])

    @property
    def base_elec(self) -> float:
        return float(self.hist.loc[self.base_year, "Electricity_TWh"])

    @property
    def base_tpes(self) -> float:
        return float(self.hist.loc[self.base_year, "TPES_Mtoe"])

    @property
    def base_gdp(self) -> float:
        yr = self.base_year
        if yr in self.demo.index and not pd.isna(self.demo.loc[yr, "GDP_USD_B"]):
            return float(self.demo.loc[yr, "GDP_USD_B"])
        return float(self.demo["GDP_USD_B"].dropna().iloc[-1])

    @property
    def coal_share(self) -> float:
        return self.elec_mix.get("coal", 61) / 100

    @property
    def re_share_base(self) -> float:
        mix = self.elec_mix
        return sum(mix.get(k, 0) for k in ("wind", "solar", "hydro")) / 100


def _get_dataset() -> EnergyDataset:
    # берём последний загруженный файл по времени изменения
    candidates = sorted(UPLOAD_DIR.glob("*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise HTTPException(status_code=404, detail="Нет загруженных данных. Сначала загрузите KZLEAP_DATA_TEMPLATE.xlsx")
    return EnergyDataset(candidates[0])


class CoalPlantIn(BaseModel):
    id:     str
    name:   str
    cap_mw: float = Field(..., description="Установленная мощность, МВт")
    co2_mt: float = Field(..., description="Выбросы CO₂, Мт/год при работе")
    active: bool  = True


class WhatIfRequest(BaseModel):
    coal_plants: list[CoalPlantIn]
    nuc_year:    int   = Field(2035, ge=2025, le=2050)
    nuc_units:   int   = Field(1,    ge=0,    le=4)
    res_tariff:  float = Field(21,   ge=5,    le=100)
    ind_tariff:  float = Field(18,   ge=5,    le=100)
    re_invest:   float = Field(1.5,  ge=0,    le=20)
    grid_invest: float = Field(0.5,  ge=0,    le=10)
    export_cn:   float = Field(0,    ge=0,    le=50)
    import_kg:   float = Field(0,    ge=0,    le=30)
    year_start:  int = 2024
    year_end:    int = 2060


class YearPoint(BaseModel):
    year:         int
    co2_bau:      float
    co2_wi:       float
    elec_bau:     float
    elec_wi:      float
    invest_cumul: float
    re_share:     float


class NDCStatus(BaseModel):
    co2_2030:     float
    target_ndc15: float
    target_ndc25: float
    bar_pct:      float
    bar_color:    str
    status_key:   str
    base_co2:     float
    base_year:    int


class InvestRow(BaseModel):
    key:    str
    name:   str
    invest: float
    cap:    str
    pct:    float


class WhatIfResponse(BaseModel):
    avoided_2050:     float
    avoided_pct:      float
    total_invest:     float
    coal_free_2050:   float
    ndc:              NDCStatus
    timeline:         list[YearPoint]
    invest_breakdown: list[InvestRow]


# Коэффициенты эмиссии (тCO₂/МВт·ч), источник: IPCC 2006
CO2_COAL_FACTOR = 0.82
CO2_GAS_FACTOR  = 0.40

# Ценовая эластичность спроса на электроэнергию (World Bank, оценки для РК)
ELAST_RES = -0.20  # население
ELAST_IND = -0.30  # промышленность
RES_SHARE = 0.35
IND_SHARE = 0.45

# CAPEX (млрд USD/ГВт), источник: IRENA 2023
CAPEX = {
    "wind":    1.2,
    "solar":   0.9,
    "nuclear": 5.5,
    "grid":    0.6,
}

CF = {
    "wind":    0.35,
    "solar":   0.22,
    "nuclear": 0.85,
}


def _bau_growth_rate(ds: EnergyDataset) -> float:
    # среднегеометрический темп роста CO₂ за последние 5 лет
    hist = ds.hist["CO2_Mt"].dropna().sort_index()
    if len(hist) < 2:
        return 0.018
    years = hist.index.tolist()
    recent = [y for y in years if y >= hist.index.max() - 5]
    if len(recent) < 2:
        return 0.018
    y0, y1 = recent[0], recent[-1]
    span = y1 - y0
    if span == 0:
        return 0.018
    rate = (hist[y1] / hist[y0]) ** (1 / span) - 1 #bau growth rate
    return float(np.clip(rate, -0.01, 0.05))  # ограничиваем диапазоном [-1%, +5%]


def _bau_elec_growth(ds: EnergyDataset) -> float:
    # аналогично для электропотребления
    hist = ds.hist["Electricity_TWh"].dropna().sort_index()
    if len(hist) < 2:
        return 0.018
    years = hist.index.tolist()
    recent = [y for y in years if y >= hist.index.max() - 5]
    if len(recent) < 2:
        return 0.018
    y0, y1 = recent[0], recent[-1]
    span = y1 - y0
    if span == 0:
        return 0.018
    return float(np.clip((hist[y1] / hist[y0]) ** (1 / span) - 1, -0.01, 0.05))


def calculate_whatif(req: WhatIfRequest, ds: EnergyDataset) -> WhatIfResponse:

    base_year  = ds.base_year
    base_co2   = ds.base_co2
    base_elec  = ds.base_elec
    coal_share = ds.coal_share
    re_share_0 = ds.re_share_base

    bau_co2_g  = _bau_growth_rate(ds)
    bau_elec_g = _bau_elec_growth(ds)

    closed         = [p for p in req.coal_plants if not p.active]
    coal_co2_saved = sum(p.co2_mt for p in closed)
    closed_mw      = sum(p.cap_mw for p in closed)

    nuc_gw  = req.nuc_units * 1.2  # 1 энергоблок = 1.2 ГВт
    horizon = req.year_end - req.year_start + 1

    capex_avg      = (CAPEX["wind"] + CAPEX["solar"]) / 2
    re_gw_per_yr   = req.re_invest   / capex_avg
    grid_gw_per_yr = req.grid_invest / CAPEX["grid"] * 0.3  # 30% инвестиций в сеть → новые ВИЭ

    # физические потолки по IRENA KZ assessment
    RE_CAP_GW   = 75.0
    GRID_CAP_GW = 12.0

    res_tariff_ratio = (req.res_tariff - 21) / 21
    ind_tariff_ratio = (req.ind_tariff - 18) / 18
    # отрицательное значение = экономия ТВт·ч/год
    demand_red_twh = (
        base_elec * RES_SHARE * ELAST_RES * res_tariff_ratio +
        base_elec * IND_SHARE * ELAST_IND * ind_tariff_ratio
    )

    export_co2_save = req.export_cn * CO2_COAL_FACTOR
    import_twh      = req.import_kg

    timeline: list[YearPoint] = []
    cumul_invest = 0.0

    for year in range(req.year_start, req.year_end + 1):
        t = year - base_year

        bau_co2  = base_co2  * (1 + bau_co2_g)  ** max(t, 0) 
        bau_elec = base_elec * (1 + bau_elec_g) ** max(t, 0) #bau trajectory

        # линейный выход на полный эффект за ramplen(efficiency 100%) лет 
        ramp = lambda delay, ramplen: float(np.clip((t - delay) / ramplen, 0, 1)) if ramplen > 0 else (0.0 if t <= delay else 1.0)

        delta_coal = coal_co2_saved * ramp(0, 1)

        nuc_twh = 0.0
        if year >= req.nuc_year:
            nuc_ramp = float(np.clip((year - req.nuc_year) / 3, 0, 1))
            nuc_twh  = nuc_gw * CF["nuclear"] * 8.76 * nuc_ramp
        # ядерная вытесняет уголь пропорционально его доле в миксе
        delta_nuc = nuc_twh * coal_share * CO2_COAL_FACTOR

        years_elapsed  = max(t, 0)
        re_deployed_gw = min(re_gw_per_yr   * years_elapsed, RE_CAP_GW)
        grid_deploy_gw = min(grid_gw_per_yr * years_elapsed, GRID_CAP_GW)
        re_twh         = (re_deployed_gw + grid_deploy_gw) * ((CF["wind"] + CF["solar"]) / 2) * 8.76
        delta_re       = re_twh * coal_share * CO2_COAL_FACTOR

        delta_tariff = abs(demand_red_twh) * CO2_COAL_FACTOR * coal_share * ramp(0, 3)
        delta_trade  = (export_co2_save + import_twh * CO2_COAL_FACTOR * coal_share) * ramp(0, 4)

        total_reduction = delta_coal + delta_nuc + delta_re + delta_tariff + delta_trade

        wi_co2  = max(bau_co2 - total_reduction, 5.0)  # минимум 5 Мт (не может быть 0)
        wi_elec = max(bau_elec + demand_red_twh * ramp(0, 3) + import_twh * ramp(0, 4), 50.0)

        re_new_share = re_twh / max(wi_elec, 1.0)
        re_share_yr  = float(np.clip(re_share_0 + re_new_share, re_share_0, 0.85))

        cumul_invest += req.re_invest + req.grid_invest

        timeline.append(YearPoint(
            year=year,
            co2_bau=round(bau_co2, 2),
            co2_wi=round(wi_co2, 2),
            elec_bau=round(bau_elec, 2),
            elec_wi=round(wi_elec, 2),
            invest_cumul=round(cumul_invest, 2),
            re_share=round(re_share_yr, 4),
        ))

    def _by_year(y: int) -> YearPoint:
        for pt in timeline:
            if pt.year == y:
                return pt
        return timeline[-1]

    pt2050 = _by_year(2050)
    pt2030 = _by_year(2030)

    avoided_2050 = round(pt2050.co2_bau - pt2050.co2_wi, 1)
    avoided_pct  = round(avoided_2050 / pt2050.co2_bau * 100, 1) if pt2050.co2_bau else 0.0

    total_invest_bln = round(cumul_invest + nuc_gw * CAPEX["nuclear"] + closed_mw * 0.1 / 1000, 1)

    _coal_twh_bau = pt2050.elec_bau * ds.coal_share
    _coal_avoided = coal_co2_saved / CO2_COAL_FACTOR
    _nuc_twh_2050 = nuc_gw * CF["nuclear"] * 8.76
    t2050         = 2050 - base_year
    _re_twh_2050  = (min(re_gw_per_yr * t2050, RE_CAP_GW) + min(grid_gw_per_yr * t2050, GRID_CAP_GW)) \
                    * ((CF["wind"] + CF["solar"]) / 2) * 8.76
    _clean_twh    = (_coal_twh_bau - max(_coal_twh_bau - _coal_avoided, 0)) \
                    + _re_twh_2050 + _nuc_twh_2050 \
                    + pt2050.elec_bau * ds.re_share_base
    coal_free_2050 = round(float(np.clip(_clean_twh / max(pt2050.elec_wi, 1) * 100, 0, 100)), 1)

    ndc_base  = ds.ndc["base_co2_mt"]
    target15  = ndc_base * (1 + ds.ndc["unconditional_pct"] / 100)
    target25  = ndc_base * (1 + ds.ndc["conditional_pct"]   / 100)
    co2_2030  = round(pt2030.co2_wi, 1)
    bar_pct   = round(float(np.clip(co2_2030 / (ndc_base * 1.05) * 100, 0, 100)), 1)

    if co2_2030 <= target25:
        bar_color, status_key = "#1D9E75", "wi_below_ndc25"
    elif co2_2030 <= target15:
        bar_color, status_key = "#F5A623", "wi_ndc15_met"
    else:
        bar_color, status_key = "#D85A30", "wi_above_ndc"

    ndc_status = NDCStatus(
        co2_2030=co2_2030,
        target_ndc15=round(target15, 1),
        target_ndc25=round(target25, 1),
        bar_pct=bar_pct,
        bar_color=bar_color,
        status_key=status_key,
        base_co2=ndc_base,
        base_year=ds.ndc["base_year"],
    )

    inv_re       = round(req.re_invest   * horizon, 1)
    inv_grid     = round(req.grid_invest * horizon, 1)
    inv_nuc      = round(nuc_gw * CAPEX["nuclear"], 1)
    inv_coal_out = round(closed_mw * 0.1 / 1000, 2)  # ~$100/кВт затрат на вывод станции
    inv_total    = inv_re + inv_grid + inv_nuc + inv_coal_out

    def _pct(v):
        return round(v / inv_total * 100, 1) if inv_total else 0

    re_gw_final   = min(re_gw_per_yr   * horizon, RE_CAP_GW)
    grid_gw_final = min(grid_gw_per_yr * horizon, GRID_CAP_GW)

    invest_breakdown = [
        InvestRow(key="wi_wind_solar",    name="Wind & Solar",        invest=inv_re,
                  cap=f"{re_gw_final:.1f} GW",              pct=_pct(inv_re)),
        InvestRow(key="wi_grid_upgrade",  name="Grid upgrade",         invest=inv_grid,
                  cap=f"+{grid_gw_final:.1f} GW enabled",   pct=_pct(inv_grid)),
        InvestRow(key="wi_nuclear",       name="Nuclear",              invest=inv_nuc,
                  cap=f"{nuc_gw:.1f} GW",                   pct=_pct(inv_nuc)),
        InvestRow(key="wi_coal_phaseout", name="Coal phase-out costs", invest=inv_coal_out,
                  cap=f"{closed_mw/1000:.1f} GW retired",   pct=_pct(inv_coal_out)),
    ]

    return WhatIfResponse(
        avoided_2050=avoided_2050,
        avoided_pct=avoided_pct,
        total_invest=total_invest_bln,
        coal_free_2050=coal_free_2050,
        ndc=ndc_status,
        timeline=timeline,
        invest_breakdown=invest_breakdown,
    )


@router.post("/calculate", response_model=WhatIfResponse)
def whatif_calculate(req: WhatIfRequest, ds: EnergyDataset = Depends(_get_dataset)):
    return calculate_whatif(req, ds)


@router.get("/dataset-info")
def whatif_dataset_info(ds: EnergyDataset = Depends(_get_dataset)):
    return {
        "base_year":  ds.base_year,
        "base_co2":   ds.base_co2,
        "base_elec":  ds.base_elec,
        "base_tpes":  ds.base_tpes,
        "base_gdp":   ds.base_gdp,
        "elec_mix":   ds.elec_mix,
        "ndc":        ds.ndc,
        "scenarios":  ds.scenarios,
        "hist_years": ds.hist.reset_index()["Year"].tolist(),
        "hist_co2":   ds.hist["CO2_Mt"].tolist(),
        "hist_elec":  ds.hist["Electricity_TWh"].tolist(),
    }