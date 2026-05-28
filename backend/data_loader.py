"""
KZLEAP — Dynamic Data Loader
Reads all uploaded datasets and extracts energy/demographic indicators.
Priority: uploaded data > built-in hardcoded values
"""

# In-memory store (shared with main.py via import)
_uploaded_datasets = {}

def register_dataset(dataset_id: str, parsed: dict):
    """Called when user uploads a file."""
    _uploaded_datasets[dataset_id] = parsed

def get_all_datasets() -> dict:
    return _uploaded_datasets

def extract_indicator(code: str, year_from: int = 1990, year_to: int = 2024) -> dict:
    """
    Search all uploaded datasets for a specific indicator code.
    Returns {year: value} dict or empty dict if not found.
    """
    for ds_id, ds in _uploaded_datasets.items():
        # World Bank format
        if ds.get('source') == 'worldbank':
            for ind in ds.get('indicators', []):
                if ind.get('code') == code:
                    return {
                        y: v for y, v in ind['data'].items()
                        if year_from <= y <= year_to
                    }
        # OWID format — match by indicator name
        if ds.get('source') == 'owid':
            ind_name = ds.get('indicator', '')
            if 'CO' in ind_name or 'emission' in ind_name.lower():
                if code in ('EN.ATM.CO2E.KT', 'co2'):
                    return {
                        y: v for y, v in ds.get('data', {}).items()
                        if year_from <= y <= year_to
                    }
    return {}


def get_base_values() -> dict:
    """
    Extract key base values from uploaded datasets.
    Returns dict with best available values (uploaded > hardcoded fallback).
    """
    FALLBACK = {
        'co2_2023':       242.0,   # Mt CO2
        'elec_2023':      115.0,   # TWh
        'tpes_2023':       85.0,   # Mtoe
        'pop_2023':        20.1,   # million
        'gdp_growth':       0.040, # annual rate
        'renewables_pct':   5.1,   # % of electricity
        'coal_share':      61.0,   # % of electricity
        'gas_share':       24.0,
        'hydro_share':     10.0,
        'wind_share':       3.5,
        'solar_share':      1.5,
    }

    result = dict(FALLBACK)

    # ── CO2 from OWID or World Bank ──
    co2_data = extract_indicator('EN.ATM.CO2E.KT')
    if not co2_data:
        co2_data = extract_indicator('co2')

    if co2_data:
        years = sorted(co2_data.keys())
        latest_year = max(y for y in years if y <= 2024)
        val = co2_data[latest_year]
        # OWID is in tonnes, World Bank in kt
        if val > 1_000_000:
            val = val / 1_000_000  # tonnes → Mt
        elif val > 1000:
            val = val / 1000       # kt → Mt
        result['co2_2023'] = round(val, 1)
        result['co2_source'] = 'uploaded'
        result['co2_year'] = latest_year

        # Calculate trend (last 5 years avg growth)
        if len(years) >= 5:
            recent = [co2_data[y] for y in sorted(years)[-5:]]
            if recent[0] > 0:
                growth = (recent[-1] / recent[0]) ** (1/4) - 1
                result['co2_trend'] = round(growth, 4)

    # ── Population from World Bank ──
    pop_data = extract_indicator('SP.POP.TOTL')
    if pop_data:
        latest = max(y for y in pop_data if y <= 2024)
        result['pop_2023'] = round(pop_data[latest] / 1_000_000, 2)
        result['pop_source'] = 'uploaded'

        # Population growth rate
        years_pop = sorted(pop_data.keys())
        if len(years_pop) >= 5:
            recent = [pop_data[y] for y in years_pop[-5:]]
            if recent[0] > 0:
                result['pop_growth'] = round((recent[-1]/recent[0])**(1/4) - 1, 4)

    # ── GDP from World Bank ──
    gdp_data = extract_indicator('NY.GDP.MKTP.CD')
    if gdp_data:
        years_gdp = sorted(gdp_data.keys())
        if len(years_gdp) >= 5:
            recent = [gdp_data[y] for y in years_gdp[-5:] if gdp_data[y]]
            if len(recent) >= 2 and recent[0] > 0:
                result['gdp_growth'] = round((recent[-1]/recent[0])**(1/(len(recent)-1)) - 1, 4)
                result['gdp_source'] = 'uploaded'

    # ── Renewables from World Bank ──
    re_data = extract_indicator('EG.ELC.RNEW.ZS')
    if re_data:
        latest = max(y for y in re_data if y <= 2024)
        result['renewables_pct'] = round(re_data[latest], 1)
        result['re_source'] = 'uploaded'

    # ── Energy per capita ──
    energy_pc = extract_indicator('EG.USE.PCAP.KG.OE')
    if energy_pc:
        latest = max(y for y in energy_pc if y <= 2024)
        # kg of oil equivalent per capita → Mtoe total
        if result['pop_2023'] > 0:
            result['tpes_2023'] = round(
                energy_pc[latest] * result['pop_2023'] * 1_000_000 / 1e9, 1
            )
            result['tpes_source'] = 'uploaded'

    return result


def get_historical_series() -> dict:
    """
    Return historical time series for dashboard charts.
    Merges all uploaded datasets.
    """
    co2_data    = extract_indicator('EN.ATM.CO2E.KT') or extract_indicator('co2')
    pop_data    = extract_indicator('SP.POP.TOTL')
    gdp_data    = extract_indicator('NY.GDP.MKTP.CD')
    re_data     = extract_indicator('EG.ELC.RNEW.ZS')
    energy_data = extract_indicator('EG.USE.PCAP.KG.OE')

    def normalize_co2(data):
        result = {}
        for y, v in data.items():
            if v > 1_000_000:
                result[y] = round(v / 1_000_000, 1)
            elif v > 1000:
                result[y] = round(v / 1000, 1)
            else:
                result[y] = round(v, 1)
        return result

    series = {}
    if co2_data:
        normed = normalize_co2(co2_data)
        years = sorted(normed.keys())
        series['co2'] = {'years': years, 'values': [normed[y] for y in years], 'unit': 'Mt CO2'}
    if gdp_data:
        years = sorted(gdp_data.keys())
        series['gdp'] = {
            'years': years,
            'values': [round(gdp_data[y] / 1e9, 1) for y in years],
            'unit': 'Billion USD'
        }
    if pop_data:
        years = sorted(pop_data.keys())
        series['population'] = {
            'years': years,
            'values': [round(pop_data[y] / 1e6, 2) for y in years],
            'unit': 'Million'
        }
    if re_data:
        years = sorted(re_data.keys())
        series['renewables_pct'] = {
            'years': years,
            'values': [round(re_data[y], 1) for y in years],
            'unit': '%'
        }

    return series
