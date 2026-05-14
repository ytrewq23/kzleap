import numpy as np 
from dataclasses import dataclass 
from typing import Dict ,List 






HISTORICAL_TPES ={
1990 :105.0 ,1995 :75.0 ,2000 :57.0 ,2005 :68.0 ,
2010 :74.0 ,2015 :77.0 ,2018 :76.0 ,2020 :78.0 ,
2021 :81.0 ,2022 :83.0 ,2023 :85.0 ,
}

HISTORICAL_ELEC ={
1990 :87.4 ,1995 :67.0 ,2000 :51.6 ,2005 :67.9 ,
2010 :82.6 ,2015 :90.8 ,2020 :107.0 ,2021 :109.0 ,
2022 :112.0 ,2023 :115.0 ,
}

HISTORICAL_CO2 ={
1990 :290.0 ,1995 :200.0 ,1999 :130.0 ,2000 :140.0 ,
2005 :200.0 ,2010 :230.0 ,2013 :270.0 ,2015 :250.0 ,
2018 :260.0 ,2020 :235.0 ,2021 :245.0 ,2022 :240.0 ,
2023 :242.0 ,
}

HISTORICAL_GDP ={
1990 :26.0 ,2000 :18.3 ,2005 :57.1 ,2010 :148.1 ,
2015 :184.4 ,2020 :171.1 ,2022 :220.6 ,2023 :261.4 ,2024 :288.4 ,
}

HISTORICAL_POP ={
1990 :16.5 ,1995 :15.7 ,2000 :14.9 ,2005 :15.2 ,
2010 :16.2 ,2015 :17.7 ,2020 :19.0 ,2023 :20.1 ,2024 :20.3 ,
}


ELEC_MIX_2023 ={
"coal":61.0 ,
"gas":24.0 ,
"hydro":10.0 ,
"wind":3.5 ,
"solar":1.5 ,
"nuclear":0.0 ,
}


NDC_TARGET_2030_PCT =-15 
NDC_CONDITIONAL_2030_PCT =-25 
CARBON_NEUTRALITY_YEAR =2060 
BASE_YEAR_1990_CO2 =290.0 





SCENARIOS ={
"BAU":{
"name":"Business as Usual",
"description":"Current policy settings, no new climate measures. Coal dominance persists.",
"gdp_growth":0.040 ,
"energy_intensity_change":-0.010 ,
"coal_share_2050":0.45 ,
"renewables_2030":0.08 ,
"renewables_2050":0.15 ,
"nuclear_gw_2035":0.0 ,
"co2_price_2030":5 ,
"co2_price_2050":10 ,
"ev_share_2050":0.10 ,
},
"MT":{
"name":"Moderate Transition",
"description":"NDC targets implemented. Gradual coal phase-down. Nuclear by 2035.",
"gdp_growth":0.042 ,
"energy_intensity_change":-0.020 ,
"coal_share_2050":0.25 ,
"renewables_2030":0.15 ,
"renewables_2050":0.40 ,
"nuclear_gw_2035":1.2 ,
"co2_price_2030":20 ,
"co2_price_2050":50 ,
"ev_share_2050":0.30 ,
},
"DD":{
"name":"Deep Decarbonization",
"description":"Carbon neutrality by 2060. Accelerated renewables, coal phase-out by 2045.",
"gdp_growth":0.043 ,
"energy_intensity_change":-0.030 ,
"coal_share_2050":0.05 ,
"renewables_2030":0.22 ,
"renewables_2050":0.70 ,
"nuclear_gw_2035":2.4 ,
"co2_price_2030":50 ,
"co2_price_2050":150 ,
"ev_share_2050":0.80 ,
},
}





def run_scenario (scenario_key :str ,start_year :int =2024 ,end_year :int =2060 )->Dict :
    """
    Run LEAP-style energy accounting for given scenario.
    Returns annual projections for all key metrics.
    """
    params =SCENARIOS [scenario_key ]
    years =list (range (start_year ,end_year +1 ))


    base_tpes =85.0 
    base_elec =115.0 
    base_co2 =242.0 
    base_demand =82.0 

    results ={
    "scenario":scenario_key ,
    "name":params ["name"],
    "description":params ["description"],
    "years":years ,
    "tpes":[],
    "electricity":[],
    "co2":[],
    "renewables_share":[],
    "coal_share":[],
    "gas_share":[],
    "hydro_share":[],
    "wind_solar_share":[],
    "nuclear_share":[],
    "energy_demand":[],
    "ndc_gap":[],
    "installed_capacity":[],
    "coal_gw":[],
    "gas_gw":[],
    "renewables_gw":[],
    "nuclear_gw":[],
    }


    ndc_2030 =BASE_YEAR_1990_CO2 *(1 +NDC_TARGET_2030_PCT /100 )

    for i ,year in enumerate (years ):
        t =year -2023 


        gdp_factor =(1 +params ["gdp_growth"])**t 
        eff_factor =(1 +params ["energy_intensity_change"])**t 
        tpes =base_tpes *gdp_factor *eff_factor 
        results ["tpes"].append (round (tpes ,1 ))


        elec_demand =base_elec *(gdp_factor **0.75 )*eff_factor 
        results ["electricity"].append (round (elec_demand ,1 ))


        transition =min (t /(2060 -2023 ),1.0 )

        re_target_2030 =params ["renewables_2030"]
        re_target_2050 =params ["renewables_2050"]

        if year <=2030 :
            re_share =ELEC_MIX_2023 ["wind"]/100 +ELEC_MIX_2023 ["solar"]/100 
            re_share +=(re_target_2030 -re_share )*((year -2023 )/7 )
        elif year <=2050 :
            re_share =re_target_2030 +(re_target_2050 -re_target_2030 )*((year -2030 )/20 )
        else :

            re_share =re_target_2050 +(re_target_2050 *0.1 )*((year -2050 )/10 )

        re_share =min (re_share ,0.85 )


        if year >=2035 and params ["nuclear_gw_2035"]>0 :
            nuc_ramp =min ((year -2035 )/10 ,1.0 )
            nuc_share =(params ["nuclear_gw_2035"]*1.1 *nuc_ramp )/max (elec_demand ,1 )*8760 /1000 
            nuc_share =min (nuc_share ,0.15 )
        else :
            nuc_share =0.0 


        hydro_share =0.10 


        fossil_share =max (1.0 -re_share -nuc_share -hydro_share ,0.05 )
        coal_target =params ["coal_share_2050"]
        if year <=2050 :
            coal_fraction =(ELEC_MIX_2023 ["coal"]/100 )+(coal_target -ELEC_MIX_2023 ["coal"]/100 )*((year -2023 )/27 )
        else :
            coal_fraction =coal_target +(0.0 -coal_target )*((year -2050 )/10 )

        coal_share =max (min (coal_fraction ,fossil_share ),0.0 )
        gas_share =max (fossil_share -coal_share ,0.0 )
        wind_solar_share =re_share 

        results ["renewables_share"].append (round (re_share *100 ,1 ))
        results ["coal_share"].append (round (coal_share *100 ,1 ))
        results ["gas_share"].append (round (gas_share *100 ,1 ))
        results ["hydro_share"].append (round (hydro_share *100 ,1 ))
        results ["wind_solar_share"].append (round (wind_solar_share *100 ,1 ))
        results ["nuclear_share"].append (round (nuc_share *100 ,1 ))



        coal_co2 =elec_demand *coal_share *0.82 
        gas_co2 =elec_demand *gas_share *0.49 

        non_power_co2 =base_co2 *0.40 *gdp_factor *eff_factor 
        co2 =coal_co2 +gas_co2 +non_power_co2 


        cp =params ["co2_price_2030"]if year <=2030 else params ["co2_price_2050"]
        cp_reduction =1.0 -(cp /1000 )*0.5 
        co2 *=max (cp_reduction ,0.5 )

        results ["co2"].append (round (co2 ,1 ))


        ndc_gap =co2 -ndc_2030 if year ==2030 else None 
        results ["ndc_gap"].append (round (ndc_gap ,1 )if ndc_gap else None )


        capacity_factor_avg =0.45 
        total_gw =elec_demand /(capacity_factor_avg *8.760 )
        coal_gw =total_gw *coal_share /0.65 
        gas_gw =total_gw *gas_share /0.55 
        re_gw =total_gw *wind_solar_share /0.25 
        nuc_gw =params ["nuclear_gw_2035"]if year >=2035 else 0.0 

        results ["installed_capacity"].append (round (total_gw ,1 ))
        results ["coal_gw"].append (round (coal_gw ,1 ))
        results ["gas_gw"].append (round (gas_gw ,1 ))
        results ["renewables_gw"].append (round (re_gw ,1 ))
        results ["nuclear_gw"].append (round (nuc_gw ,1 ))


        results ["energy_demand"].append (round (base_demand *gdp_factor *eff_factor ,1 ))

    return results 


def get_historical_data ()->Dict :
    """Return historical Kazakhstan energy data (1990-2023)."""
    years =sorted (HISTORICAL_CO2 .keys ())
    return {
    "years":years ,
    "co2":[HISTORICAL_CO2 .get (y ,None )for y in years ],
    "tpes":[HISTORICAL_TPES .get (y ,None )for y in years ],
    "electricity":[HISTORICAL_ELEC .get (y ,None )for y in years ],
    "gdp":[HISTORICAL_GDP .get (y ,None )for y in years ],
    "population":[HISTORICAL_POP .get (y ,None )for y in years ],
    "elec_mix_2023":ELEC_MIX_2023 ,
    "ndc_targets":{
    "base_year":1990 ,
    "base_co2":BASE_YEAR_1990_CO2 ,
    "unconditional_2030":round (BASE_YEAR_1990_CO2 *(1 +NDC_TARGET_2030_PCT /100 ),1 ),
    "conditional_2030":round (BASE_YEAR_1990_CO2 *(1 +NDC_CONDITIONAL_2030_PCT /100 ),1 ),
    "neutrality_year":CARBON_NEUTRALITY_YEAR ,
    }
    }


def compare_scenarios ()->Dict :
    """Run all 3 scenarios and return combined comparison data."""
    results ={}
    for key in SCENARIOS :
        results [key ]=run_scenario (key )


    hist_years =[2021 ,2022 ,2023 ]
    hist_co2 =[245.0 ,240.0 ,242.0 ]

    for key in results :
        results [key ]["hist_years"]=hist_years 
        results [key ]["hist_co2"]=hist_co2 


    results ["_targets"]={
    "ndc_unconditional_2030":round (BASE_YEAR_1990_CO2 *0.85 ,1 ),
    "ndc_conditional_2030":round (BASE_YEAR_1990_CO2 *0.75 ,1 ),
    "neutrality_2060":0.0 ,
    }

    return results 







DEMOGRAPHIC_DATA ={

"population":{
1990 :16.5 ,1995 :15.7 ,2000 :14.9 ,2005 :15.2 ,
2010 :16.2 ,2015 :17.7 ,2020 :19.0 ,2023 :20.1 ,2024 :20.3 ,
},

"working_age_pct":{
1990 :61.0 ,1995 :62.0 ,2000 :63.5 ,2005 :65.0 ,
2010 :67.0 ,2015 :68.5 ,2020 :67.0 ,2023 :66.5 ,
},

"urban_pct":{
1990 :57.0 ,1995 :55.5 ,2000 :55.0 ,2005 :53.5 ,
2010 :53.5 ,2015 :53.5 ,2020 :57.5 ,2023 :58.0 ,
},

"gdp_per_capita":{
1990 :1.6 ,2000 :1.2 ,2005 :3.7 ,2010 :9.1 ,
2015 :10.5 ,2020 :9.0 ,2023 :13.0 ,2024 :14.2 ,
},
}


DEMO_PROJECTIONS ={
"BAU":{
"pop_growth":0.012 ,
"urbanization_rate":0.003 ,
"working_age_2050":64.0 ,
},
"MT":{
"pop_growth":0.011 ,
"urbanization_rate":0.004 ,
"working_age_2050":63.5 ,
},
"DD":{
"pop_growth":0.010 ,
"urbanization_rate":0.005 ,
"working_age_2050":63.0 ,
},
}


def run_scenario_with_demographics (scenario_key :str ,start_year :int =2024 ,end_year :int =2060 )->dict :
    """
    Extended LEAP scenario with demographic drivers.
    Energy demand = f(population, working age share, urbanization, GDP per capita)
    """
    params =SCENARIOS [scenario_key ]
    demo =DEMO_PROJECTIONS [scenario_key ]
    years =list (range (start_year ,end_year +1 ))


    base_pop =20.1 
    base_urban =58.0 
    base_working =66.5 
    base_gdp_pc =13.0 
    base_elec_pc =115_000 /20.1 
    base_co2 =242.0 

    result =run_scenario (scenario_key ,start_year ,end_year )
    result ["population"]=[]
    result ["urban_pct"]=[]
    result ["working_age_pct"]=[]
    result ["gdp_per_capita"]=[]
    result ["elec_per_capita"]=[]
    result ["co2_per_capita"]=[]
    result ["residential_demand"]=[]
    result ["industry_demand"]=[]
    result ["transport_demand"]=[]

    for i ,year in enumerate (years ):
        t =year -2023 
        pop =base_pop *(1 +demo ["pop_growth"])**t 
        urban =min (base_urban +demo ["urbanization_rate"]*t *100 ,80.0 )
        working =base_working +(demo ["working_age_2050"]-base_working )*(t /27 )
        gdp_growth =params ["gdp_growth"]
        eff =params ["energy_intensity_change"]
        gdp_pc =base_gdp_pc *(1 +gdp_growth )**t 
        urban_factor =1 +(urban -base_urban )/100 *0.5 
        income_factor =(gdp_pc /base_gdp_pc )**0.6 
        eff_factor =(1 +eff )**t 
        elec_pc =base_elec_pc *urban_factor *income_factor *eff_factor 
        residential =pop *elec_pc *0.25 /1000 
        industry_factor =(working /base_working )*((gdp_pc /base_gdp_pc )**0.7 )*eff_factor 
        industry =(result ["electricity"][i ]*0.45 )*industry_factor 
        ev_share =params ["ev_share_2050"]*min (t /26 ,1.0 )
        transport_base =pop *0.8 *(gdp_pc /base_gdp_pc )**0.4 
        transport =transport_base *(1 -ev_share *0.3 )*eff_factor 
        co2_pc =result ["co2"][i ]/pop 

        result ["population"].append (round (pop ,2 ))
        result ["urban_pct"].append (round (urban ,1 ))
        result ["working_age_pct"].append (round (working ,1 ))
        result ["gdp_per_capita"].append (round (gdp_pc ,1 ))
        result ["elec_per_capita"].append (round (elec_pc ,0 ))
        result ["co2_per_capita"].append (round (co2_pc ,2 ))
        result ["residential_demand"].append (round (residential ,1 ))
        result ["industry_demand"].append (round (industry ,1 ))
        result ["transport_demand"].append (round (transport ,1 ))

    return result 
