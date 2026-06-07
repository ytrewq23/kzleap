from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
import json
import os
from dotenv import load_dotenv
 
load_dotenv()
 
from leap_model import run_scenario, get_historical_data, compare_scenarios, SCENARIOS
from lp_optimizer import run_lp_optimization, TECHNOLOGIES, DISCOUNT_RATE
from sensitivity import run_sensitivity_analysis
from carbon_budget import compute_carbon_budget, compute_custom_target
from investment_planner import run_investment_plan
from database import init_db, SessionLocal, User, LoginLog, VerificationCode, Dataset, hash_password
from email_service import generate_code, send_verification_email
from datetime import datetime
import httpx
 
init_db()

# ── Auto-migrate: add file_content column if missing ─────────────────────
try:
    from sqlalchemy import text
    with SessionLocal() as _db:
        _db.execute(text("ALTER TABLE datasets ADD COLUMN IF NOT EXISTS file_content TEXT"))
        _db.commit()
except Exception:
    pass  # column already exists or DB doesn't support IF NOT EXISTS

# ── On startup: reload all datasets from DB into memory ──────────────────
def _reload_datasets_from_db():
    import base64
    try:
        db = SessionLocal()
        records = db.query(Dataset).all()
        db.close()
        for record in records:
            if not record.file_content:
                continue
            fname = (record.filename or "").lower()
            try:
                if fname.endswith((".xlsx", ".xls")):
                    file_bytes = base64.b64decode(record.file_content)
                    parsed = parse_kzleap_excel(file_bytes, record.filename)
                    if "error" not in parsed:
                        uploaded_datasets[record.dataset_id] = parsed
                        load_excel_data(parsed)
                else:
                    parsed = parse_csv_auto(record.file_content, record.filename)
                    if "error" not in parsed:
                        uploaded_datasets[record.dataset_id] = parsed
            except Exception:
                pass
    except Exception:
        pass

_reload_datasets_from_db()
 
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
 
# ── uploads dir (нужен до регистрации what_if router) ────────────────────────
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
 
# ── What-If Analyzer router ───────────────────────────────────────────────────
import what_if as _wi_module
_wi_module.UPLOAD_DIR = Path(UPLOAD_DIR)   # синхронизируем путь с upload эндпоинтом
from what_if import router as whatif_router
app.include_router(whatif_router)
# ─────────────────────────────────────────────────────────────────────────────
 
from pydantic import BaseModel as PydanticBase
 
class LoginRequest(PydanticBase):
    email: str
    password: str
 
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
 
class CustomScenarioRequest(PydanticBase):
    name: str = "Custom"
    base: str = "MT"
    renewables_2050: float = 40.0
    coal_phase_rate: float = 2.0
    efficiency: float = 2.0
    carbon_price: float = 20.0
    ev_share: float = 30.0
    nuclear_gw: float = 0.0
    pop_growth_rate: float = 1.2
    urbanization_rate: float = 0.3
    working_age_2050: float = 64.0
    gdp_per_capita_growth: float = 3.0
    income_elasticity: float = 0.6
    start_year: int = 2024
    end_year: int = 2060
@app.get("/health")
def root():
    return {"platform": "KZLEAP", "version": "1.0", "status": "running"}

@app.post("/api/login")
def login(request: Request, req: LoginRequest):
    db = SessionLocal()
    user = db.query(User).filter(User.email == req.email).first()
    ip = request.client.host
    if not user or user.password_hash != hash_password(req.password):
        db.add(LoginLog(email=req.email, ip=ip, success="fail"))
        db.commit()
        db.close()
        raise HTTPException(401, "Invalid email or password")
    db.add(LoginLog(email=user.email, ip=ip, success="ok"))
    db.commit()
    result = {"name": user.name, "role": user.role, "email": user.email, "status": user.status}
    db.close()
    return result

@app.post("/api/register")
def register(request: Request, data: dict):
    db = SessionLocal()
    existing = db.query(User).filter(User.email == data.get("email")).first()
    if existing:
        db.close()
        raise HTTPException(400, "Email already registered")

    role = data.get("role", "researcher")
    status = "active" if role == "researcher" else "pending"

    new_user = User(
        email=data.get("email"),
        name=data.get("name"),
        role=role,
        status=status,
        password_hash=hash_password(data.get("password", ""))
    )
    db.add(new_user)
    db.commit()
    db.close()

    if role in ["analyst", "policymaker"]:
        code = generate_code()
        db2 = SessionLocal()
        db2.add(VerificationCode(email=data.get("corporate_email"), code=code))
        db2.commit()
        db2.close()
        send_verification_email(data.get("corporate_email"), code, data.get("name"))
        return {"message": "code_sent", "email": data.get("corporate_email")}

    return {"message": "registered", "role": role}

@app.post("/api/verify-email")
def verify_email(data: dict):
    db = SessionLocal()
    record = db.query(VerificationCode).filter(
        VerificationCode.email == data.get("email"),
        VerificationCode.code == data.get("code"),
        VerificationCode.used == "no"
    ).first()

    if not record:
        db.close()
        raise HTTPException(400, "Invalid or expired code")

    record.used = "yes"
    user = db.query(User).filter(User.email == data.get("user_email")).first()
    if user:
        user.status = "active"
    db.commit()
    db.close()
    return {"message": "verified"}

@app.post("/api/forgot-password")
def forgot_password(data: dict):
    db = SessionLocal()
    user = db.query(User).filter(User.email == data.get("email")).first()
    if not user:
        db.close()
        raise HTTPException(404, "Email not found")
    user_name = user.name
    user_email = user.email
    db.close()
    code = generate_code()
    db2 = SessionLocal()
    db2.add(VerificationCode(email=user_email, code=code))
    db2.commit()
    db2.close()
    send_verification_email(user_email, code, user_name)
    return {"message": "code_sent"}

@app.post("/api/reset-password")
def reset_password(data: dict):
    db = SessionLocal()
    record = db.query(VerificationCode).filter(
        VerificationCode.email == data.get("email"),
        VerificationCode.code == data.get("code"),
        VerificationCode.used == "no"
    ).first()
    if not record:
        db.close()
        raise HTTPException(400, "Invalid or expired code")
    record.used = "yes"
    user = db.query(User).filter(User.email == data.get("email")).first()
    if user:
        user.password_hash = hash_password(data.get("password"))
    db.commit()
    db.close()
    return {"message": "password_reset"}

@app.delete("/api/delete-account")
def delete_account(data: dict):
    db = SessionLocal()
    user = db.query(User).filter(User.email == data.get("email")).first()
    if not user:
        db.close()
        raise HTTPException(404, "User not found")
    if user.password_hash != hash_password(data.get("password", "")):
        db.close()
        raise HTTPException(401, "Invalid password")
    db.delete(user)
    db.commit()
    db.close()
    return {"message": "Account deleted"}

@app.get("/api/admin/users")
def get_users(admin_email: str):
    db = SessionLocal()
    admin = db.query(User).filter(User.email == admin_email).first()
    if not admin or admin.role != "admin":
        db.close()
        raise HTTPException(403, "Access denied")
    users = db.query(User).all()
    result = [{"email": u.email, "name": u.name, "role": u.role, "status": u.status} for u in users]
    db.close()
    return result

@app.post("/api/admin/update-role")
def update_role(data: dict):
    db = SessionLocal()
    admin = db.query(User).filter(User.email == data.get("admin_email")).first()
    if not admin or admin.role != "admin":
        db.close()
        raise HTTPException(403, "Access denied")
    user = db.query(User).filter(User.email == data.get("email")).first()
    if not user:
        db.close()
        raise HTTPException(404, "User not found")
    user.role = data.get("role")
    user.status = "active"
    db.commit()
    db.close()
    return {"message": "Role updated"}

@app.delete("/api/admin/delete-user")
def delete_user(data: dict):
    db = SessionLocal()
    admin = db.query(User).filter(User.email == data.get("admin_email")).first()
    if not admin or admin.role != "admin":
        db.close()
        raise HTTPException(403, "Access denied")
    user = db.query(User).filter(User.email == data.get("email")).first()
    if not user:
        db.close()
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    db.close()
    return {"message": "User deleted"}

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
        raise HTTPException(400, "Unknown scenario")
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

@app.post("/api/run/demographics")
def run_with_demographics(req: ScenarioRunRequest):
    if req.scenario not in SCENARIOS:
        raise HTTPException(400, f"Unknown scenario '{req.scenario}'")
    from leap_model import run_scenario_with_demographics
    return run_scenario_with_demographics(req.scenario, req.start_year, req.end_year)

@app.get("/api/compare/demographics")
def compare_demographics():
    from leap_model import run_scenario_with_demographics
    return {
        key: run_scenario_with_demographics(key, 2024, 2060)
        for key in ["BAU", "MT", "DD"]
    }

from fastapi import UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from data_parser import parse_csv_auto, extract_energy_indicators
from excel_parser import parse_kzleap_excel, create_template_excel
from leap_model import load_excel_data, get_active_dataset_info

import shutil

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

uploaded_datasets = {}

@app.get("/api/template")
def download_template():
    """Скачать шаблон Excel-файла KZLEAP_DATA_TEMPLATE.xlsx"""
    try:
        excel_bytes = create_template_excel()
        return StreamingResponse(
            iter([excel_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="KZLEAP_DATA_TEMPLATE.xlsx"'},
        )
    except Exception as e:
        raise HTTPException(500, f"Не удалось создать шаблон: {e}")


@app.get("/api/active-dataset")
def active_dataset():
    """Возвращает информацию об активном датасете (встроенный или из Excel)."""
    return get_active_dataset_info()


@app.post("/api/upload")
async def upload_dataset(request: Request, file: UploadFile = File(...)):
    file_bytes = await file.read()
    filename   = file.filename or ""

    # ── Excel (.xlsx / .xls) ─ KZLEAP-формат ─────────────────────────────
    if filename.lower().endswith((".xlsx", ".xls")):
        parsed = parse_kzleap_excel(file_bytes, filename)
        if "error" in parsed:
            raise HTTPException(422, parsed["error"])

        # Сохраняем файл на диск (для локальной работы) и в БД (для облака)
        dataset_id = filename.replace(" ", "_")
        file_path  = os.path.join(UPLOAD_DIR, dataset_id)
        try:
            with open(file_path, "wb") as f:
                f.write(file_bytes)
        except Exception:
            file_path = dataset_id  # fallback if disk not writable

        # Загружаем данные в leap_model (заменяет встроенные константы)
        load_excel_data(parsed)

        # Сохраняем в память и БД (content хранится в БД как base64)
        import base64
        file_content_b64 = base64.b64encode(file_bytes).decode("utf-8")
        uploaded_datasets[dataset_id] = parsed
        db = SessionLocal()
        existing = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
        if existing:
            existing.file_path    = file_path
            existing.source       = "kzleap_excel"
            existing.file_content = file_content_b64
        else:
            db.add(Dataset(
                dataset_id    = dataset_id,
                filename      = filename,
                source        = "kzleap_excel",
                uploaded_by   = request.headers.get("x-user-email", "unknown"),
                file_path     = file_path,
                file_content  = file_content_b64,
            ))
        db.commit()
        db.close()

        base_year = parsed.get("base_year")
        hist_years = sorted(parsed.get("historical_co2", {}).keys())

        return {
            "status":     "ok",
            "filename":   filename,
            "source":     "kzleap_excel",
            "dataset_id": dataset_id,
            "summary": {
                "base_year":       base_year,
                "base_co2_mt":     parsed.get("base_co2"),
                "base_elec_twh":   parsed.get("base_elec"),
                "historical_years": f"{min(hist_years)}–{max(hist_years)}" if hist_years else "—",
                "scenarios_loaded": list(parsed.get("scenarios", {}).keys()),
                "message":         "Данные из Excel загружены. Все расчёты теперь используют ваш файл.",
            },
        }

    # ── CSV ─ старый формат (OWID / World Bank) ───────────────────────────
    if filename.lower().endswith(".csv"):
        content = file_bytes.decode("utf-8", errors="replace")
        parsed  = parse_csv_auto(content, filename)
        if "error" in parsed:
            raise HTTPException(422, parsed["error"])

        dataset_id = filename.replace(" ", "_")
        file_path  = os.path.join(UPLOAD_DIR, dataset_id)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            file_path = dataset_id

        uploaded_datasets[dataset_id] = parsed
        db = SessionLocal()
        existing = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
        if not existing:
            db.add(Dataset(
                dataset_id   = dataset_id,
                filename     = filename,
                source       = parsed.get("source"),
                uploaded_by  = request.headers.get("x-user-email", "unknown"),
                file_path    = file_path,
                file_content = content,
            ))
        else:
            existing.file_content = content
        db.commit()
        db.close()

        summary = {}
        if parsed.get("source") == "worldbank":
            energy = extract_energy_indicators(parsed)
            uploaded_datasets[dataset_id + "_energy"] = energy
            summary = {
                "indicators_found":  parsed.get("indicators_found", 0),
                "energy_indicators": list(energy.keys()),
            }
        elif parsed.get("source") == "owid":
            summary = {
                "indicator":   parsed.get("indicator"),
                "years_range":  f"{min(parsed['years'])}–{max(parsed['years'])}" if parsed.get("years") else "—",
                "data_points":  len(parsed.get("data", {})),
            }

        return {
            "status":     "ok",
            "filename":   filename,
            "source":     parsed.get("source"),
            "summary":    summary,
            "dataset_id": dataset_id,
        }

    raise HTTPException(400, "Поддерживаемые форматы: .xlsx (KZLEAP-шаблон), .csv (OWID / World Bank)")

@app.get("/api/datasets")
def list_datasets():
    db = SessionLocal()
    datasets = db.query(Dataset).all()
    db.close()
    return [
        {
            "dataset_id": d.dataset_id,
            "filename": d.filename,
            "source": d.source,
            "uploaded_by": d.uploaded_by,
            "uploaded_at": d.uploaded_at.strftime("%Y-%m-%d %H:%M") if d.uploaded_at else "",
        }
        for d in datasets
    ]

@app.get("/api/datasets/{dataset_id}/co2")
def get_dataset_co2(dataset_id: str):
    # Сначала ищем в памяти
    if dataset_id in uploaded_datasets:
        return uploaded_datasets[dataset_id]
    
    # Если нет в памяти — загружаем с диска
    db = SessionLocal()
    record = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    db.close()
    
    if not record:
        raise HTTPException(404, "Dataset not found")

    # ── Try loading from DB content first (works in cloud/Railway) ──────
    if record.file_content:
        filename_lower = (record.filename or "").lower()
        if filename_lower.endswith((".xlsx", ".xls")):
            import base64
            file_bytes = base64.b64decode(record.file_content)
            parsed = parse_kzleap_excel(file_bytes, record.filename)
            if "error" not in parsed:
                uploaded_datasets[dataset_id] = parsed
                load_excel_data(parsed)
                return parsed
        else:
            parsed = parse_csv_auto(record.file_content, record.filename)
            if "error" not in parsed:
                uploaded_datasets[dataset_id] = parsed
                return parsed

    # ── Fallback: try disk ───────────────────────────────────────────────
    file_path = record.file_path
    filename_only = os.path.basename(file_path.replace('\\', '/').replace('\\', os.sep))
    local_path = os.path.join(UPLOAD_DIR, filename_only)
    if not os.path.exists(file_path) and os.path.exists(local_path):
        file_path = local_path

    if not os.path.exists(file_path):
        raise HTTPException(404, f"File not found. Please re-upload the dataset.")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    parsed = parse_csv_auto(content, record.filename)
    uploaded_datasets[dataset_id] = parsed
    return parsed

@app.delete("/api/datasets/{dataset_id}")
def delete_dataset(dataset_id: str):
    db = SessionLocal()
    record = db.query(Dataset).filter(Dataset.dataset_id == dataset_id).first()
    if not record:
        db.close()
        raise HTTPException(404, "Dataset not found")
    
    # Удаляем файл с диска
    if os.path.exists(record.file_path):
        os.remove(record.file_path)
    
    # Удаляем из БД
    db.delete(record)
    db.commit()
    db.close()
    
    # Удаляем из памяти
    uploaded_datasets.pop(dataset_id, None)
    uploaded_datasets.pop(dataset_id + '_energy', None)
    
    return {"message": "Dataset deleted"}

import io, csv as csv_module
CSV_HEADERS = {
    'en': {
        'year':     'Year',
        'bau_co2':  'BAU_CO2_Mt',
        'mt_co2':   'MT_CO2_Mt',
        'dd_co2':   'DD_CO2_Mt',
        'bau_elec': 'BAU_Electricity_TWh',
        'mt_elec':  'MT_Electricity_TWh',
        'dd_elec':  'DD_Electricity_TWh',
        'bau_re':   'BAU_RE_Share_pct',
        'mt_re':    'MT_RE_Share_pct',
        'dd_re':    'DD_RE_Share_pct',
        'bau_coal': 'BAU_Coal_Share_pct',
        'mt_coal':  'MT_Coal_Share_pct',
        'dd_coal':  'DD_Coal_Share_pct',
        'ndc_unc':  'NDC_Unconditional_Mt',
        'ndc_con':  'NDC_Conditional_Mt',
        # summary
        'dd_vs_bau':   'DD_vs_BAU_Mt',
        'reduction':   'Reduction_pct',
    },
    'ru': {
        'year':     'Год',
        'bau_co2':  'BAU_CO2_Мт',
        'mt_co2':   'МП_CO2_Мт',
        'dd_co2':   'ГД_CO2_Мт',
        'bau_elec': 'BAU_Электроэнергия_ТВтч',
        'mt_elec':  'МП_Электроэнергия_ТВтч',
        'dd_elec':  'ГД_Электроэнергия_ТВтч',
        'bau_re':   'BAU_ВИЭ_доля_%',
        'mt_re':    'МП_ВИЭ_доля_%',
        'dd_re':    'ГД_ВИЭ_доля_%',
        'bau_coal': 'BAU_Уголь_доля_%',
        'mt_coal':  'МП_Уголь_доля_%',
        'dd_coal':  'ГД_Уголь_доля_%',
        'ndc_unc':  'НОО_Безусловная_Мт',
        'ndc_con':  'НОО_Условная_Мт',
        'dd_vs_bau': 'ГД_к_BAU_Мт',
        'reduction': 'Снижение_%',
    },
    'kk': {
        'year':     'Жыл',
        'bau_co2':  'BAU_CO2_Мт',
        'mt_co2':   'ОК_CO2_Мт',
        'dd_co2':   'ТД_CO2_Мт',
        'bau_elec': 'BAU_Электр_ТВтс',
        'mt_elec':  'ОК_Электр_ТВтс',
        'dd_elec':  'ТД_Электр_ТВтс',
        'bau_re':   'BAU_ЖЭК_үлес_%',
        'mt_re':    'ОК_ЖЭК_үлес_%',
        'dd_re':    'ТД_ЖЭК_үлес_%',
        'bau_coal': 'BAU_Көмір_үлес_%',
        'mt_coal':  'ОК_Көмір_үлес_%',
        'dd_coal':  'ТД_Көмір_үлес_%',
        'ndc_unc':  'ҰАЖ_шартсыз_Мт',
        'ndc_con':  'ҰАЖ_шартты_Мт',
        'dd_vs_bau': 'ТД_BAU-ға_Мт',
        'reduction': 'Азаю_%',
    },
}
@app.get("/api/export/csv")
def export_csv(lang: str = 'en'):
    h = CSV_HEADERS.get(lang, CSV_HEADERS['en'])
    data = compare_scenarios()
    BAU, MT, DD = data['BAU'], data['MT'], data['DD']
    years = BAU['years']
    output = io.StringIO()
    writer = csv_module.writer(output, delimiter=';')
    writer.writerow([
        h['year'],
        h['bau_co2'], h['mt_co2'], h['dd_co2'],
        h['bau_elec'], h['mt_elec'], h['dd_elec'],
        h['bau_re'],  h['mt_re'],  h['dd_re'],
        h['bau_coal'],h['mt_coal'],h['dd_coal'],
        h['ndc_unc'], h['ndc_con'],
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
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': 'attachment; filename="KZLEAP_Scenarios.csv"'}
    )
 
 
@app.get("/api/export/summary")
def export_summary(lang: str = 'en'):
    h = CSV_HEADERS.get(lang, CSV_HEADERS['en'])
    data = compare_scenarios()
    BAU, MT, DD = data['BAU'], data['MT'], data['DD']
    years = BAU['years']
    milestones = {2025, 2030, 2035, 2040, 2045, 2050, 2060}
    output = io.StringIO()
    writer = csv_module.writer(output, delimiter=';')
    writer.writerow([
        h['year'],
        h['bau_co2'], h['mt_co2'], h['dd_co2'],
        h['dd_vs_bau'], h['reduction'],
    ])
    for i, year in enumerate(years):
        if year not in milestones:
            continue
        b, m, d = round(BAU['co2'][i], 1), round(MT['co2'][i], 1), round(DD['co2'][i], 1)
        writer.writerow([year, b, m, d, round(b-d, 1), round((b-d)/b*100, 1)])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': 'attachment; filename="KZLEAP_Summary.csv"'}
    )

@app.get("/api/config")
def get_config():
    """
    Возвращает базовые значения активного датасета.
    Фронтенд использует эти значения вместо захардкоженных констант.
    """
    from leap_model import (
        _BASE_CO2, _BASE_ELEC, _BASE_TPES, _BASE_POP,
        BASE_YEAR_1990_CO2, NDC_TARGET_2030_PCT, NDC_CONDITIONAL_2030_PCT,
        CARBON_NEUTRALITY_YEAR, HISTORICAL_CO2, get_active_dataset_info
    )
    base_year = max(HISTORICAL_CO2.keys()) if HISTORICAL_CO2 else 2023
    ndc_unc = round(BASE_YEAR_1990_CO2 * (1 + NDC_TARGET_2030_PCT / 100), 1)
    ndc_con = round(BASE_YEAR_1990_CO2 * (1 + NDC_CONDITIONAL_2030_PCT / 100), 1)
    return {
        "base_co2":          round(_BASE_CO2, 1),
        "base_elec":         round(_BASE_ELEC, 1),
        "base_tpes":         round(_BASE_TPES, 1),
        "base_pop":          round(_BASE_POP, 2),
        "base_year":         base_year,
        "ndc_unconditional": ndc_unc,
        "ndc_conditional":   ndc_con,
        "neutrality_year":   CARBON_NEUTRALITY_YEAR,
        "ndc_base_co2":      round(BASE_YEAR_1990_CO2, 1),
        "dataset":           get_active_dataset_info(),
    }

@app.get("/api/export/csv")
def export_csv():
    data = compare_scenarios()
    BAU, MT, DD = data['BAU'], data['MT'], data['DD']
    years = BAU['years']
    output = io.StringIO()
    writer = csv_module.writer(output, delimiter=';')
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
    writer = csv_module.writer(output, delimiter=';')
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

@app.post("/api/run/custom")
def run_custom_scenario(req: CustomScenarioRequest):
    import copy
    years = list(range(req.start_year, req.end_year + 1))
    base_co2 = 242.0
    base_elec = 115.0
    base_tpes = 85.0
    base_pop = 20.1
    base_urban = 58.0
    base_working = 66.5
    base_gdp_pc = 13.0
    base_elec_pc = base_elec / base_pop

    results = {
        "scenario": "custom",
        "name": req.name,
        "years": years,
        "co2": [], "electricity": [], "renewables_share": [],
        "coal_share": [], "gas_share": [], "hydro_share": [],
        "nuclear_share": [], "tpes": [], "energy_demand": [],
        "population": [], "urban_pct": [], "working_age_pct": [],
        "gdp_per_capita": [], "elec_per_capita": [], "co2_per_capita": [],
        "residential_demand": [], "industry_demand": [], "transport_demand": [],
    }

    for i, year in enumerate(years):
        t = year - 2023
        pop = base_pop * (1 + req.pop_growth_rate / 100) ** t
        urban = min(base_urban + req.urbanization_rate * t, 85.0)
        working = base_working + (req.working_age_2050 - base_working) * (t / 27)
        gdp_pc = base_gdp_pc * (1 + req.gdp_per_capita_growth / 100) ** t
        urban_factor = 1 + (urban - base_urban) / 100 * 0.5
        income_factor = (gdp_pc / base_gdp_pc) ** req.income_elasticity
        eff_factor = (1 - req.efficiency / 100) ** t
        elec_pc = base_elec_pc * urban_factor * income_factor * eff_factor
        elec = pop * elec_pc
        re_target_2050 = req.renewables_2050 / 100
        re_target_2030 = min(re_target_2050 * 0.55, 0.30)
        if year <= 2030:
            re = 0.05 + (re_target_2030 - 0.05) * ((year - 2023) / 7)
        elif year <= 2050:
            re = re_target_2030 + (re_target_2050 - re_target_2030) * ((year - 2030) / 20)
        else:
            re = re_target_2050
        re = min(re, 0.85)
        if year >= 2035 and req.nuclear_gw > 0:
            nuc_ramp = min((year - 2035) / 10, 1.0)
            nuc = min((req.nuclear_gw * nuc_ramp) / max(elec, 1) * 8760 / 1000, 0.15)
        else:
            nuc = 0.0
        hydro = 0.10
        fossil = max(1.0 - re - nuc - hydro, 0.05)
        coal = min(max(0.61 - (req.coal_phase_rate / 100) * t, 0.02), fossil)
        gas = max(fossil - coal, 0.0)
        results["renewables_share"].append(round(re * 100, 1))
        results["coal_share"].append(round(coal * 100, 1))
        results["gas_share"].append(round(gas * 100, 1))
        results["hydro_share"].append(round(hydro * 100, 1))
        results["nuclear_share"].append(round(nuc * 100, 1))
        results["electricity"].append(round(elec, 1))
        coal_co2 = elec * coal * 0.82
        gas_co2 = elec * gas * 0.49
        non_power = base_co2 * 0.40 * income_factor * eff_factor
        cp_red = max(1.0 - (req.carbon_price / 1000) * 0.5, 0.5)
        ev_red = 1.0 - (req.ev_share / 100) * 0.15 * min(t / 26, 1.0)
        co2 = (coal_co2 + gas_co2 + non_power) * cp_red * ev_red
        results["co2"].append(round(co2, 1))
        tpes = base_tpes * income_factor * eff_factor
        results["tpes"].append(round(tpes, 1))
        results["energy_demand"].append(round(tpes * 0.95, 1))
        residential = pop * elec_pc * 0.25
        industry = elec * 0.45 * (working / base_working)
        transport = pop * 0.8 * (gdp_pc / base_gdp_pc) ** 0.4 * (1 - req.ev_share / 100 * 0.3 * min(t / 26, 1))
        results["population"].append(round(pop, 2))
        results["urban_pct"].append(round(urban, 1))
        results["working_age_pct"].append(round(working, 1))
        results["gdp_per_capita"].append(round(gdp_pc, 1))
        results["elec_per_capita"].append(round(elec_pc * 1000, 0))
        results["co2_per_capita"].append(round(co2 / pop, 2))
        results["residential_demand"].append(round(residential, 1))
        results["industry_demand"].append(round(industry, 1))
        results["transport_demand"].append(round(transport, 1))

    return results



class InvestmentRequest(BaseModel):
    budget_bn_usd: float = 10.0
    horizon_year: int = 2035
    scenario: str = "MT"
    priority: str = "cost"
    run_monte_carlo: bool = True

@app.post("/api/investment-plan")
def investment_plan(req: InvestmentRequest):
    if req.scenario not in SCENARIOS:
        raise HTTPException(400, "Unknown scenario")
    sc_data   = run_scenario(req.scenario, req.horizon_year, req.horizon_year)
    demand    = sc_data["electricity"][-1] if sc_data.get("electricity") else 130.0
    params    = SCENARIOS[req.scenario]
    re_target = params.get("renewables_2030", 0.15) if req.horizon_year <= 2030 else params.get("renewables_2050", 0.40)
    nuc_gw    = params.get("nuclear_gw_2035", 0.0) if req.horizon_year >= 2035 else 0.0
    return run_investment_plan(
        budget_bn_usd        = req.budget_bn_usd,
        horizon_year         = req.horizon_year,
        scenario             = req.scenario,
        demand_twh           = demand,
        renewables_target    = re_target,
        nuclear_available_gw = nuc_gw,
        priority             = req.priority,
        run_monte_carlo      = req.run_monte_carlo,
    )


class SensitivityShock(BaseModel):
    param: str
    delta_pct: float = 0.0
    value: Optional[float] = None
    label: Optional[str] = None

class SensitivityRequest(BaseModel):
    scenario: str = "MT"
    year: int = 2035
    shocks: List[SensitivityShock] = []

@app.post("/api/sensitivity")
def sensitivity_analysis(req: SensitivityRequest):
    if req.scenario not in SCENARIOS:
        raise HTTPException(400, "Unknown scenario")
    sc_data = run_scenario(req.scenario, req.year, req.year)
    demand  = sc_data["electricity"][-1] if sc_data.get("electricity") else 130.0
    params  = SCENARIOS[req.scenario]
    re_target = params.get("renewables_2030", 0.15) if req.year <= 2030 else params.get("renewables_2050", 0.40)
    nuclear_gw = params.get("nuclear_gw_2035", 0.0) if req.year >= 2035 else 0.0
    shocks = [s.dict() for s in req.shocks]
    return run_sensitivity_analysis(
        base_demand_twh=demand,
        scenario=req.scenario,
        year=req.year,
        renewables_target=re_target,
        nuclear_available_gw=nuclear_gw,
        technologies=TECHNOLOGIES,
        discount_rate=DISCOUNT_RATE,
        shocks=shocks,
    )


class CustomTargetRequest(BaseModel):
    neutrality_year: int = 2060
    reduction_pct_2030: float = 15.0
    reduction_pct_2050: float = 60.0

@app.post("/api/carbon-budget/custom-target")
def custom_carbon_target(req: CustomTargetRequest):
    data = compare_scenarios()
    return compute_custom_target(
        scenarios_compare   = data,
        neutrality_year     = req.neutrality_year,
        reduction_pct_2030  = req.reduction_pct_2030,
        reduction_pct_2050  = req.reduction_pct_2050,
    )


@app.get("/api/carbon-budget")
def carbon_budget():
    data = compare_scenarios()
    return compute_carbon_budget(data)


class ClaudeRequest(BaseModel):
    messages: list
    system: Optional[str] = None
    max_tokens: int = 1000
    stream: bool = False

@app.post("/api/claude")
async def claude_proxy(req: ClaudeRequest, request: Request):
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "GROQ_API_KEY not set in .env")

    messages = req.messages
    if req.system:
        messages = [{"role": "system", "content": req.system}] + list(messages)

    payload = {
        "model": "llama-3.3-70b-versatile",
        "max_tokens": req.max_tokens,
        "messages": messages,
        "stream": req.stream,
    }

    from fastapi.responses import StreamingResponse

    if req.stream:
        async def event_stream():
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "content-type": "application/json",
                    },
                    json=payload,
                ) as resp:
                    async for chunk in resp.aiter_bytes():
                        yield chunk
        return StreamingResponse(event_stream(), media_type="text/event-stream")

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json=payload,
        )
    return resp.json()

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
