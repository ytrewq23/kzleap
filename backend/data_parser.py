import io
import csv
from typing import Dict, List, Optional

def parse_owid_csv(content: str) -> Dict:

    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)

    if not rows:
        return {"error": "Empty file"}

    cols = reader.fieldnames or []
    value_col = next((c for c in cols if c not in ('Entity','Code','Year')), None)
    if not value_col:
        return {"error": "Cannot find value column"}

    result = {}
    for row in rows:
        try:
            year = int(row['Year'])
            val  = float(row[value_col]) if row[value_col] else None
            if val is not None and 1990 <= year <= 2024:
                if 'CO' in value_col or 'emission' in value_col.lower():
                    val = round(val / 1_000_000, 1)
                result[year] = val
        except (ValueError, KeyError):
            continue

    return {
        "source": "owid",
        "indicator": value_col,
        "data": result,
        "years": sorted(result.keys()),
        "values": [result[y] for y in sorted(result.keys())],
    }


def parse_worldbank_csv(content: str) -> Dict:
    lines = content.splitlines()

    data_start = 0
    for i, line in enumerate(lines):
        if line.startswith('Country Name') or line.startswith('"Country Name"'):
            data_start = i
            break

    clean = '\n'.join(lines[data_start:])
    reader = csv.DictReader(io.StringIO(clean))
    rows = list(reader)

    if not rows:
        return {"error": "No data rows found"}

    fieldnames = reader.fieldnames or []
    year_cols = []
    for f in fieldnames:
        try:
            y = int(f.strip().strip('"'))
            if 1960 <= y <= 2024:
                year_cols.append((y, f))
        except ValueError:
            continue

    indicators = []
    for row in rows:
        indicator_name = row.get('Indicator Name', row.get('"Indicator Name"', '')).strip().strip('"')
        indicator_code = row.get('Indicator Code', row.get('"Indicator Code"', '')).strip().strip('"')

        data = {}
        for year, col in year_cols:
            val_str = row.get(col, '').strip().strip('"')
            if val_str:
                try:
                    data[year] = float(val_str)
                except ValueError:
                    pass

        if data:
            indicators.append({
                "indicator": indicator_name,
                "code": indicator_code,
                "data": {y: v for y, v in data.items() if 1990 <= y <= 2024},
            })

    return {
        "source": "worldbank",
        "indicators_found": len(indicators),
        "indicators": indicators,
    }


def parse_csv_auto(content: str, filename: str = '') -> Dict:
    first_line = content.splitlines()[0] if content else ''

    if 'Entity' in first_line and 'Year' in first_line:
        result = parse_owid_csv(content)
        result['filename'] = filename
        return result

    if 'Country Name' in first_line or '"Country Name"' in content[:500]:
        result = parse_worldbank_csv(content)
        result['filename'] = filename
        return result

    return {"error": "Unrecognized CSV format. Supported: Our World in Data, World Bank"}


def extract_energy_indicators(wb_parsed: Dict) -> Dict:
    if wb_parsed.get('source') != 'worldbank':
        return {}

    TARGET_CODES = {
        'NY.GDP.MKTP.CD':    'gdp_usd',
        'SP.POP.TOTL':       'population',
        'EG.ELC.ACCS.ZS':    'elec_access_pct',
        'EG.USE.PCAP.KG.OE': 'energy_per_capita',
        'EN.ATM.CO2E.KT':    'co2_kt',
        'EG.ELC.RNEW.ZS':    'renewables_pct',
    }

    result = {}
    for ind in wb_parsed.get('indicators', []):
        code = ind.get('code', '')
        if code in TARGET_CODES:
            key = TARGET_CODES[code]
            data = ind['data']
            result[key] = {
                'years':  sorted(data.keys()),
                'values': [data[y] for y in sorted(data.keys())],
            }

    return result
