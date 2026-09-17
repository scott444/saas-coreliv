-- Reference data: the category taxonomy and the billing plans.
--
-- Categories are global, so they live in a migration rather than the seed: an
-- empty production database still needs them, and `spec_schema` is what drives
-- the per-category spec form in the UI. Each entry is
--   {key, label, type: string|number|boolean|select, unit?, options?}
-- and re-running is safe (ON CONFLICT DO NOTHING on the slug).

-- ---------------------------------------------------------------------------
-- Top-level groups
-- ---------------------------------------------------------------------------
INSERT INTO categories (parent_id, name, slug, sort_order) VALUES
    (NULL, 'HVAC',          'hvac',          10),
    (NULL, 'Water',         'water',         20),
    (NULL, 'Appliances',    'appliances',    30),
    (NULL, 'Electrical',    'electrical',    40),
    (NULL, 'Exterior',      'exterior',      50),
    (NULL, 'Irrigation',    'irrigation',    60),
    (NULL, 'Safety',        'safety',        70),
    (NULL, 'Interior',      'interior',      80),
    (NULL, 'Outdoor',       'outdoor',       90)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Leaf categories
-- ---------------------------------------------------------------------------
INSERT INTO categories (parent_id, name, slug, sort_order, spec_schema)
SELECT parent.id, v.name, v.slug, v.sort_order, v.spec_schema::jsonb
FROM (VALUES
    -- HVAC ------------------------------------------------------------------
    ('hvac', 'Furnace', 'furnace', 10, $$[
        {"key":"fuel","label":"Fuel","type":"select","options":["natural_gas","propane","oil","electric"]},
        {"key":"afue","label":"AFUE","type":"number","unit":"%"},
        {"key":"btu_input","label":"Input","type":"number","unit":"BTU/h"},
        {"key":"stages","label":"Stages","type":"select","options":["single","two","modulating"]},
        {"key":"blower","label":"Blower","type":"select","options":["psc","ecm","variable_speed"]}
    ]$$),
    ('hvac', 'Air conditioner', 'air-conditioner', 20, $$[
        {"key":"tons","label":"Capacity","type":"number","unit":"tons"},
        {"key":"seer2","label":"SEER2","type":"number"},
        {"key":"refrigerant","label":"Refrigerant","type":"select","options":["R-410A","R-454B","R-32","R-22"]},
        {"key":"stages","label":"Stages","type":"select","options":["single","two","variable"]}
    ]$$),
    ('hvac', 'Heat pump', 'heat-pump', 30, $$[
        {"key":"tons","label":"Capacity","type":"number","unit":"tons"},
        {"key":"seer2","label":"SEER2","type":"number"},
        {"key":"hspf2","label":"HSPF2","type":"number"},
        {"key":"refrigerant","label":"Refrigerant","type":"select","options":["R-410A","R-454B","R-32"]},
        {"key":"backup_heat","label":"Backup heat","type":"select","options":["none","electric_strip","gas_furnace"]}
    ]$$),
    ('hvac', 'Mini split', 'mini-split', 40, $$[
        {"key":"heads","label":"Indoor heads","type":"number"},
        {"key":"tons","label":"Capacity","type":"number","unit":"tons"},
        {"key":"seer2","label":"SEER2","type":"number"},
        {"key":"refrigerant","label":"Refrigerant","type":"select","options":["R-410A","R-454B","R-32"]}
    ]$$),
    ('hvac', 'Thermostat', 'thermostat', 50, $$[
        {"key":"smart","label":"Smart","type":"boolean"},
        {"key":"stages_supported","label":"Stages supported","type":"number"},
        {"key":"c_wire","label":"C-wire present","type":"boolean"}
    ]$$),
    ('hvac', 'Ventilation', 'ventilation', 60, $$[
        {"key":"type","label":"Type","type":"select","options":["erv","hrv","exhaust_fan","whole_house_fan"]},
        {"key":"cfm","label":"Airflow","type":"number","unit":"CFM"}
    ]$$),

    -- Water -----------------------------------------------------------------
    ('water', 'Water heater', 'water-heater', 10, $$[
        {"key":"type","label":"Type","type":"select","options":["tank","tankless","heat_pump","indirect"]},
        {"key":"capacity_gal","label":"Capacity","type":"number","unit":"gal"},
        {"key":"fuel","label":"Fuel","type":"select","options":["natural_gas","propane","electric","oil"]},
        {"key":"first_hour_rating","label":"First hour rating","type":"number","unit":"gal"},
        {"key":"anode_type","label":"Anode","type":"select","options":["magnesium","aluminum","powered"]}
    ]$$),
    ('water', 'Water softener', 'water-softener', 20, $$[
        {"key":"grain_capacity","label":"Grain capacity","type":"number"},
        {"key":"salt_type","label":"Salt","type":"select","options":["pellet","crystal","block","potassium"]},
        {"key":"regeneration","label":"Regeneration","type":"select","options":["metered","timed"]}
    ]$$),
    ('water', 'Sump pump', 'sump-pump', 30, $$[
        {"key":"hp","label":"Motor","type":"number","unit":"hp"},
        {"key":"type","label":"Type","type":"select","options":["submersible","pedestal"]},
        {"key":"battery_backup","label":"Battery backup","type":"boolean"}
    ]$$),
    ('water', 'Well pump', 'well-pump', 40, $$[
        {"key":"hp","label":"Motor","type":"number","unit":"hp"},
        {"key":"depth_ft","label":"Well depth","type":"number","unit":"ft"},
        {"key":"tank_gal","label":"Pressure tank","type":"number","unit":"gal"}
    ]$$),
    ('water', 'Water filter', 'water-filter', 50, $$[
        {"key":"stage_count","label":"Stages","type":"number"},
        {"key":"micron","label":"Rating","type":"number","unit":"micron"}
    ]$$),

    -- Appliances ------------------------------------------------------------
    ('appliances', 'Refrigerator', 'refrigerator', 10, $$[
        {"key":"style","label":"Style","type":"select","options":["french_door","side_by_side","top_freezer","bottom_freezer","column"]},
        {"key":"capacity_cuft","label":"Capacity","type":"number","unit":"cu ft"},
        {"key":"ice_maker","label":"Ice maker","type":"boolean"},
        {"key":"counter_depth","label":"Counter depth","type":"boolean"}
    ]$$),
    ('appliances', 'Dishwasher', 'dishwasher', 20, $$[
        {"key":"db_rating","label":"Noise","type":"number","unit":"dB"},
        {"key":"third_rack","label":"Third rack","type":"boolean"}
    ]$$),
    ('appliances', 'Range', 'range', 30, $$[
        {"key":"fuel","label":"Fuel","type":"select","options":["natural_gas","propane","electric","induction","dual_fuel"]},
        {"key":"width_in","label":"Width","type":"number","unit":"in"},
        {"key":"burners","label":"Burners","type":"number"},
        {"key":"convection","label":"Convection","type":"boolean"}
    ]$$),
    ('appliances', 'Microwave', 'microwave', 40, $$[
        {"key":"watts","label":"Power","type":"number","unit":"W"},
        {"key":"mount","label":"Mount","type":"select","options":["over_range","countertop","built_in","drawer"]}
    ]$$),
    ('appliances', 'Washer', 'washer', 50, $$[
        {"key":"type","label":"Type","type":"select","options":["front_load","top_load","combo"]},
        {"key":"capacity_cuft","label":"Capacity","type":"number","unit":"cu ft"}
    ]$$),
    ('appliances', 'Dryer', 'dryer', 60, $$[
        {"key":"fuel","label":"Fuel","type":"select","options":["electric","natural_gas","propane","heat_pump"]},
        {"key":"capacity_cuft","label":"Capacity","type":"number","unit":"cu ft"},
        {"key":"vented","label":"Vented","type":"boolean"}
    ]$$),
    ('appliances', 'Garbage disposal', 'garbage-disposal', 70, $$[
        {"key":"hp","label":"Motor","type":"number","unit":"hp"},
        {"key":"feed","label":"Feed","type":"select","options":["continuous","batch"]}
    ]$$),
    ('appliances', 'Range hood', 'range-hood', 80, $$[
        {"key":"cfm","label":"Airflow","type":"number","unit":"CFM"},
        {"key":"ducted","label":"Ducted","type":"boolean"}
    ]$$),

    -- Electrical ------------------------------------------------------------
    ('electrical', 'Electrical panel', 'electrical-panel', 10, $$[
        {"key":"amperage","label":"Service","type":"number","unit":"A"},
        {"key":"spaces","label":"Spaces","type":"number"},
        {"key":"breaker_type","label":"Breaker type","type":"string"},
        {"key":"afci","label":"AFCI protected","type":"boolean"}
    ]$$),
    ('electrical', 'Generator', 'generator', 20, $$[
        {"key":"fuel","label":"Fuel","type":"select","options":["natural_gas","propane","diesel","gasoline"]},
        {"key":"watts","label":"Output","type":"number","unit":"W"},
        {"key":"transfer_switch","label":"Transfer switch","type":"select","options":["automatic","manual","none"]}
    ]$$),
    ('electrical', 'EV charger', 'ev-charger', 30, $$[
        {"key":"level","label":"Level","type":"select","options":["1","2","3"]},
        {"key":"amps","label":"Current","type":"number","unit":"A"},
        {"key":"connector","label":"Connector","type":"select","options":["j1772","nacs","ccs"]},
        {"key":"hardwired","label":"Hardwired","type":"boolean"}
    ]$$),
    ('electrical', 'Solar array', 'solar-array', 40, $$[
        {"key":"dc_kw","label":"Array size","type":"number","unit":"kW DC"},
        {"key":"panel_count","label":"Panels","type":"number"},
        {"key":"inverter_type","label":"Inverter","type":"select","options":["string","micro","hybrid"]},
        {"key":"battery_kwh","label":"Battery","type":"number","unit":"kWh"}
    ]$$),

    -- Exterior --------------------------------------------------------------
    ('exterior', 'Roof', 'roof', 10, $$[
        {"key":"material","label":"Material","type":"select","options":["asphalt_shingle","metal","tile","slate","flat_membrane","wood_shake"]},
        {"key":"layers","label":"Layers","type":"number"},
        {"key":"area_sqft","label":"Area","type":"number","unit":"sq ft"},
        {"key":"pitch","label":"Pitch","type":"string"}
    ]$$),
    ('exterior', 'Siding', 'siding', 20, $$[
        {"key":"material","label":"Material","type":"select","options":["vinyl","fiber_cement","wood","brick","stucco","engineered_wood"]},
        {"key":"color","label":"Color","type":"string"}
    ]$$),
    ('exterior', 'Gutters', 'gutters', 30, $$[
        {"key":"material","label":"Material","type":"select","options":["aluminum","copper","steel","vinyl"]},
        {"key":"guards","label":"Guards fitted","type":"boolean"},
        {"key":"linear_ft","label":"Length","type":"number","unit":"ft"}
    ]$$),
    ('exterior', 'Deck', 'deck', 40, $$[
        {"key":"material","label":"Material","type":"select","options":["pressure_treated","cedar","composite","pvc","hardwood"]},
        {"key":"area_sqft","label":"Area","type":"number","unit":"sq ft"}
    ]$$),
    ('exterior', 'Driveway', 'driveway', 50, $$[
        {"key":"material","label":"Material","type":"select","options":["asphalt","concrete","paver","gravel"]},
        {"key":"area_sqft","label":"Area","type":"number","unit":"sq ft"}
    ]$$),
    ('exterior', 'Fence', 'fence', 60, $$[
        {"key":"material","label":"Material","type":"select","options":["wood","vinyl","aluminum","chain_link","composite"]},
        {"key":"linear_ft","label":"Length","type":"number","unit":"ft"},
        {"key":"height_ft","label":"Height","type":"number","unit":"ft"}
    ]$$),
    ('exterior', 'Windows', 'windows', 70, $$[
        {"key":"frame","label":"Frame","type":"select","options":["vinyl","wood","aluminum","fiberglass","clad"]},
        {"key":"glazing","label":"Glazing","type":"select","options":["single","double","triple"]},
        {"key":"count","label":"Count","type":"number"},
        {"key":"u_factor","label":"U-factor","type":"number"}
    ]$$),

    -- Irrigation ------------------------------------------------------------
    ('irrigation', 'Irrigation controller', 'irrigation-controller', 10, $$[
        {"key":"zone_count","label":"Zones","type":"number"},
        {"key":"smart","label":"Weather aware","type":"boolean"},
        {"key":"flow_sensor","label":"Flow sensor","type":"boolean"},
        {"key":"backflow_type","label":"Backflow device","type":"select","options":["pvb","rpz","dcva","none"]}
    ]$$),

    -- Safety ----------------------------------------------------------------
    ('safety', 'Smoke alarm', 'smoke-alarm', 10, $$[
        {"key":"power","label":"Power","type":"select","options":["hardwired","battery","hardwired_with_battery"]},
        {"key":"sensor","label":"Sensor","type":"select","options":["ionization","photoelectric","dual"]},
        {"key":"interconnected","label":"Interconnected","type":"boolean"},
        {"key":"replace_by","label":"Replace by","type":"string"}
    ]$$),
    ('safety', 'CO detector', 'co-detector', 20, $$[
        {"key":"power","label":"Power","type":"select","options":["hardwired","battery","plug_in"]},
        {"key":"replace_by","label":"Replace by","type":"string"}
    ]$$),
    ('safety', 'Fire extinguisher', 'fire-extinguisher', 30, $$[
        {"key":"class","label":"Class","type":"select","options":["A","BC","ABC","K"]},
        {"key":"weight_lb","label":"Weight","type":"number","unit":"lb"}
    ]$$),
    ('safety', 'Security system', 'security-system', 40, $$[
        {"key":"monitored","label":"Monitored","type":"boolean"},
        {"key":"sensor_count","label":"Sensors","type":"number"},
        {"key":"cameras","label":"Cameras","type":"number"}
    ]$$),

    -- Interior --------------------------------------------------------------
    ('interior', 'Paint', 'paint', 10, $$[
        {"key":"color","label":"Color","type":"string"},
        {"key":"finish","label":"Finish","type":"select","options":["flat","matte","eggshell","satin","semi_gloss","gloss"]},
        {"key":"brand_line","label":"Product line","type":"string"},
        {"key":"rooms","label":"Rooms","type":"string"}
    ]$$),
    ('interior', 'Flooring', 'flooring', 20, $$[
        {"key":"material","label":"Material","type":"select","options":["hardwood","engineered_wood","lvp","tile","carpet","laminate"]},
        {"key":"area_sqft","label":"Area","type":"number","unit":"sq ft"},
        {"key":"color","label":"Color","type":"string"}
    ]$$),
    ('interior', 'Insulation', 'insulation', 30, $$[
        {"key":"type","label":"Type","type":"select","options":["fiberglass_batt","blown_cellulose","spray_foam","rigid_board","mineral_wool"]},
        {"key":"r_value","label":"R-value","type":"number"},
        {"key":"area_sqft","label":"Area","type":"number","unit":"sq ft"}
    ]$$),
    ('interior', 'Countertops', 'countertops', 40, $$[
        {"key":"material","label":"Material","type":"select","options":["quartz","granite","marble","laminate","butcher_block","solid_surface"]},
        {"key":"color","label":"Color","type":"string"}
    ]$$),

    -- Outdoor ---------------------------------------------------------------
    ('outdoor', 'Garage door opener', 'garage-door-opener', 10, $$[
        {"key":"drive","label":"Drive","type":"select","options":["chain","belt","screw","direct","jackshaft"]},
        {"key":"hp","label":"Motor","type":"number","unit":"hp"},
        {"key":"battery_backup","label":"Battery backup","type":"boolean"}
    ]$$),
    ('outdoor', 'Pool equipment', 'pool-equipment', 20, $$[
        {"key":"type","label":"Type","type":"select","options":["pump","filter","heater","salt_cell","cleaner"]},
        {"key":"variable_speed","label":"Variable speed","type":"boolean"}
    ]$$),
    ('outdoor', 'Lawn equipment', 'lawn-equipment', 30, $$[
        {"key":"type","label":"Type","type":"select","options":["mower","trimmer","blower","snow_blower","tractor"]},
        {"key":"power","label":"Power","type":"select","options":["gas","battery","corded","robotic"]}
    ]$$),
    ('outdoor', 'Septic system', 'septic-system', 40, $$[
        {"key":"tank_gal","label":"Tank","type":"number","unit":"gal"},
        {"key":"field_type","label":"Drain field","type":"select","options":["conventional","chamber","mound","aerobic"]}
    ]$$)
) AS v(parent_slug, name, slug, sort_order, spec_schema)
JOIN categories parent ON parent.slug = v.parent_slug
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Billing plans
-- ---------------------------------------------------------------------------
INSERT INTO plans (id, name, price_monthly, features, asset_limit, property_limit, member_limit, sort_order) VALUES
    ('starter', 'Starter', 0,  ARRAY[
        'One property',
        'Up to 25 assets',
        'Warranty and service history',
        'Maintenance reminders'
    ], 25, 1, 1, 10),
    ('home',    'Home',    12, ARRAY[
        'Up to 3 properties',
        'Unlimited assets',
        'Document storage',
        'Vendor directory',
        'Shared access for 5 people'
    ], NULL, 3, 5, 20),
    ('estate',  'Estate',  39, ARRAY[
        'Unlimited properties',
        'Unlimited assets',
        'Document storage',
        'Vendor directory',
        'Unlimited shared access',
        'Replacement planning and spend reporting'
    ], NULL, NULL, NULL, 30)
ON CONFLICT (id) DO NOTHING;
