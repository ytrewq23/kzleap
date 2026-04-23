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
    scenario: str = "BAU"       # BAU / MT / DD
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
    """Kazakhstan historical energy data 1990–2023."""
    return get_historical_data()

@app.get("/api/scenarios")
def list_scenarios():
    """Available scenarios with descriptions."""
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
    """Run LEAP energy accounting for a scenario."""
    if req.scenario not in SCENARIOS:
        raise HTTPException(400, f"Unknown scenario '{req.scenario}'. Use: BAU, MT, DD")
    return run_scenario(req.scenario, req.start_year, req.end_year)

@app.get("/api/compare")
def compare_all():
    """Run all 3 scenarios and return comparison data."""
    return compare_scenarios()

@app.post("/api/optimize")
def optimize_electricity(req: LPRequest):
    """LP optimization for least-cost electricity mix."""
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
    """Quick LP optimization for a scenario and year with auto-calculated demand."""
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