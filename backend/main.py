from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json

from leap_model import run_scenario, get_historical_data, compare_scenarios, SCENARIOS
from lp_optimizer import run_lp_optimization

app = FastAPI(
    title="KZLEAP API",
    description="Kazakhstan Energy Forecasting Platform — Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScenarioRunRequest(BaseModel):
    scenario: str = "BAU"       
    start_year: int = 2024
    end_year: int = 2060

class LPRequest(BaseModel):
    scenario: str = "MT"
    year: int = 2035
    demand_twh: float = 130.0
    renewables_target: float = 0.15
    co2_budget_mt: Optional[float] = None
    nuclear_available_gw: float = 0.0

@app.get("/")
def root():
    return {"platform": "KZLEAP", "version": "1.0", "status": "running"}


@app.get("/api/historical")
def historical_data():
    return get_historical_data()


@app.get("/api/scenarios")
def list_scenarios():
    return {
        k: {
            "name": v["name"],
            "description": v["description"],
            "renewables_2030": v["renewables_2030"],
            "renewables_2050": v["renewables_2050"],
            "co2_price_2030": v["co2_price_2030"],
        }
        for k, v in SCENARIOS.items()
    }


@app.post("/api/run")
def run_forecast(req: ScenarioRunRequest):
    if req.scenario not in SCENARIOS:
        raise HTTPException(400, f"Unknown scenario '{req.scenario}'. Use: BAU, MT, DD")
    return run_scenario(req.scenario, req.start_year, req.end_year)


@app.get("/api/compare")
def compare_all():
    return compare_scenarios()


@app.post("/api/optimize")
def optimize_electricity(req: LPRequest):
    if req.scenario not in SCENARIOS:
        raise HTTPException(400, f"Unknown scenario '{req.scenario}'")
    return run_lp_optimization(
        demand_twh=req.demand_twh,
        scenario=req.scenario,
        year=req.year,
        renewables_target=req.renewables_target,
        co2_budget_mt=req.co2_budget_mt,
        nuclear_available_gw=req.nuclear_available_gw,
    )


@app.get("/api/optimize/quick/{scenario}/{year}")
def quick_optimize(scenario: str, year: int):
    if scenario not in SCENARIOS:
        raise HTTPException(400, f"Unknown scenario")
    data = run_scenario(scenario, year, year)
    demand = data["electricity"][0] if data["electricity"] else 130.0

    params = SCENARIOS[scenario]
    re_target = params["renewables_2030"] if year <= 2030 else params["renewables_2050"]
    nuc_gw = params["nuclear_gw_2035"] if year >= 2035 else 0.0

    return run_lp_optimization(
        demand_twh=demand,
        scenario=scenario,
        year=year,
        renewables_target=re_target,
        nuclear_available_gw=nuc_gw,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

from fastapi import UploadFile, File
from data_parser import parse_csv_auto, extract_energy_indicators

uploaded_datasets = {}

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files supported")

    content = (await file.read()).decode('utf-8', errors='replace')
    parsed = parse_csv_auto(content, file.filename)

    if 'error' in parsed:
        raise HTTPException(422, parsed['error'])

    dataset_id = file.filename.replace(' ', '_')
    uploaded_datasets[dataset_id] = parsed

    summary = {}
    if parsed.get('source') == 'worldbank':
        energy = extract_energy_indicators(parsed)
        uploaded_datasets[dataset_id + '_energy'] = energy
        summary = {
            "indicators_found": parsed.get('indicators_found', 0),
            "energy_indicators": list(energy.keys()),
        }
    elif parsed.get('source') == 'owid':
        summary = {
            "indicator": parsed.get('indicator'),
            "years_range": f"{min(parsed['years'])}–{max(parsed['years'])}" if parsed.get('years') else "—",
            "data_points": len(parsed.get('data', {})),
        }

    return {
        "status": "ok",
        "filename": file.filename,
        "source": parsed.get('source'),
        "summary": summary,
        "dataset_id": dataset_id,
    }


@app.get("/api/datasets")
def list_datasets():
    return {
        k: {
            "source": v.get("source"),
            "indicator": v.get("indicator"),
            "years": v.get("years", [])[:3],
        }
        for k, v in uploaded_datasets.items()
        if not k.endswith('_energy')
    }


@app.get("/api/datasets/{dataset_id}/co2")
def get_dataset_co2(dataset_id: str):
    ds = uploaded_datasets.get(dataset_id)
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return ds

from fastapi.responses import StreamingResponse
import io, csv

@app.get("/api/export/csv")
def export_csv():
    bau = run_scenario("BAU", 2024, 2060)
    mt  = run_scenario("MT",  2024, 2060)
    dd  = run_scenario("DD",  2024, 2060)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Year",
        "BAU_CO2_Mt", "MT_CO2_Mt", "DD_CO2_Mt",
        "BAU_Electricity_TWh", "MT_Electricity_TWh", "DD_Electricity_TWh",
        "BAU_RE_Share_pct", "MT_RE_Share_pct", "DD_RE_Share_pct",
        "BAU_Coal_Share_pct", "MT_Coal_Share_pct", "DD_Coal_Share_pct",
        "NDC_Unconditional_Mt", "NDC_Conditional_Mt",
    ])

    for i, year in enumerate(bau["years"]):
        writer.writerow([
            year,
            bau["co2"][i], mt["co2"][i], dd["co2"][i],
            bau["electricity"][i], mt["electricity"][i], dd["electricity"][i],
            bau["renewables_share"][i], mt["renewables_share"][i], dd["renewables_share"][i],
            bau["coal_share"][i], mt["coal_share"][i], dd["coal_share"][i],
            246.5, 217.5,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=KZLEAP_Scenarios_2024_2060.csv"}
    )


@app.get("/api/export/summary")
def export_summary():
    bau = run_scenario("BAU", 2024, 2060)
    mt  = run_scenario("MT",  2024, 2060)
    dd  = run_scenario("DD",  2024, 2060)

    milestones = [2025, 2030, 2035, 2040, 2045, 2050, 2060]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Year", "BAU CO2 (Mt)", "MT CO2 (Mt)", "DD CO2 (Mt)",
                     "MT vs BAU reduction (Mt)", "DD vs BAU reduction (Mt)",
                     "DD reduction (%)", "NDC target (Mt)"])

    for i, year in enumerate(bau["years"]):
        if year not in milestones:
            continue
        b, m, d = bau["co2"][i], mt["co2"][i], dd["co2"][i]
        writer.writerow([
            year, round(b,1), round(m,1), round(d,1),
            round(b-m,1), round(b-d,1),
            round((b-d)/b*100,1),
            246.5 if year == 2030 else ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=KZLEAP_Summary.csv"}
    )

from fastapi.responses import StreamingResponse
import io, csv as csv_module

@app.get("/api/export/csv")
def export_csv():
    data = compare_scenarios()
    BAU, MT, DD = data['BAU'], data['MT'], data['DD']
    years = BAU['years']

    output = io.StringIO()
    writer = csv_module.writer(output)

    writer.writerow([
        'Year',
        'BAU_CO2_Mt', 'MT_CO2_Mt', 'DD_CO2_Mt',
        'BAU_Electricity_TWh', 'MT_Electricity_TWh', 'DD_Electricity_TWh',
        'BAU_RE_Share_pct', 'MT_RE_Share_pct', 'DD_RE_Share_pct',
        'BAU_Coal_Share_pct', 'MT_Coal_Share_pct', 'DD_Coal_Share_pct',
        'NDC_Unconditional_Mt', 'NDC_Conditional_Mt',
    ])

    ndc_unc = data['_targets']['ndc_unconditional_2030']
    ndc_con = data['_targets']['ndc_conditional_2030']

    for i, year in enumerate(years):
        writer.writerow([
            year,
            round(BAU['co2'][i], 1), round(MT['co2'][i], 1), round(DD['co2'][i], 1),
            round(BAU['electricity'][i], 1), round(MT['electricity'][i], 1), round(DD['electricity'][i], 1),
            round(BAU['renewables_share'][i], 1), round(MT['renewables_share'][i], 1), round(DD['renewables_share'][i], 1),
            round(BAU['coal_share'][i], 1), round(MT['coal_share'][i], 1), round(DD['coal_share'][i], 1),
            ndc_unc if year == 2030 else '',
            ndc_con if year == 2030 else '',
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="KZLEAP_Scenarios.csv"'}
    )


@app.get("/api/export/summary")
def export_summary():
    data = compare_scenarios()
    BAU, MT, DD = data['BAU'], data['MT'], data['DD']
    years = BAU['years']
    milestones = {2025, 2030, 2035, 2040, 2045, 2050, 2060}

    output = io.StringIO()
    writer = csv_module.writer(output)
    writer.writerow(['Year', 'BAU_CO2_Mt', 'MT_CO2_Mt', 'DD_CO2_Mt', 'DD_vs_BAU_Mt', 'Reduction_pct'])

    for i, year in enumerate(years):
        if year not in milestones:
            continue
        b, m, d = round(BAU['co2'][i], 1), round(MT['co2'][i], 1), round(DD['co2'][i], 1)
        writer.writerow([year, b, m, d, round(b-d, 1), round((b-d)/b*100, 1)])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="KZLEAP_Summary.csv"'}
    )
