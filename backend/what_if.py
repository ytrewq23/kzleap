"""
KZLEAP — What-If Analyzer Backend
Точные расчёты сценариев на основе данных, загруженных пользователем.
Подключается к FastAPI через main.py (router).
"""

from __future__ import annotations
import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from pydantic import BaseModel, Field

router = APIRouter(prefix="/whatif", tags=["whatif"])

# ─────────────────────────────────────────────
# 1. DATA LAYER — читаем загруженный xlsx
# ─────────────────────────────────────────────

# Путь к последнему загруженному файлу (согласован с upload.py / main.py)
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))


class EnergyDataset:
    """Парсит KZLEAP_DATA_TEMPLATE.xlsx и предоставляет удобный доступ."""

    def __init__(self, path: Path):
        xl = pd.ExcelFile(path)

        def _parse(sheet: str, key_col: str) -> pd.DataFrame:
            """
            Парсит лист шаблона: первая строка — комментарий (#...),
            вторая строка — заголовки. comment= не работает для xlsx,
            поэтому используем header=1 (0-based → строка 1 = заголовок).
            """
            df = xl.parse(sheet, header=1)
            # Убираем строки где ключевая колонка пустая или начинается с #
            if key_col in df.columns:
                df = df[df[key_col].notna()]
                df = df[~df[key_col].astype(str).str.startswith("#")]
            return df

        # historical_energy
        he = _parse("historical_energy", "Year")
        he["Year"] = pd.to_numeric(he["Year"], errors="coerce")
        he = he.dropna(subset=["Year"])
        he["Year"] = he["Year"].astype(int)
        self.hist = he.set_index("Year")

        # historical_demo
        hd = _parse("historical_demo", "Year")
        hd["Year"] = pd.to_numeric(hd["Year"], errors="coerce")
        hd = hd.dropna(subset=["Year"])
        hd["Year"] = hd["Year"].astype(int)
        self.demo = hd.set_index("Year")

        # elec_mix  (базовый год)
        em = _parse("elec_mix", "Source")
        em = em.dropna(subset=["Source"])
        self.elec_mix: dict[str, float] = dict(
            zip(em["Source"].astype(str).str.strip(), pd.to_numeric(em["Share_pct"], errors="coerce").fillna(0))
        )

        # scenarios
        sc = _parse("scenarios", "Parameter")
        sc = sc.dropna(subset=["Parameter"])
        sc = sc.set_index("Parameter")
        self.scenarios: dict[str, dict] = {}
        for col in ("BAU", "MT", "DD"):
            if col in sc.columns:
                self.scenarios[col] = sc[col].to_dict()

        # ndc_targets
        ndc_df = _parse("ndc_targets", "Parameter")
        ndc_df = ndc_df.dropna(subset=["Parameter"])
        ndc = ndc_df.set_index("Parameter")["Value"]
        self.ndc = {
            "base_year":          int(ndc.get("base_year", 1990)),
            "base_co2_mt":        float(ndc.get("base_co2_mt", 290)),
            "unconditional_pct":  float(ndc.get("ndc_unconditional_pct", -15)),
            "conditional_pct":    float(ndc.get("ndc_conditional_pct", -25)),
            "neutrality_year":    int(ndc.get("neutrality_year", 2060)),
        }

    # ── производные величины ──────────────────
    @property
    def base_year(self) -> int:
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
        """GDP в базовом году (млрд USD)."""
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
    """FastAPI Depends — находит последний загруженный файл."""
    candidates = sorted(UPLOAD_DIR.glob("*.xlsx"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise HTTPException(status_code=404, detail="Нет загруженных данных. Сначала загрузите KZLEAP_DATA_TEMPLATE.xlsx")
    return EnergyDataset(candidates[0])


# ─────────────────────────────────────────────
# 2. PYDANTIC — схемы запроса / ответа
# ─────────────────────────────────────────────

class CoalPlantIn(BaseModel):
    id:   str
    name: str
    cap_mw: float = Field(..., description="Установленная мощность, МВт")
    co2_mt: float = Field(..., description="Выбросы CO₂, Мт/год при работе")
    active: bool  = True


class WhatIfRequest(BaseModel):
    # Угольные станции
    coal_plants: list[CoalPlantIn]

    # Ядерная
    nuc_year:  int   = Field(2035, ge=2025, le=2050)
    nuc_units: int   = Field(1,    ge=0,    le=4)

    # Тарифы (KZT/кВтч)
    res_tariff: float = Field(21, ge=5,  le=100)
    ind_tariff: float = Field(18, ge=5,  le=100)

    # Инвестиции (млрд USD/год)
    re_invest:   float = Field(1.5, ge=0, le=20)
    grid_invest: float = Field(0.5, ge=0, le=10)

    # Торговля (ТВт·ч/год)
    export_cn: float = Field(0, ge=0, le=50)
    import_kg: float = Field(0, ge=0, le=30)

    # Горизонт расчёта
    year_start: int = 2024
    year_end:   int = 2060


class YearPoint(BaseModel):
    year:        int
    co2_bau:     float
    co2_wi:      float
    elec_bau:    float
    elec_wi:     float
    invest_cumul: float
    re_share:    float   # доля ВИЭ в году


class NDCStatus(BaseModel):
    co2_2030:        float
    target_ndc15:    float
    target_ndc25:    float
    bar_pct:         float   # 0–100 для прогресс-бара
    bar_color:       str
    status_key:      str     # 'wi_below_ndc25' | 'wi_ndc15_met' | 'wi_above_ndc'
    base_co2:        float
    base_year:       int


class InvestRow(BaseModel):
    key:    str
    name:   str
    invest: float  # млрд USD (суммарно за горизонт)
    cap:    str
    pct:    float  # доля от итого


class WhatIfResponse(BaseModel):
    # Сводные KPI
    avoided_2050:    float  # Мт CO₂
    avoided_pct:     float  # % к BAU
    total_invest:    float  # млрд USD
    coal_free_2050:  float  # % чистой генерации к 2050

    # NDC
    ndc: NDCStatus

    # Временной ряд
    timeline: list[YearPoint]

    # Таблица инвестиций
    invest_breakdown: list[InvestRow]


# ─────────────────────────────────────────────
# 3. CALCULATION ENGINE
# ─────────────────────────────────────────────

# Коэффициенты эмиссии (тCO₂/МВт·ч)
CO2_COAL_FACTOR  = 0.82   # кг CO₂/кВт·ч → Мт/ТВт·ч
CO2_GAS_FACTOR   = 0.40
CO2_HYDRO_FACTOR = 0.0
CO2_WIND_FACTOR  = 0.0
CO2_SOLAR_FACTOR = 0.0
CO2_NUC_FACTOR   = 0.0

# Ценовая эластичность
ELAST_RES  = -0.20   # по умолчанию для населения
ELAST_IND  = -0.30   # для промышленности
RES_SHARE  = 0.35    # доля населения в потреблении
IND_SHARE  = 0.45    # доля промышленности

# CAPEX (млрд USD / ГВт установленной мощности)
CAPEX = {
    "wind":    1.2,
    "solar":   0.9,
    "nuclear": 5.5,
    "grid":    0.6,   # за 1 ГВт «пропускной способности»
}

# CF (коэффициент использования)
CF = {
    "wind":    0.35,
    "solar":   0.22,
    "nuclear": 0.85,
}


def _bau_growth_rate(ds: EnergyDataset) -> float:
    """
    Реальный среднегодовой темп роста CO₂ за последние 5 лет из данных.
    Если данных мало — 1.8% по умолчанию.
    """
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
    rate = (hist[y1] / hist[y0]) ** (1 / span) - 1
    # Ограничиваем разумным диапазоном
    return float(np.clip(rate, -0.01, 0.05))


def _bau_elec_growth(ds: EnergyDataset) -> float:
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

    # ── исходные данные из датасета ──────────
    base_year  = ds.base_year
    base_co2   = ds.base_co2
    base_elec  = ds.base_elec
    coal_share = ds.coal_share
    re_share_0 = ds.re_share_base   # ВИЭ в базовом году

    bau_co2_g  = _bau_growth_rate(ds)
    bau_elec_g = _bau_elec_growth(ds)

    # ── параметры сценария ───────────────────
    closed = [p for p in req.coal_plants if not p.active]
    coal_co2_saved = sum(p.co2_mt for p in closed)     # Мт/год
    closed_mw      = sum(p.cap_mw for p in closed)     # МВт

    nuc_gw   = req.nuc_units * 1.2                     # ГВт
    horizon = req.year_end - req.year_start + 1

    # ВИЭ: инвест B$/год / CAPEX B$/GW = GW вводится каждый год
    # re_gw_per_yr — ежегодный прирост мощности; в цикле накапливается через ramp
    capex_avg     = (CAPEX["wind"] + CAPEX["solar"]) / 2   # ~1.05 B$/GW
    re_gw_per_yr  = req.re_invest   / capex_avg            # GW/год
    grid_gw_per_yr = req.grid_invest / CAPEX["grid"] * 0.3 # GW/год (30% grid → RE)

    # Физические потолки для KZ (по IRENA KZ assessment):
    # ~45 GW ветер + ~30 GW солнце = 75 GW суммарно к 2050
    RE_CAP_GW   = 75.0   # абсолютный потолок суммарной ВИЭ мощности, GW
    GRID_CAP_GW = 12.0   # макс. доп. мощность от модернизации сети, GW

    # Тарифный эффект на спрос
    res_tariff_ratio = (req.res_tariff - 21) / 21
    ind_tariff_ratio = (req.ind_tariff - 18) / 18
    demand_red_twh = (
        base_elec * RES_SHARE * ELAST_RES * res_tariff_ratio +
        base_elec * IND_SHARE * ELAST_IND * ind_tariff_ratio
    )   # отрицательное = экономия, ТВт·ч/год

    # Торговля
    export_co2_save = req.export_cn * CO2_COAL_FACTOR  # замещение угля экспортом
    import_twh      = req.import_kg                    # гидро, CO₂=0

    # ── временной ряд ────────────────────────
    timeline: list[YearPoint] = []
    cumul_invest = 0.0

    for year in range(req.year_start, req.year_end + 1):
        t = year - base_year  # лет от базового

        # BAU
        bau_co2  = base_co2  * (1 + bau_co2_g)  ** max(t, 0)
        bau_elec = base_elec * (1 + bau_elec_g) ** max(t, 0)

        # Рост-факторы: линейный выход на плато (sigmoid-like linear)
        ramp = lambda delay, ramplen: float(np.clip((t - delay) / ramplen, 0, 1)) if ramplen > 0 else (0.0 if t <= delay else 1.0)

        # 1. Закрытие угольных станций — немедленно
        delta_coal = coal_co2_saved * ramp(0, 1)

        # 2. Ядерная станция — вводится в год nuc_year, набирает нагрузку 3 года
        nuc_twh = 0.0
        if year >= req.nuc_year:
            nuc_ramp = float(np.clip((year - req.nuc_year) / 3, 0, 1))
            nuc_twh  = nuc_gw * CF["nuclear"] * 8.76 * nuc_ramp    # ТВт·ч/год
        delta_nuc = nuc_twh * coal_share * CO2_COAL_FACTOR

        # 3. ВИЭ: накопленная мощность к году t = GW/год * лет, с потолком
        years_elapsed   = max(t, 0)
        re_deployed_gw  = min(re_gw_per_yr   * years_elapsed, RE_CAP_GW)
        grid_deploy_gw  = min(grid_gw_per_yr * years_elapsed, GRID_CAP_GW)
        re_total_gw     = re_deployed_gw + grid_deploy_gw
        re_twh          = re_total_gw * ((CF["wind"] + CF["solar"]) / 2) * 8.76
        delta_re        = re_twh * coal_share * CO2_COAL_FACTOR

        # 4. Тарифный эффект (постепенно, 3 года)
        delta_tariff = abs(demand_red_twh) * CO2_COAL_FACTOR * coal_share * ramp(0, 3)

        # 5. Торговля (постепенно, 4 года)
        delta_trade = (export_co2_save + import_twh * CO2_COAL_FACTOR * coal_share) * ramp(0, 4)

        total_reduction = delta_coal + delta_nuc + delta_re + delta_tariff + delta_trade

        wi_co2 = max(bau_co2 - total_reduction, 5.0)

        # Электропотребление WI (спрос падает от тарифов, растёт от экономики)
        tariff_elec_delta = demand_red_twh * ramp(0, 3)
        wi_elec = max(bau_elec + tariff_elec_delta + import_twh * ramp(0, 4), 50.0)

        # RE share: только новые ВИЭ мощности / фактический спрос
        # re_twh = генерация новых ВИЭ (ветер+солнце) к году t
        # re_share_0 = базовая доля ВИЭ (wind+solar+hydro) из датасета — константа
        # Итоговая доля = базовая + прирост от новых мощностей
        re_new_share = re_twh / max(wi_elec, 1.0)         # доля новых ВИЭ в спросе
        re_share_yr  = float(np.clip(re_share_0 + re_new_share, re_share_0, 0.85))

        # Инвестиции (ежегодный поток)
        annual_invest = req.re_invest + req.grid_invest
        cumul_invest += annual_invest

        timeline.append(YearPoint(
            year=year,
            co2_bau=round(bau_co2, 2),
            co2_wi=round(wi_co2, 2),
            elec_bau=round(bau_elec, 2),
            elec_wi=round(wi_elec, 2),
            invest_cumul=round(cumul_invest, 2),
            re_share=round(re_share_yr, 4),
        ))

    # ── KPI ──────────────────────────────────
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

    # Coal-free % к 2050: 100% - доля угля в генерации
    # Доля угля = (угольная генерация BAU - избежанная) / wi_elec
    _coal_twh_bau   = pt2050.elec_bau * ds.coal_share          # TWh угля в BAU 2050
    _coal_avoided   = coal_co2_saved / CO2_COAL_FACTOR          # TWh угля закрытых станций
    _nuc_twh_2050   = nuc_gw * CF["nuclear"] * 8.76            # TWh ядерной к 2050
    t2050           = 2050 - base_year
    _re_gw_2050     = min(re_gw_per_yr * t2050, RE_CAP_GW)
    _grid_gw_2050   = min(grid_gw_per_yr * t2050, GRID_CAP_GW)
    _re_twh_2050    = (_re_gw_2050 + _grid_gw_2050) * ((CF["wind"] + CF["solar"]) / 2) * 8.76
    _clean_twh      = (_coal_twh_bau - max(_coal_twh_bau - _coal_avoided, 0))\
                      + _re_twh_2050 + _nuc_twh_2050\
                      + pt2050.elec_bau * ds.re_share_base      # базовые ВИЭ
    coal_free_2050  = round(float(np.clip(_clean_twh / max(pt2050.elec_wi, 1) * 100, 0, 100)), 1)

    # ── NDC ──────────────────────────────────
    ndc_base   = ds.ndc["base_co2_mt"]
    target15   = ndc_base * (1 + ds.ndc["unconditional_pct"] / 100)   # −15%
    target25   = ndc_base * (1 + ds.ndc["conditional_pct"]   / 100)   # −25%
    co2_2030   = round(pt2030.co2_wi, 1)
    max_bar    = ndc_base * 1.05   # 100% прогресс-бара
    bar_pct    = round(float(np.clip(co2_2030 / max_bar * 100, 0, 100)), 1)

    if co2_2030 <= target25:
        bar_color  = "#1D9E75"
        status_key = "wi_below_ndc25"
    elif co2_2030 <= target15:
        bar_color  = "#F5A623"
        status_key = "wi_ndc15_met"
    else:
        bar_color  = "#D85A30"
        status_key = "wi_above_ndc"

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

    # ── Investment breakdown ──────────────────
    inv_re       = round(req.re_invest   * horizon, 1)
    inv_grid     = round(req.grid_invest * horizon, 1)
    inv_nuc      = round(nuc_gw * CAPEX["nuclear"], 1)
    inv_coal_out = round(closed_mw * 0.1 / 1000, 2)   # ~$100/кВт выходных затрат
    inv_total    = inv_re + inv_grid + inv_nuc + inv_coal_out

    def _pct(v):
        return round(v / inv_total * 100, 1) if inv_total else 0

    # Финальные мощности к концу горизонта
    capex_avg_inv   = (CAPEX["wind"] + CAPEX["solar"]) / 2
    re_gw_per_yr_inv   = req.re_invest   / capex_avg_inv
    grid_gw_per_yr_inv = req.grid_invest / CAPEX["grid"] * 0.3
    re_gw_final   = min(re_gw_per_yr_inv   * horizon, RE_CAP_GW)
    grid_gw_final = min(grid_gw_per_yr_inv * horizon, GRID_CAP_GW)

    invest_breakdown = [
        InvestRow(key="wi_wind_solar",    name="Wind & Solar",        invest=inv_re,
                  cap=f"{re_gw_final:.1f} GW",                        pct=_pct(inv_re)),
        InvestRow(key="wi_grid_upgrade",  name="Grid upgrade",         invest=inv_grid,
                  cap=f"+{grid_gw_final:.1f} GW enabled",             pct=_pct(inv_grid)),
        InvestRow(key="wi_nuclear",       name="Nuclear",              invest=inv_nuc,
                  cap=f"{nuc_gw:.1f} GW",                              pct=_pct(inv_nuc)),
        InvestRow(key="wi_coal_phaseout", name="Coal phase-out costs", invest=inv_coal_out,
                  cap=f"{closed_mw/1000:.1f} GW retired",              pct=_pct(inv_coal_out)),
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


# ─────────────────────────────────────────────
# 4. ENDPOINTS
# ─────────────────────────────────────────────

@router.post("/calculate", response_model=WhatIfResponse)
def whatif_calculate(
    req: WhatIfRequest,
    ds: EnergyDataset = Depends(_get_dataset),
):
    """
    Основной эндпоинт: принимает параметры What-If, возвращает полный расчёт.
    """
    return calculate_whatif(req, ds)


@router.get("/dataset-info")
def whatif_dataset_info(ds: EnergyDataset = Depends(_get_dataset)):
    """
    Возвращает мета-информацию о загруженном датасете:
    базовые показатели, mix, NDC-цели — для инициализации слайдеров.
    """
    return {
        "base_year":   ds.base_year,
        "base_co2":    ds.base_co2,
        "base_elec":   ds.base_elec,
        "base_tpes":   ds.base_tpes,
        "base_gdp":    ds.base_gdp,
        "elec_mix":    ds.elec_mix,
        "ndc":         ds.ndc,
        "scenarios":   ds.scenarios,
        "hist_years":  ds.hist.reset_index()["Year"].tolist(),
        "hist_co2":    ds.hist["CO2_Mt"].tolist(),
        "hist_elec":   ds.hist["Electricity_TWh"].tolist(),
    }