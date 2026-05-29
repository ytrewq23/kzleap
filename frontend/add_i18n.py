#!/usr/bin/env python3
"""
Run from frontend/ folder:
  cd /Users/aliyaseitova/Desktop/kzleap/frontend
  python3 add_i18n.py
"""
import os, re

PAGES = [
    'results.html','scenario.html','sensitivity.html','carbon-budget.html',
    'reports.html','upload.html','whatif.html','scenario-ai.html','lp-optimizer.html',
]

LANG_CSS = '''  <style>
    .lang-switcher{display:flex;gap:4px;align-items:center;margin-right:8px;}
    .lang-btn{padding:3px 8px;font-size:11px;font-weight:600;border:1px solid #d0d7e2;border-radius:4px;background:transparent;color:#4a5568;cursor:pointer;transition:all 0.15s;}
    .lang-btn:hover{background:#f0f4f8;color:#1a2b4a;}
    .lang-btn.active{background:#1a2b4a;color:#fff;border-color:#1a2b4a;}
  </style>'''

LANG_BTNS = '''        <div class="lang-switcher">
          <button class="lang-btn" data-lang="en" onclick="setLang('en')">EN</button>
          <button class="lang-btn" data-lang="ru" onclick="setLang('ru')">RU</button>
          <button class="lang-btn" data-lang="kk" onclick="setLang('kk')">KK</button>
        </div>'''

TRANSLATIONS_SCRIPT = "  <script src=\"translations.js\"></script>\n  <script>document.addEventListener('DOMContentLoaded', applyTranslations);</script>"

COMMON = [
    ('<div class="logo-sub">Energy Platform</div>', '<div class="logo-sub" data-i18n="energy_platform">Energy Platform</div>'),
    ('<div class="nav-section">Main</div>', '<div class="nav-section" data-i18n="nav_main">Main</div>'),
    ('<div class="nav-section">Scenarios</div>', '<div class="nav-section" data-i18n="nav_scenarios">Scenarios</div>'),
    ('<div class="nav-section">Output</div>', '<div class="nav-section" data-i18n="nav_output">Output</div>'),
    ('<div class="nav-section">Tools</div>', '<div class="nav-section" data-i18n="nav_tools">Tools</div>'),
    ('nav-icon">▦</span> Dashboard</a>', 'nav-icon">▦</span> <span data-i18n="nav_dashboard">Dashboard</span></a>'),
    ('nav-icon">↑</span> Upload Dataset</a>', 'nav-icon">↑</span> <span data-i18n="nav_upload">Upload Dataset</span></a>'),
    ('nav-icon">◈</span> Scenario Builder</a>', 'nav-icon">◈</span> <span data-i18n="nav_scenario_builder">Scenario Builder</span></a>'),
    ('nav-icon">▰</span> Simulation Results</a>', 'nav-icon">▰</span> <span data-i18n="nav_sim_results">Simulation Results</span></a>'),
    ('nav-icon">▶</span> What-If Analyzer</a>', 'nav-icon">▶</span> <span data-i18n="nav_whatif">What-If Analyzer</span></a>'),
    ('nav-icon">◻</span> Reports</a>', 'nav-icon">◻</span> <span data-i18n="nav_reports">Reports</span></a>'),
    ('nav-icon">⚡</span> Mix Optimizer</a>', 'nav-icon">⚡</span> <span data-i18n="nav_mix_optimizer">Mix Optimizer</span></a>'),
    ('nav-icon">◎</span> Smart Analysis</a>', 'nav-icon">◎</span> <span data-i18n="nav_smart_analysis">Smart Analysis</span></a>'),
    ('nav-icon">◬</span> Sensitivity Analysis</a>', 'nav-icon">◬</span> <span data-i18n="nav_sensitivity">Sensitivity Analysis</span></a>'),
    ('nav-icon">◉</span> Carbon Budget</a>', 'nav-icon">◉</span> <span data-i18n="nav_carbon_budget">Carbon Budget</span></a>'),
]

PAGE_SPECIFIC = {
    'results.html': [
        ('<h2>Simulation Results</h2>', '<h2 data-i18n="results_title">Simulation Results</h2>'),
        ('<p>BAU · Moderate Transition', '<p data-i18n="results_sub">BAU · Moderate Transition'),
        ('>Export Report', ' data-i18n="results_export">Export Report'),
        ('>CO2 emissions forecast 2021', ' data-i18n="chart_co2f_title">CO2 emissions forecast 2021'),
        ('>Electricity generation forecast (TWh)<', ' data-i18n="chart_elecf_title">Electricity generation forecast (TWh)<'),
        ('>Fuel mix 2050 comparison<', ' data-i18n="chart_fuel_title">Fuel mix 2050 comparison<'),
        ('>Year-by-year results<', ' data-i18n="table_results_title">Year-by-year results<'),
        ('>All years<', ' data-i18n="btn_all_years">All years<'),
        ('>Every 5 years<', ' data-i18n="btn_every5">Every 5 years<'),
        ('<div class="metric-label">Baseline CO2 (2023)</div>', '<div class="metric-label" data-i18n="kpi_baseline_label">Baseline CO2 (2023)</div>'),
        ('<div class="metric-label">BAU projection (2050)</div>', '<div class="metric-label" data-i18n="kpi_bau_label">BAU projection (2050)</div>'),
        ('<div class="metric-label">Deep Decarbonization (2050)</div>', '<div class="metric-label" data-i18n="kpi_dd_label">Deep Decarbonization (2050)</div>'),
        ('<div class="metric-label">CO2 avoided by 2050 (DD vs BAU)</div>', '<div class="metric-label" data-i18n="kpi_avoided_label">CO2 avoided by 2050 (DD vs BAU)</div>'),
        ('<div class="card-sub">BAU · Moderate Transition · Deep Decarbonization · Mt CO2 · with NDC targets</div>', '<div class="card-sub" data-i18n="chart_co2f_sub">BAU · Moderate Transition · Deep Decarbonization · Mt CO2 · with NDC targets</div>'),
        ('<div class="card-sub">Total generation · BAU · MT · DD</div>', '<div class="card-sub" data-i18n="chart_elecf_sub">Total generation · BAU · MT · DD</div>'),
        ('<div class="card-sub">Share of each fuel type · %</div>', '<div class="card-sub" data-i18n="chart_fuel_sub">Share of each fuel type · %</div>'),
        ('<div class="card-sub">CO2 emissions · Million tonnes</div>', '<div class="card-sub" data-i18n="table_results_sub">CO2 emissions · Million tonnes</div>'),
        ('<th>Year</th>', '<th data-i18n="col_year">Year</th>'),
        ('<th style="color:#378ADD;">BAU (Mt CO2)</th>', '<th style="color:#378ADD;" data-i18n="col_bau">BAU (Mt CO2)</th>'),
        ('<th style="color:#B07C10;">MT (Mt CO2)</th>', '<th style="color:#B07C10;" data-i18n="col_mt">MT (Mt CO2)</th>'),
        ('<th style="color:#0F6E56;">DD (Mt CO2)</th>', '<th style="color:#0F6E56;" data-i18n="col_dd">DD (Mt CO2)</th>'),
        ('<th>DD vs BAU (Mt)</th>', '<th data-i18n="col_dd_vs_bau">DD vs BAU (Mt)</th>'),
        ('<th>Reduction (%)</th>', '<th data-i18n="col_reduction">Reduction (%)</th>'),
    ],
    'scenario.html': [
        ('<h2>Scenario Builder</h2>', '<h2 data-i18n="scenario_title">Scenario Builder</h2>'),
        ('<p>Configure BAU', '<p data-i18n="scenario_sub">Configure BAU'),
        ('>BAU — Business as Usual<', ' data-i18n="tab_bau">BAU — Business as Usual<'),
        ('>Moderate Transition<', ' data-i18n="tab_mt">Moderate Transition<'),
        ('>Deep Decarbonization<', ' data-i18n="tab_dd">Deep Decarbonization<'),
        ('>BAU Scenario settings<', ' data-i18n="bau_settings_title">BAU Scenario settings<'),
        ('>Moderate Transition settings<', ' data-i18n="mt_settings_title">Moderate Transition settings<'),
        ('>Deep Decarbonization settings<', ' data-i18n="dd_settings_title">Deep Decarbonization settings<'),
        ('>Saved scenarios<', ' data-i18n="saved_scenarios">Saved scenarios<'),
        ('<div class="card-sub">Business as Usual', '<div class="card-sub" data-i18n="bau_settings_sub">Business as Usual'),
        ('<div class="card-sub">Implements Kazakhstan NDC', '<div class="card-sub" data-i18n="mt_settings_sub">Implements Kazakhstan NDC'),
        ('<div class="card-sub">Carbon neutrality by 2060', '<div class="card-sub" data-i18n="dd_settings_sub">Carbon neutrality by 2060'),
        ('<div class="card-sub">Ready for simulation</div>', '<div class="card-sub" data-i18n="saved_scenarios_sub">Ready for simulation</div>'),
        ('<div class="card-sub">Based on Kazakhstan historical', '<div class="card-sub" data-i18n="bau_params_sub">Based on Kazakhstan historical'),
        ('<label>Scenario name</label>', '<label data-i18n="scenario_name_lbl">Scenario name</label>'),
        ('<label>Base year</label>', '<label data-i18n="base_year_lbl">Base year</label>'),
        ('<label>Projection period</label>', '<label data-i18n="period_lbl">Projection period</label>'),
        ('<label>Base dataset</label>', '<label data-i18n="base_dataset_lbl">Base dataset</label>'),
        ('>Save BAU Scenario<', ' data-i18n="save_bau">Save BAU Scenario<'),
        ('>Save MT Scenario<', ' data-i18n="save_mt">Save MT Scenario<'),
        ('>Save DD Scenario<', ' data-i18n="save_dd">Save DD Scenario<'),
        ('>BAU growth parameters<', ' data-i18n="bau_params_title">BAU growth parameters<'),
        ('>MT — Adjust policy levers<', ' data-i18n="mt_levers_title">MT — Adjust policy levers<'),
        ('>DD — Adjust policy levers<', ' data-i18n="dd_levers_title">DD — Adjust policy levers<'),
        ('<div class="card-sub">Move sliders', '<div class="card-sub" data-i18n="sliders_sub">Move sliders'),
    ],
    'sensitivity.html': [
        ('<h2>Sensitivity Analysis</h2>', '<h2 data-i18n="sensitivity_title">Sensitivity Analysis</h2>'),
        ('<p>Stress-test', '<p data-i18n="sensitivity_sub">Stress-test'),
        ('>Base configuration<', ' data-i18n="base_config_title">Base configuration<'),
        ('<div class="card-sub">LP optimization runs under each shock', '<div class="card-sub" data-i18n="base_config_sub">LP optimization runs under each shock'),
        ('<label class="lp-label">Scenario</label>', '<label class="lp-label" data-i18n="lp_scenario_lbl">Scenario</label>'),
        ('<label class="lp-label">Target year</label>', '<label class="lp-label" data-i18n="lp_year_lbl">Target year</label>'),
        ('>Parameter shocks<', ' data-i18n="shocks_title">Parameter shocks<'),
        ('<div class="card-sub">Each shock runs a separate LP', '<div class="card-sub" data-i18n="shocks_sub">Each shock runs a separate LP'),
        ('>Run sensitivity analysis<', ' data-i18n="btn_run_sensitivity">Run sensitivity analysis<'),
        ('>Preset: fuel price shock<', ' data-i18n="preset_price">Preset: fuel price shock<'),
        ('>Preset: RE cost drop<', ' data-i18n="preset_tech">Preset: RE cost drop<'),
        ('>Preset: carbon tax<', ' data-i18n="preset_carbon">Preset: carbon tax<'),
        ('>+ Add shock<', ' data-i18n="btn_add_shock">+ Add shock<'),
        ('>Shock impact summary<', ' data-i18n="shock_summary_title">Shock impact summary<'),
        ('<div class="card-sub">Change relative to baseline', '<div class="card-sub" data-i18n="shock_summary_sub">Change relative to baseline'),
        ('<th>Shock</th>', '<th data-i18n="col_shock">Shock</th>'),
        ('<th>System cost (B$/yr)</th>', '<th data-i18n="col_cost">System cost (B$/yr)</th>'),
        ('<th>Cost change</th>', '<th data-i18n="col_cost_chg">Cost change</th>'),
        ('<th>CO2 (Mt)</th>', '<th data-i18n="col_co2">CO2 (Mt)</th>'),
        ('<th>CO2 change</th>', '<th data-i18n="col_co2_chg">CO2 change</th>'),
        ('<th>RE share (%)</th>', '<th data-i18n="col_re">RE share (%)</th>'),
        ('<th>RE change (pp)</th>', '<th data-i18n="col_re_chg">RE change (pp)</th>'),
        ('<th>LCOE ($/MWh)</th>', '<th data-i18n="col_lcoe">LCOE ($/MWh)</th>'),
        ('<th>LCOE change</th>', '<th data-i18n="col_lcoe_chg">LCOE change</th>'),
        ('>Cost sensitivity<', ' data-i18n="chart_cost_title">Cost sensitivity<'),
        ('<div class="card-sub">System cost B$/yr per shock</div>', '<div class="card-sub" data-i18n="chart_cost_sub">System cost B$/yr per shock</div>'),
        ('>CO2 sensitivity<', ' data-i18n="chart_co2s_title">CO2 sensitivity<'),
        ('<div class="card-sub">Total CO2 Mt per shock</div>', '<div class="card-sub" data-i18n="chart_co2s_sub">Total CO2 Mt per shock</div>'),
        ('>RE share sensitivity<', ' data-i18n="chart_res_title">RE share sensitivity<'),
        ('<div class="card-sub">Renewables share % per shock</div>', '<div class="card-sub" data-i18n="chart_res_sub">Renewables share % per shock</div>'),
        ('>AI interpretation<', ' data-i18n="ai_interp_title">AI interpretation<'),
        ('<div class="card-sub">Which shocks matter most', '<div class="card-sub" data-i18n="ai_interp_sub">Which shocks matter most'),
        ('>Explain results<', ' data-i18n="btn_explain">Explain results<'),
    ],
    'carbon-budget.html': [
        ('<h2>Carbon Budget Tracker</h2>', '<h2 data-i18n="cb_title">Carbon Budget Tracker</h2>'),
        ('<p>NDC compliance', '<p data-i18n="cb_sub">NDC compliance'),
        ('>CO2 trajectory vs NDC targets<', ' data-i18n="cb_traj_title">CO2 trajectory vs NDC targets<'),
        ('<div class="card-sub">All scenarios · Mt CO2 · NDC', '<div class="card-sub" data-i18n="cb_traj_sub">All scenarios · Mt CO2 · NDC'),
        ('>Budget consumption<', ' data-i18n="cb_budget_title">Budget consumption<'),
        ('<div class="card-sub">% of IPCC 1.5C budget', '<div class="card-sub" data-i18n="cb_budget_sub">% of IPCC 1.5C budget'),
        ('>NDC compliance timeline<', ' data-i18n="cb_compliance_title">NDC compliance timeline<'),
        ('<div class="card-sub">Year each scenario achieves', '<div class="card-sub" data-i18n="cb_compliance_sub">Year each scenario achieves'),
        ('>Annual CO2 vs NDC targets<', ' data-i18n="cb_annual_title">Annual CO2 vs NDC targets<'),
        ('<div class="card-sub">Surplus (+) or deficit', '<div class="card-sub" data-i18n="cb_annual_sub">Surplus (+) or deficit'),
        ('>Custom CO2 target<', ' data-i18n="cb_custom_title">Custom CO2 target<'),
        ('<div class="card-sub">Set your own reduction targets', '<div class="card-sub" data-i18n="cb_custom_sub">Set your own reduction targets'),
        ('<label class="lp-label">Neutrality year</label>', '<label class="lp-label" data-i18n="cb_neutrality_lbl">Neutrality year</label>'),
        ('<label class="lp-label">Reduction by 2030', '<label class="lp-label" data-i18n="cb_red2030_lbl">Reduction by 2030'),
        ('<label class="lp-label">Reduction by 2050', '<label class="lp-label" data-i18n="cb_red2050_lbl">Reduction by 2050'),
        ('>Calculate<', ' data-i18n="btn_calculate">Calculate<'),
        ('>Kazakhstan NDC<', ' data-i18n="preset_ndc">Kazakhstan NDC<'),
        ('>Paris 1.5C aligned<', ' data-i18n="preset_paris">Paris 1.5C aligned<'),
        ('>Neutrality 2060<', ' data-i18n="preset_neutral">Neutrality 2060<'),
        ('>Highly ambitious<', ' data-i18n="preset_ambitious">Highly ambitious<'),
        ('>AI feasibility assessment<', ' data-i18n="cb_ai_title">AI feasibility assessment<'),
        ('<div class="card-sub">Policy pathway analysis', '<div class="card-sub" data-i18n="cb_ai_sub">Policy pathway analysis'),
        ('>Assess feasibility<', ' data-i18n="btn_assess">Assess feasibility<'),
    ],
    'reports.html': [
        ('<h2>Reports</h2>', '<h2 data-i18n="reports_title">Reports</h2>'),
        ('<p>Generate and download', '<p data-i18n="reports_sub">Generate and download'),
        ('>Full Scenario Report<', ' data-i18n="report_full_name">Full Scenario Report<'),
        ('<div class="report-desc">BAU and Low Carbon', '<div class="report-desc" data-i18n="report_full_desc">BAU and Low Carbon'),
        ('>Data Export<', ' data-i18n="report_export_name">Data Export<'),
        ('<div class="report-desc">Raw simulation results', '<div class="report-desc" data-i18n="report_export_desc">Raw simulation results'),
        ('>Executive Summary<', ' data-i18n="report_summary_name">Executive Summary<'),
        ('<div class="report-desc">Key findings for policymakers', '<div class="report-desc" data-i18n="report_summary_desc">Key findings for policymakers'),
        ('>Sector Analysis<', ' data-i18n="report_sector_name">Sector Analysis<'),
        ('<div class="report-desc">Energy breakdown', '<div class="report-desc" data-i18n="report_sector_desc">Energy breakdown'),
        ('>AI Analytical Report<', ' data-i18n="report_ai_name">AI Analytical Report<'),
        ('<div class="report-desc">Claude-generated narrative', '<div class="report-desc" data-i18n="report_ai_desc">Claude-generated narrative'),
        ('>Generate PDF<', ' data-i18n="btn_generate">Generate PDF<'),
        ('>Export Excel<', ' data-i18n="btn_export_excel">Export Excel<'),
        ('>Generate<', ' data-i18n="btn_gen_ai">Generate<'),
        ('>Generated reports<', ' data-i18n="gen_reports_title">Generated reports<'),
        ('<div class="card-sub">Your recent exports</div>', '<div class="card-sub" data-i18n="gen_reports_sub">Your recent exports</div>'),
        ('>Copy text<', ' data-i18n="btn_copy_text">Copy text<'),
        ('>Print / Save PDF<', ' data-i18n="btn_print">Print / Save PDF<'),
    ],
    'upload.html': [
        ('<h2>Upload Dataset</h2>', '<h2 data-i18n="upload_title">Upload Dataset</h2>'),
        ('<p>Add new energy data files', '<p data-i18n="upload_sub">Add new energy data files'),
        ('>Drag and drop your file here<', ' data-i18n="upload_drag">Drag and drop your file here<'),
        ('>Browse files<', ' data-i18n="btn_browse">Browse files<'),
        ('>Uploaded datasets<', ' data-i18n="uploaded_title">Uploaded datasets<'),
        ('<div class="card-sub">Available for scenario modeling</div>', '<div class="card-sub" data-i18n="uploaded_sub">Available for scenario modeling</div>'),
        ('>Expected file format<', ' data-i18n="format_title">Expected file format<'),
        ('<div class="card-sub">Your Excel file must follow', '<div class="card-sub" data-i18n="format_sub">Your Excel file must follow'),
        ('<th>File name</th>', '<th data-i18n="col_filename">File name</th>'),
        ('<th>Source</th>', '<th data-i18n="col_source">Source</th>'),
        ('<th>Date</th>', '<th data-i18n="col_date">Date</th>'),
        ('<th>Uploaded by</th>', '<th data-i18n="col_by">Uploaded by</th>'),
        ('<th>Summary</th>', '<th data-i18n="col_summary">Summary</th>'),
        ('<th>Status</th>', '<th data-i18n="col_status">Status</th>'),
    ],
    'whatif.html': [
        ('<h2>What-If Analyzer</h2>', '<h2 data-i18n="whatif_title">What-If Analyzer</h2>'),
        ('<p>Real-time policy scenario modeling', '<p data-i18n="whatif_sub_hero">Real-time policy scenario modeling'),
        ('>Interactive What-If Policy Simulator<', ' data-i18n="whatif_hero_title">Interactive What-If Policy Simulator<'),
        ('<p>Adjust parameters and see', '<p data-i18n="whatif_hero_sub">Adjust parameters and see'),
        ('>Policy parameters<', ' data-i18n="whatif_policy_params">Policy parameters<'),
        ('<div class="panel-sub">Adjust levers', '<div class="panel-sub" data-i18n="whatif_panel_sub">Adjust levers'),
        ('>Coal plant closures<', ' data-i18n="whatif_coal_closures">Coal plant closures<'),
        ('>Nuclear power plant<', ' data-i18n="whatif_nuclear">Nuclear power plant<'),
        ('>Electricity tariff<', ' data-i18n="whatif_tariff">Electricity tariff<'),
        ('>Green investment<', ' data-i18n="whatif_green_invest">Green investment<'),
        ('>Energy trade (TWh/yr)<', ' data-i18n="whatif_energy_trade">Energy trade (TWh/yr)<'),
        ('>⚡ Recalculate Now<', ' data-i18n="whatif_recalc">⚡ Recalculate Now<'),
        ('>CO₂ avoided by 2050<', ' data-i18n="whatif_co2_avoided">CO₂ avoided by 2050<'),
        ('>Total investment needed<', ' data-i18n="whatif_total_invest">Total investment needed<'),
        ('>RE share by 2050<', ' data-i18n="whatif_re_share">RE share by 2050<'),
        ('>NDC 2030 progress tracker<', ' data-i18n="whatif_ndc_tracker">NDC 2030 progress tracker<'),
        ('>CO₂ trajectory 2024–2060<', ' data-i18n="whatif_co2_traj">CO₂ trajectory 2024–2060<'),
        ('<div class="chart-sub">Your scenario vs BAU baseline</div>', '<div class="chart-sub" data-i18n="whatif_vs_bau">Your scenario vs BAU baseline</div>'),
        ('>Investment breakdown (Billion USD)<', ' data-i18n="whatif_invest_breakdown">Investment breakdown (Billion USD)<'),
    ],
    'scenario-ai.html': [
        ('<h2>Smart Scenario Analysis</h2>', '<h2 data-i18n="smart_title">Smart Scenario Analysis</h2>'),
        ('<p>Describe a policy goal', '<p data-i18n="smart_sub">Describe a policy goal'),
        ('>Policy goal<', ' data-i18n="goal_title">Policy goal<'),
        (">Ask any question about Kazakhstan", ' data-i18n="goal_sub">Ask any question about Kazakhstan'),
        ('>Run analysis<', ' data-i18n="btn_run_analysis">Run analysis<'),
        ('>LP optimization runs<', ' data-i18n="sai_lp_runs">LP optimization runs<'),
        ('>Analysis<', ' data-i18n="sai_analysis">Analysis<'),
        ('>Copy<', ' data-i18n="btn_copy">Copy<'),
        ('<span class="sai-example-label">Try:</span>', '<span class="sai-example-label" data-i18n="sai_try">Try:</span>'),
        ('>Cheapest path to 50% RE by 2035<', ' data-i18n="sai_example1">Cheapest path to 50% RE by 2035<'),
        ('>Cut CO2 by 40% by 2040 — what does it cost?<', ' data-i18n="sai_example2">Cut CO2 by 40% by 2040 — what does it cost?<'),
        ('>Is nuclear worth it by 2050?<', ' data-i18n="sai_example3">Is nuclear worth it by 2050?<'),
        ('>Compare all scenarios for 2060<', ' data-i18n="sai_example4">Compare all scenarios for 2060<'),
    ],
    'lp-optimizer.html': [
        ('<h2>Energy Mix Optimizer</h2>', '<h2 data-i18n="lp_title">Energy Mix Optimizer</h2>'),
        ('<p>Least-cost electricity mix</p>', '<p data-i18n="lp_sub">Least-cost electricity mix</p>'),
        ('>Optimization settings<', ' data-i18n="lp_settings_title">Optimization settings<'),
        ('<div class="card-sub">Configure scenario and target year', '<div class="card-sub" data-i18n="lp_settings_sub">Configure scenario and target year'),
        ('<label class="lp-label">Scenario</label>', '<label class="lp-label" data-i18n="lp_scenario_lbl">Scenario</label>'),
        ('<label class="lp-label">Target year</label>', '<label class="lp-label" data-i18n="lp_year_lbl">Target year</label>'),
        ('>Run LP<', ' data-i18n="btn_run_lp">Run LP<'),
        ('>Total generation<', ' data-i18n="lp_total_gen">Total generation<'),
        ('>System cost<', ' data-i18n="lp_system_cost">System cost<'),
        ('>CO2 from power (operational)<', ' data-i18n="lp_co2_ops">CO2 from power (operational)<'),
        ('>CO2 lifecycle (incl. RE/nuclear)<', ' data-i18n="lp_co2_lifecycle">CO2 lifecycle (incl. RE/nuclear)<'),
        ('>RE share<', ' data-i18n="lp_re_share">RE share<'),
        ('>Generation mix by technology<', ' data-i18n="lp_mix_title">Generation mix by technology<'),
        ('<div class="card-sub">Optimal allocation · TWh</div>', '<div class="card-sub" data-i18n="lp_mix_sub">Optimal allocation · TWh</div>'),
        ('<th>Technology</th>', '<th data-i18n="col_technology">Technology</th>'),
        ('<th>Generation (TWh)</th>', '<th data-i18n="col_generation">Generation (TWh)</th>'),
        ('<th>Share (%)</th>', '<th data-i18n="col_share">Share (%)</th>'),
        ('<th>New capacity (GW)</th>', '<th data-i18n="col_new_cap">New capacity (GW)</th>'),
        ('<th>CO2 operational (Mt)</th>', '<th data-i18n="col_co2_ops">CO2 operational (Mt)</th>'),
        ('<th>CO2 lifecycle (Mt)</th>', '<th data-i18n="col_co2_lc">CO2 lifecycle (Mt)</th>'),
        ('>Generation breakdown<', ' data-i18n="lp_chart_title">Generation breakdown<'),
        ('<div class="card-sub">TWh by source</div>', '<div class="card-sub" data-i18n="lp_chart_sub">TWh by source</div>'),
        ('>AI interpretation<', ' data-i18n="ai_interp_title">AI interpretation<'),
        ('>Explain results<', ' data-i18n="btn_explain">Explain results<'),
    ],
}

# JS files to patch for backend badge + user roles + placeholder
JS_PATCHES = {
    'scenario-ai.js': [
        ("el.textContent = r.ok ? '● Backend connected' : '● Offline mode';",
         "el.textContent = r.ok ? (typeof t==='function'?t('backend_connected'):'● Backend connected') : (typeof t==='function'?t('backend_offline'):'● Offline mode');"),
        ("el.textContent = '● Offline mode';",
         "el.textContent = typeof t==='function'?t('backend_offline'):'● Offline mode';"),
        ("{ bg: '#e1f5ee', color: '#085041', text: 'Energy Analyst' }",
         "{ bg: '#e1f5ee', color: '#085041', get text(){ return typeof t==='function'?t('role_analyst'):'Energy Analyst'; } }"),
        ("{ bg: '#eeedfe', color: '#3C3489', text: 'Researcher' }",
         "{ bg: '#eeedfe', color: '#3C3489', get text(){ return typeof t==='function'?t('role_researcher'):'Researcher'; } }"),
        ("{ bg: '#faece7', color: '#712B13', text: 'Policymaker' }",
         "{ bg: '#faece7', color: '#712B13', get text(){ return typeof t==='function'?t('role_policymaker'):'Policymaker'; } }"),
    ],
}
# Apply same badge/role patches to all JS files
for jsfile in ['results.js','sensitivity.js','lp-optimizer.js','carbon-budget.js','reports.js','whatif.js','upload.js','scenario.js']:
    JS_PATCHES[jsfile] = [
        ("el.textContent = r.ok ? '● Backend connected' : '● Offline mode';",
         "el.textContent = r.ok ? (typeof t==='function'?t('backend_connected'):'● Backend connected') : (typeof t==='function'?t('backend_offline'):'● Offline mode');"),
        ("el.textContent = connected ? '● Backend connected' : '● Offline mode';",
         "el.textContent = connected ? (typeof t==='function'?t('backend_connected'):'● Backend connected') : (typeof t==='function'?t('backend_offline'):'● Offline mode');"),
        ("el.textContent = '● Offline mode';",
         "el.textContent = typeof t==='function'?t('backend_offline'):'● Offline mode';"),
        ("{ bg: '#e1f5ee', color: '#085041', text: 'Energy Analyst' }",
         "{ bg: '#e1f5ee', color: '#085041', get text(){ return typeof t==='function'?t('role_analyst'):'Energy Analyst'; } }"),
        ("{ bg: '#eeedfe', color: '#3C3489', text: 'Researcher' }",
         "{ bg: '#eeedfe', color: '#3C3489', get text(){ return typeof t==='function'?t('role_researcher'):'Researcher'; } }"),
        ("{ bg: '#faece7', color: '#712B13', text: 'Policymaker' }",
         "{ bg: '#faece7', color: '#712B13', get text(){ return typeof t==='function'?t('role_policymaker'):'Policymaker'; } }"),
    ]

def patch_html(html, filename):
    if 'lang-switcher' not in html and '</head>' in html:
        html = html.replace('</head>', LANG_CSS + '\n</head>', 1)
    if 'lang-btn' not in html and '<div class="topbar-right">' in html:
        html = html.replace('<div class="topbar-right">', '<div class="topbar-right">\n' + LANG_BTNS, 1)
    if 'translations.js' not in html:
        html = html.replace('</body>', TRANSLATIONS_SCRIPT + '\n</body>', 1)
    for old, new in COMMON:
        html = html.replace(old, new)
    for old, new in PAGE_SPECIFIC.get(filename, []):
        html = html.replace(old, new)
    return html

def main():
    frontend_dir = os.path.dirname(os.path.abspath(__file__))

    # Patch HTML
    for filename in PAGES:
        path = os.path.join(frontend_dir, filename)
        if not os.path.exists(path):
            print(f'  SKIP {filename}')
            continue
        html = open(path, encoding='utf-8').read()
        new_html = patch_html(html, filename)
        open(path, 'w', encoding='utf-8').write(new_html)
        print(f'  HTML {filename}: {new_html.count("data-i18n")} attrs')

    # Patch JS
    for filename, patches in JS_PATCHES.items():
        path = os.path.join(frontend_dir, filename)
        if not os.path.exists(path):
            continue
        js = open(path, encoding='utf-8').read()
        for old, new in patches:
            js = js.replace(old, new)
        open(path, 'w', encoding='utf-8').write(js)
        print(f'  JS   {filename}: patched')

    print('\nDone! Remember to copy translations.js if not already there.')

if __name__ == '__main__':
    main()