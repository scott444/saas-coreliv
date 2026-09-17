/**
 * Demo data.
 *
 * Every date is computed relative to today rather than hard-coded, so the
 * seeded house always has the same *shape* - one warranty inside its last
 * two months, one lapsed, one filter overdue, one task never done - however
 * long after it was written the database is created.
 *
 *   npm run db:reset   drop, migrate, seed
 *   npm run db:seed    seed into whatever is already there
 */
import type { PoolClient } from 'pg'
import { pool, queryOne, transaction } from './pool.js'
import { hashPassword } from '../lib/password.js'
import { addInterval, todayDateOnly, type DateOnly } from '../../../src/domain/dates.js'

const today = todayDateOnly()

/** `days(-45)` is 45 days ago. */
function days(offset: number): DateOnly {
  return addInterval(today, offset, 'day') ?? today
}
function months(offset: number): DateOnly {
  return addInterval(today, offset, 'month') ?? today
}
function years(offset: number): DateOnly {
  return addInterval(today, offset, 'year') ?? today
}

const DEMO_PASSWORD = 'coreliv-demo'

async function one<T extends Record<string, unknown>>(
  client: PoolClient,
  sql: string,
  params: unknown[],
): Promise<T> {
  const row = await queryOne<T>(sql, params, client)
  if (!row) throw new Error('Expected a row from: ' + sql.slice(0, 80))
  return row
}

async function categoryId(client: PoolClient, slug: string): Promise<string> {
  const row = await one<{ id: string }>(client, 'SELECT id FROM categories WHERE slug = $1', [slug])
  return row.id
}

export async function seed(): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD)

  await transaction(async (client) => {
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE lower(email) = 'dana@coreliv.app'",
      [],
      client,
    )
    if (existing) {
      console.log('Demo data already present; nothing to do.')
      return
    }

    // -----------------------------------------------------------------------
    // People and organization
    // -----------------------------------------------------------------------
    const dana = await one<{ id: string }>(
      client,
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['Dana Reyes', 'dana@coreliv.app', passwordHash],
    )
    const sam = await one<{ id: string }>(
      client,
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['Sam Okafor', 'sam@coreliv.app', passwordHash],
    )
    // Invited but never registered: no password, so the members table has a
    // pending row to render.
    const jules = await one<{ id: string }>(
      client,
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
      ['jules', 'jules@example.com'],
    )

    const org = await one<{ id: string }>(
      client,
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
      ['The Reyes household'],
    )

    await client.query(
      `INSERT INTO memberships (org_id, user_id, role, status, joined_at) VALUES
         ($1, $2, 'owner',  'active',  now() - interval '2 years'),
         ($1, $3, 'admin',  'active',  now() - interval '14 months'),
         ($1, $4, 'member', 'invited', now() - interval '3 days')`,
      [org.id, dana.id, sam.id, jules.id],
    )

    // Seeded past due on purpose: the billing banner is then visible on first
    // load without anyone having to break something to see it.
    await client.query(
      `INSERT INTO subscriptions (org_id, plan_id, status, current_period_end)
       VALUES ($1, 'home', 'past_due', now() - interval '4 days')`,
      [org.id],
    )

    // -----------------------------------------------------------------------
    // Properties and rooms
    // -----------------------------------------------------------------------
    const house = await one<{ id: string }>(
      client,
      `INSERT INTO properties (org_id, name, address, year_built, purchase_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        org.id,
        'Maple Street',
        '418 Maple Street, Ann Arbor, MI 48104',
        1998,
        years(-6),
        'Primary residence. Crawlspace under the east wing, attic access in the hall closet.',
      ],
    )
    const cabin = await one<{ id: string }>(
      client,
      `INSERT INTO properties (org_id, name, address, year_built, purchase_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        org.id,
        'Lake cabin',
        '9 Birch Lane, Interlochen, MI 49643',
        1974,
        years(-2),
        'Seasonal. Water is shut off and the lines blown out every October.',
      ],
    )

    const rooms: Record<string, string> = {}
    for (const [key, propertyId, name, floor] of [
      ['mech', house.id, 'Mechanical room', 'basement'],
      ['kitchen', house.id, 'Kitchen', '1'],
      ['laundry', house.id, 'Laundry', '1'],
      ['garage', house.id, 'Garage', '1'],
      ['attic', house.id, 'Attic', 'attic'],
      ['exterior', house.id, 'Exterior', 'exterior'],
      ['frontyard', house.id, 'Front yard', 'exterior'],
      ['cabinmech', cabin.id, 'Utility closet', '1'],
      ['cabinext', cabin.id, 'Exterior', 'exterior'],
    ] as const) {
      const row = await one<{ id: string }>(
        client,
        'INSERT INTO locations (property_id, name, floor) VALUES ($1, $2, $3) RETURNING id',
        [propertyId, name, floor],
      )
      rooms[key] = row.id
    }

    // -----------------------------------------------------------------------
    // Vendors
    // -----------------------------------------------------------------------
    const vendors: Record<string, string> = {}
    for (const [key, name, roles, phone, account, notes] of [
      ['comfort', 'Comfort Systems HVAC', ['installer', 'service'], '(734) 555-0142', 'CS-44810', 'Ask for Marco. Twice-yearly plan is prepaid through next spring.'],
      ['depot', 'Builders Depot', ['retailer'], '(734) 555-0199', '7781-2299', null],
      ['carrier', 'Carrier', ['manufacturer'], '(800) 555-0111', null, 'Register within 90 days or the parts warranty drops to 5 years.'],
      ['plumb', 'Northline Plumbing', ['service', 'installer'], '(734) 555-0163', null, null],
      ['green', 'Greenline Irrigation', ['service', 'installer'], '(734) 555-0177', 'GL-2210', 'Blowout is first come first served after 1 October.'],
      ['roofco', 'Anderson Roofing', ['installer'], '(734) 555-0128', null, '10-year workmanship warranty, transferable once.'],
      ['inspect', 'Great Lakes Home Inspection', ['inspector'], '(231) 555-0105', null, null],
    ] as const) {
      const row = await one<{ id: string }>(
        client,
        `INSERT INTO vendors (org_id, name, roles, phone, account_number, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [org.id, name, roles, phone, account, notes],
      )
      vendors[key] = row.id
    }

    // -----------------------------------------------------------------------
    // Assets
    // -----------------------------------------------------------------------
    interface AssetSeed {
      key: string
      propertyId: string
      category: string
      location?: string
      name: string
      brand?: string
      model?: string
      serial?: string
      purchase?: DateOnly
      install?: DateOnly
      purchaseCost?: number
      installCost?: number
      retailer?: string
      installer?: string
      lifespan?: number
      status?: 'active' | 'needs_repair' | 'retired' | 'replaced'
      specs?: Record<string, unknown>
      notes?: string
      tags?: string[]
    }

    const assetSeeds: AssetSeed[] = [
      {
        key: 'furnace',
        propertyId: house.id,
        category: 'furnace',
        location: 'mech',
        name: 'Furnace',
        brand: 'Carrier',
        model: '59TP6B080V17-20',
        serial: '4218A93472',
        purchase: years(-5),
        install: years(-5),
        purchaseCost: 3180,
        installCost: 1420,
        retailer: 'depot',
        installer: 'comfort',
        lifespan: 20,
        specs: { fuel: 'natural_gas', afue: 96, btu_input: 80000, stages: 'two', blower: 'variable_speed' },
        notes: 'Filter slot is on the return side, not the cabinet.',
        tags: ['gas', 'serviced-annually'],
      },
      {
        key: 'ac',
        propertyId: house.id,
        category: 'air-conditioner',
        location: 'exterior',
        name: 'AC condenser',
        brand: 'Carrier',
        model: '24ACC636A003',
        serial: '3919E10044',
        purchase: years(-5),
        install: years(-5),
        purchaseCost: 2740,
        installCost: 900,
        installer: 'comfort',
        lifespan: 15,
        specs: { tons: 3, seer2: 15.2, refrigerant: 'R-410A', stages: 'single' },
        tags: ['needs-pad-leveling'],
      },
      {
        key: 'thermostat',
        propertyId: house.id,
        category: 'thermostat',
        location: 'kitchen',
        name: 'Hallway thermostat',
        brand: 'Ecobee',
        model: 'Smart Thermostat Premium',
        serial: 'EB-772311',
        purchase: years(-2),
        install: years(-2),
        purchaseCost: 249,
        lifespan: 10,
        specs: { smart: true, stages_supported: 2, c_wire: true },
        tags: ['smart'],
      },
      {
        key: 'waterheater',
        propertyId: house.id,
        category: 'water-heater',
        location: 'mech',
        name: 'Water heater',
        brand: 'Rheem',
        model: 'XG50T06EC38U0',
        serial: 'RH2178-40912',
        purchase: years(-9),
        install: years(-9),
        purchaseCost: 740,
        installCost: 520,
        installer: 'plumb',
        lifespan: 10,
        status: 'needs_repair',
        specs: { type: 'tank', capacity_gal: 50, fuel: 'natural_gas', first_hour_rating: 84, anode_type: 'magnesium' },
        notes: 'Slow weep at the T&P discharge since spring. Pan is dry but watch it.',
        tags: ['replace-soon', 'gas'],
      },
      {
        key: 'softener',
        propertyId: house.id,
        category: 'water-softener',
        location: 'mech',
        name: 'Water softener',
        brand: 'Culligan',
        model: 'HE 1.25',
        serial: 'CU-559120',
        purchase: years(-4),
        install: years(-4),
        purchaseCost: 1290,
        lifespan: 15,
        specs: { grain_capacity: 32000, salt_type: 'pellet', regeneration: 'metered' },
      },
      {
        key: 'sump',
        propertyId: house.id,
        category: 'sump-pump',
        location: 'mech',
        name: 'Sump pump',
        brand: 'Zoeller',
        model: 'M53 Mighty-Mate',
        serial: 'ZO-9912A',
        purchase: years(-3),
        install: years(-3),
        purchaseCost: 210,
        lifespan: 10,
        specs: { hp: 0.33, type: 'submersible', battery_backup: false },
        tags: ['no-backup'],
      },
      {
        key: 'fridge',
        propertyId: house.id,
        category: 'refrigerator',
        location: 'kitchen',
        name: 'Refrigerator',
        brand: 'Bosch',
        model: 'B36CT80SNS',
        serial: 'BO-4471129',
        purchase: years(-3),
        purchaseCost: 3299,
        retailer: 'depot',
        lifespan: 13,
        specs: { style: 'french_door', capacity_cuft: 21, ice_maker: true, counter_depth: true },
      },
      {
        key: 'dishwasher',
        propertyId: house.id,
        category: 'dishwasher',
        location: 'kitchen',
        name: 'Dishwasher',
        brand: 'Bosch',
        model: 'SHXM88Z75N',
        serial: 'BO-8830221',
        purchase: years(-3),
        purchaseCost: 1099,
        retailer: 'depot',
        lifespan: 10,
        specs: { db_rating: 42, third_rack: true },
      },
      {
        key: 'range',
        propertyId: house.id,
        category: 'range',
        location: 'kitchen',
        name: 'Range',
        brand: 'GE',
        model: 'JGB735SPSS',
        serial: 'GE-2201884',
        purchase: years(-6),
        purchaseCost: 899,
        lifespan: 15,
        specs: { fuel: 'natural_gas', width_in: 30, burners: 5, convection: true },
      },
      {
        key: 'washer',
        propertyId: house.id,
        category: 'washer',
        location: 'laundry',
        name: 'Washer',
        brand: 'LG',
        model: 'WM4000HWA',
        serial: 'LG-6620913',
        purchase: years(-4),
        purchaseCost: 899,
        lifespan: 11,
        specs: { type: 'front_load', capacity_cuft: 4.5 },
      },
      {
        key: 'dryer',
        propertyId: house.id,
        category: 'dryer',
        location: 'laundry',
        name: 'Dryer',
        brand: 'LG',
        model: 'DLEX4000B',
        serial: 'LG-6620944',
        purchase: years(-4),
        purchaseCost: 949,
        lifespan: 13,
        specs: { fuel: 'electric', capacity_cuft: 7.4, vented: true },
        notes: 'Vent run is long - goes up and out the east gable.',
      },
      {
        key: 'panel',
        propertyId: house.id,
        category: 'electrical-panel',
        location: 'mech',
        name: 'Main panel',
        brand: 'Square D',
        model: 'QO140M200',
        serial: 'SQ-118827',
        install: years(-6),
        lifespan: 40,
        specs: { amperage: 200, spaces: 40, breaker_type: 'QO', afci: false },
      },
      {
        key: 'evse',
        propertyId: house.id,
        category: 'ev-charger',
        location: 'garage',
        name: 'EV charger',
        brand: 'ChargePoint',
        model: 'Home Flex',
        serial: 'CP-771204',
        purchase: months(-14),
        install: months(-14),
        purchaseCost: 549,
        installCost: 680,
        lifespan: 12,
        specs: { level: '2', amps: 48, connector: 'j1772', hardwired: true },
        tags: ['smart'],
      },
      {
        key: 'roof',
        propertyId: house.id,
        category: 'roof',
        location: 'exterior',
        name: 'Roof',
        brand: 'GAF',
        model: 'Timberline HDZ',
        install: years(-7),
        purchaseCost: 14800,
        installer: 'roofco',
        lifespan: 25,
        specs: { material: 'asphalt_shingle', layers: 1, area_sqft: 2400, pitch: '6:12' },
        tags: ['sale_disclosure'],
      },
      {
        key: 'gutters',
        propertyId: house.id,
        category: 'gutters',
        location: 'exterior',
        name: 'Gutters',
        brand: 'Leaf Relief',
        install: years(-7),
        purchaseCost: 2100,
        lifespan: 20,
        specs: { material: 'aluminum', guards: true, linear_ft: 180 },
      },
      {
        key: 'irrigation',
        propertyId: house.id,
        category: 'irrigation-controller',
        location: 'garage',
        name: 'Irrigation controller',
        brand: 'Rachio',
        model: '3 Smart Sprinkler (8 zone)',
        serial: 'RA-330871',
        purchase: years(-3),
        install: years(-3),
        purchaseCost: 229,
        installer: 'green',
        lifespan: 12,
        specs: { zone_count: 6, smart: true, flow_sensor: false, backflow_type: 'pvb' },
        tags: ['smart'],
      },
      {
        key: 'garage',
        propertyId: house.id,
        category: 'garage-door-opener',
        location: 'garage',
        name: 'Garage door opener',
        brand: 'LiftMaster',
        model: '8500W',
        serial: 'LM-4429183',
        purchase: years(-5),
        purchaseCost: 520,
        lifespan: 15,
        specs: { drive: 'jackshaft', hp: 0.5, battery_backup: true },
      },
      {
        key: 'smoke',
        propertyId: house.id,
        category: 'smoke-alarm',
        location: 'attic',
        name: 'Smoke and CO alarms (6)',
        brand: 'First Alert',
        model: 'SC9120B',
        install: years(-8),
        purchaseCost: 240,
        lifespan: 10,
        specs: { power: 'hardwired_with_battery', sensor: 'dual', interconnected: true, replace_by: years(2) },
        notes: 'All six are the same date code. Replace as a set.',
        tags: ['replace-soon'],
      },
      {
        key: 'paint',
        propertyId: house.id,
        category: 'paint',
        location: 'kitchen',
        name: 'Interior paint - main floor',
        brand: 'Sherwin-Williams',
        model: 'Emerald Interior',
        purchase: years(-2),
        purchaseCost: 410,
        specs: { color: 'SW 7015 Repose Gray', finish: 'eggshell', brand_line: 'Emerald', rooms: 'Living, hall, kitchen' },
      },
      {
        key: 'cabinheater',
        propertyId: cabin.id,
        category: 'water-heater',
        location: 'cabinmech',
        name: 'Cabin water heater',
        brand: 'Bradford White',
        model: 'RE240T6-1NCWW',
        serial: 'BW-3312907',
        install: years(-2),
        purchaseCost: 690,
        installer: 'plumb',
        lifespan: 12,
        specs: { type: 'tank', capacity_gal: 40, fuel: 'electric', anode_type: 'aluminum' },
      },
      {
        key: 'cabinseptic',
        propertyId: cabin.id,
        category: 'septic-system',
        location: 'cabinext',
        name: 'Septic system',
        install: years(-16),
        lifespan: 30,
        specs: { tank_gal: 1000, field_type: 'conventional' },
        notes: 'Lid is about 4 m off the north corner, under the flat stone.',
      },
      {
        key: 'cabinroof',
        propertyId: cabin.id,
        category: 'roof',
        location: 'cabinext',
        name: 'Cabin roof',
        brand: 'Union',
        model: 'Standing seam',
        install: years(-12),
        purchaseCost: 9200,
        lifespan: 45,
        specs: { material: 'metal', layers: 1, area_sqft: 1100, pitch: '8:12' },
      },
    ]

    const assets: Record<string, string> = {}
    for (const seedRow of assetSeeds) {
      const row = await one<{ id: string }>(
        client,
        `INSERT INTO assets
           (property_id, category_id, location_id, name, brand, model_number, serial_number,
            purchase_date, install_date, purchase_cost, install_cost, retailer_id, installer_id,
            expected_lifespan_years, status, specs, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [
          seedRow.propertyId,
          await categoryId(client, seedRow.category),
          seedRow.location ? rooms[seedRow.location] : null,
          seedRow.name,
          seedRow.brand ?? null,
          seedRow.model ?? null,
          seedRow.serial ?? null,
          seedRow.purchase ?? null,
          seedRow.install ?? null,
          seedRow.purchaseCost ?? null,
          seedRow.installCost ?? null,
          seedRow.retailer ? vendors[seedRow.retailer] : null,
          seedRow.installer ? vendors[seedRow.installer] : null,
          seedRow.lifespan ?? null,
          seedRow.status ?? 'active',
          JSON.stringify(seedRow.specs ?? {}),
          seedRow.notes ?? null,
        ],
      )
      assets[seedRow.key] = row.id

      for (const tag of seedRow.tags ?? []) {
        await client.query('INSERT INTO asset_tags (asset_id, tag) VALUES ($1, $2)', [row.id, tag])
      }
    }

    // The condenser belongs to the furnace's system.
    await client.query('UPDATE assets SET parent_asset_id = $2 WHERE id = $1', [
      assets.ac,
      assets.furnace,
    ])

    // -----------------------------------------------------------------------
    // Warranties: one of each state the badge can show
    // -----------------------------------------------------------------------
    for (const [assetKey, kind, provider, start, end, registered, ref, notes] of [
      // Expiring inside the 60-day window, so the "expiring soon" tile is non-zero.
      ['furnace', 'manufacturer_parts', 'carrier', years(-5), days(37), true, 'CAR-88213904', 'Heat exchanger 20 years, other parts 10 - registered in time.'],
      ['furnace', 'installer_labor', 'comfort', years(-5), years(-4), true, null, 'One year labor, long gone.'],
      // Already lapsed.
      ['ac', 'manufacturer_parts', 'carrier', years(-5), days(-120), false, null, 'Never registered, so 5 years instead of 10.'],
      // Lifetime.
      ['cabinroof', 'manufacturer_parts', null, years(-12), null, true, 'UN-4471', 'Lifetime on the panels, 20 years on the finish.'],
      ['roof', 'installer_labor', 'roofco', years(-7), years(3), true, 'AR-2019-114', 'Workmanship, transferable once on sale.'],
      ['fridge', 'extended', 'depot', years(-3), days(-30), false, 'BD-EXT-77120', '3-year extended plan, expired last month.'],
      ['evse', 'manufacturer_parts', null, months(-14), months(22), true, 'CP-WR-55120', '3-year parts.'],
      ['cabinheater', 'manufacturer_parts', null, years(-2), years(4), false, null, '6-year tank, 6-year parts.'],
    ] as const) {
      await client.query(
        `INSERT INTO warranties
           (asset_id, kind, provider_id, start_date, end_date, registered, registration_ref, transferable, coverage_notes, claim_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          assets[assetKey],
          kind,
          provider ? vendors[provider] : null,
          start,
          end,
          registered,
          ref,
          kind === 'installer_labor',
          notes,
          provider === 'carrier' ? '(800) 555-0111' : null,
        ],
      )
    }

    // -----------------------------------------------------------------------
    // Consumables
    // -----------------------------------------------------------------------
    const consumables: Record<string, string> = {}
    for (const [key, assetKey, name, part, size, value, unit, last, qty, cost] of [
      // Overdue by about a month: the dashboard has something to show.
      ['filter', 'furnace', 'Air filter', 'FPR-1025', '20x25x4 MERV 11', 3, 'month', months(-4), 1, 34.5],
      ['humidifier', 'furnace', 'Humidifier pad', 'A35', 'Aprilaire 35', 1, 'year', months(-13), 0, 22],
      ['softenersalt', 'softener', 'Softener salt', null, '40 lb pellet bags', 2, 'month', days(-20), 6, 8.75],
      ['anode', 'waterheater', 'Anode rod', 'AR-3444', '3/4 in NPT magnesium', 4, 'year', years(-9), 0, 48],
      ['fridgefilter', 'fridge', 'Water filter', 'BORPLFTR55', 'UltraClarity Pro', 6, 'month', months(-5), 2, 59],
      ['smokebatt', 'smoke', 'Backup batteries', null, '9V, six of them', 1, 'year', months(-8), 8, 14],
      ['gutterguard', 'gutters', null, null, null, null, null, null, 0, null],
    ] as const) {
      if (name === null) continue
      const row = await one<{ id: string }>(
        client,
        `INSERT INTO consumables
           (asset_id, name, part_number, size_or_spec, interval_value, interval_unit, last_replaced_on, quantity_on_hand, unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [assets[assetKey], name, part, size, value, unit, last, qty, cost],
      )
      consumables[key] = row.id
    }

    // -----------------------------------------------------------------------
    // Maintenance tasks
    // -----------------------------------------------------------------------
    const tasks: Record<string, string> = {}
    for (const [key, propertyId, assetKey, name, value, unit, seasonMonth, diy, vendor, last, instructions] of [
      ['hvacservice', house.id, 'furnace', 'HVAC service visit', 6, 'month', null, false, 'comfort', months(-7), 'Spring and autumn. Prepaid plan covers both.'],
      ['flush', house.id, 'waterheater', 'Flush water heater', 1, 'year', null, true, null, null, 'Hose to the floor drain, open the drain valve, run until clear.'],
      ['blowout', house.id, 'irrigation', 'Irrigation blowout', 1, 'year', 10, false, 'green', months(-11), 'Book by mid-September; they fill up.'],
      ['gutterclean', house.id, null, 'Clear gutters', 6, 'month', 11, true, null, months(-8), 'Guards still collect needles at the north valley.'],
      ['sumptest', house.id, 'sump', 'Test sump pump', 3, 'month', null, true, null, days(-40), 'Pour a bucket in and confirm it kicks on and shuts off.'],
      ['dryervent', house.id, 'dryer', 'Clean dryer vent', 1, 'year', null, true, null, months(-14), 'Long run to the east gable - brush the whole length.'],
      ['septic', cabin.id, 'cabinseptic', 'Pump septic tank', 3, 'year', null, false, null, years(-2), null],
      ['winterize', cabin.id, null, 'Winterize the cabin', 1, 'year', 10, true, null, months(-11), 'Shut the main, blow the lines, antifreeze in the traps.'],
    ] as const) {
      const row = await one<{ id: string }>(
        client,
        `INSERT INTO maintenance_tasks
           (property_id, asset_id, name, interval_value, interval_unit, season_month, diy, preferred_vendor_id, last_done_on, instructions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          propertyId,
          assetKey ? assets[assetKey] : null,
          name,
          value,
          unit,
          seasonMonth,
          diy,
          vendor ? vendors[vendor] : null,
          last,
          instructions,
        ],
      )
      tasks[key] = row.id
    }

    // -----------------------------------------------------------------------
    // Service history
    // -----------------------------------------------------------------------
    for (const [assetKey, kind, occurred, vendor, tech, cost, summary, parts, readings] of [
      ['furnace', 'install', years(-5), 'comfort', 'Marco D.', 4600, 'Replaced the original 80% unit with a 96% two-stage. New PVC intake and exhaust through the rim joist.', ['furnace', 'flue'], null],
      ['furnace', 'maintenance', months(-7), 'comfort', 'Marco D.', 0, 'Autumn service. Cleaned the burners and flame sensor, checked static pressure.', [], { static_pressure_iwc: 0.62, temp_rise_f: 42 }],
      ['furnace', 'repair', months(-19), 'comfort', 'Priya S.', 186, 'Igniter failed on the first cold night. Replaced under the parts warranty, paid labor only.', ['hot surface igniter'], null],
      ['ac', 'maintenance', months(-14), 'comfort', 'Marco D.', 0, 'Spring service. Coil rinsed, charge checked - 8 oz low, topped up.', [], { superheat_f: 12, refrigerant_added_oz: 8 }],
      ['waterheater', 'inspection', days(-58), 'plumb', 'Ed R.', 95, 'Weeping T&P valve. Not urgent, but the tank is at the end of its life - budget a replacement.', [], null],
      ['roof', 'install', years(-7), 'roofco', null, 14800, 'Full tear-off to the deck, new ice and water shield, Timberline HDZ in Weathered Wood.', ['shingles', 'underlayment', 'drip edge'], null],
      ['roof', 'inspection', months(-9), 'inspect', 'L. Whitfield', 175, 'Post-storm check. No lifted shingles; one boot on the south slope should be watched.', [], null],
      ['irrigation', 'maintenance', months(-11), 'green', null, 95, 'Autumn blowout, all six zones.', [], null],
      ['dishwasher', 'repair', months(-5), null, null, 0, 'Drain pump jammed on a fruit pit. Cleared it without a part.', [], null],
      ['cabinheater', 'install', years(-2), 'plumb', 'Ed R.', 1210, 'Replaced the 1990s unit. Pan and drain added at the same time.', ['water heater', 'pan'], null],
      ['evse', 'install', months(-14), null, 'Self + licensed electrician', 680, '60 A circuit from the main panel, hardwired at 48 A.', ['breaker', 'conduit'], null],
    ] as const) {
      await client.query(
        `INSERT INTO service_events
           (asset_id, kind, occurred_on, vendor_id, technician, cost, summary, parts_replaced, readings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          assets[assetKey],
          kind,
          occurred,
          vendor ? vendors[vendor] : null,
          tech,
          cost,
          summary,
          parts,
          readings === null ? null : JSON.stringify(readings),
        ],
      )
    }

    // Tie the last HVAC visit to the recurring task that it satisfied.
    await client.query(
      `UPDATE service_events SET task_id = $1
        WHERE asset_id = $2 AND kind = 'maintenance' AND occurred_on = $3`,
      [tasks.hvacservice, assets.furnace, months(-7)],
    )

    // -----------------------------------------------------------------------
    // Documents
    // -----------------------------------------------------------------------
    for (const [propertyId, assetKey, kind, title, url, mime, captured] of [
      [house.id, 'furnace', 'manual', 'Carrier 59TP6 installation manual', 'https://example.com/docs/carrier-59tp6.pdf', 'application/pdf', years(-5)],
      [house.id, 'furnace', 'invoice', 'Comfort Systems - furnace install', 'https://example.com/docs/cs-invoice-4471.pdf', 'application/pdf', years(-5)],
      [house.id, 'furnace', 'data_plate_photo', 'Furnace data plate', 'https://example.com/docs/furnace-plate.jpg', 'image/jpeg', years(-5)],
      [house.id, 'roof', 'warranty', 'Anderson Roofing workmanship warranty', 'https://example.com/docs/anderson-warranty.pdf', 'application/pdf', years(-7)],
      [house.id, 'roof', 'permit', 'Re-roof permit 2019-4471', 'https://example.com/docs/permit-2019-4471.pdf', 'application/pdf', years(-7)],
      [house.id, 'fridge', 'receipt', 'Builders Depot - refrigerator', 'https://example.com/docs/bd-receipt-7781.pdf', 'application/pdf', years(-3)],
      [house.id, 'waterheater', 'inspection_report', 'Northline - T&P assessment', 'https://example.com/docs/northline-tp.pdf', 'application/pdf', days(-58)],
      [house.id, null, 'inspection_report', 'Purchase inspection report', 'https://example.com/docs/inspection-2020.pdf', 'application/pdf', years(-6)],
      [cabin.id, 'cabinseptic', 'permit', 'Septic permit', 'https://example.com/docs/septic-permit.pdf', 'application/pdf', years(-16)],
    ] as const) {
      await client.query(
        `INSERT INTO documents (property_id, asset_id, kind, title, storage_url, mime_type, captured_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [propertyId, assetKey ? assets[assetKey] : null, kind, title, url, mime, captured],
      )
    }

    // -----------------------------------------------------------------------
    // Access points - the things you need at 2am
    // -----------------------------------------------------------------------
    for (const [propertyId, assetKey, location, kind, label, description] of [
      [house.id, null, 'mech', 'water_main', 'Main water shutoff', 'Mechanical room, north wall behind the furnace. Red lever, quarter turn clockwise.'],
      [house.id, 'furnace', 'mech', 'gas_valve', 'Furnace gas cock', 'On the black iron drop, right of the cabinet. Handle across the pipe is off.'],
      [house.id, null, 'mech', 'gas_valve', 'Main gas shutoff', 'Exterior, meter on the east wall. Needs a crescent wrench - one is zip-tied to the riser.'],
      [house.id, 'ac', 'mech', 'breaker', 'Breaker 14 - AC condenser', 'Main panel, right column. Also a pull-disconnect on the wall beside the condenser.'],
      [house.id, 'irrigation', 'frontyard', 'irrigation_drain', 'Irrigation backflow and drain', 'PVB in the box beside the hose bib. Two bleed screws under the bonnet.'],
      [house.id, null, 'mech', 'cleanout', 'Main sewer cleanout', 'Floor of the mechanical room, cast iron plug under the stairs.'],
      [cabin.id, null, 'cabinmech', 'water_main', 'Cabin main shutoff', 'Utility closet, behind the door. Ball valve plus the pump breaker above it.'],
    ] as const) {
      await client.query(
        `INSERT INTO access_points (property_id, asset_id, location_id, kind, label, description)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [propertyId, assetKey ? assets[assetKey] : null, rooms[location], kind, label, description],
      )
    }

    // -----------------------------------------------------------------------
    // Irrigation zones
    // -----------------------------------------------------------------------
    for (const [number, name, head, count, valve, minutes, schedule] of [
      [1, 'Front lawn - street side', 'rotor', 6, 'Box by the mailbox', 25, { days: ['mon', 'thu'], start: '05:00' }],
      [2, 'Front lawn - house side', 'rotor', 5, 'Box by the mailbox', 25, { days: ['mon', 'thu'], start: '05:30' }],
      [3, 'Foundation beds', 'drip', 1, 'Box by the mailbox', 40, { days: ['tue', 'fri'], start: '05:00' }],
      [4, 'Back lawn', 'rotor', 7, 'Box at the north fence', 30, { days: ['mon', 'thu'], start: '06:00' }],
      [5, 'Vegetable garden', 'drip', 1, 'Box at the north fence', 45, { days: ['mon', 'wed', 'fri'], start: '05:45' }],
      [6, 'Side strip', 'spray', 4, 'Box at the north fence', 12, { days: ['tue', 'fri'], start: '05:45' }],
    ] as const) {
      await client.query(
        `INSERT INTO irrigation_zones
           (controller_asset_id, zone_number, name, head_type, head_count, valve_location, run_minutes, schedule)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [assets.irrigation, number, name, head, count, valve, minutes, JSON.stringify(schedule)],
      )
    }

    // -----------------------------------------------------------------------
    // Recall checks
    // -----------------------------------------------------------------------
    await client.query(
      `INSERT INTO recall_checks (asset_id, checked_on, affected, notes) VALUES
         ($1, $2, false, 'Checked the CPSC database against the model and serial - nothing listed.'),
         ($3, $2, false, 'No open recalls.')`,
      [assets.furnace, months(-2), assets.dryer],
    )

    console.log('Seeded:')
    console.log('  organization  The Reyes household')
    console.log(`  properties    2, assets ${assetSeeds.length}`)
    console.log(`  sign in       dana@coreliv.app / ${DEMO_PASSWORD}`)
    console.log(`                sam@coreliv.app  / ${DEMO_PASSWORD}  (admin)`)
  })
}

const entry = process.argv[1]
if (entry && import.meta.url === (await import('node:url')).pathToFileURL(entry).href) {
  try {
    await seed()
    await pool.end()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    await pool.end().catch(() => {})
    process.exit(1)
  }
}
