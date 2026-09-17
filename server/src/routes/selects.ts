/**
 * Shared SELECT fragments.
 *
 * Each one produces exactly the shape of its domain type, camelCase aliases
 * included, so route handlers can return rows straight from the driver. They
 * are appended to rather than interpolated into, and every fragment fixes its
 * table alias (`a`, `w`, `c`, `t`, `e`, `d`) so callers know what to filter on.
 */

export const ASSET_SELECT = `
  SELECT a.id,
         a.property_id     AS "propertyId",
         a.category_id     AS "categoryId",
         a.location_id     AS "locationId",
         a.parent_asset_id AS "parentAssetId",
         a.name, a.brand,
         a.model_number    AS "modelNumber",
         a.serial_number   AS "serialNumber",
         a.description,
         a.purchase_date    AS "purchaseDate",
         a.install_date     AS "installDate",
         a.manufacture_date AS "manufactureDate",
         a.purchase_cost    AS "purchaseCost",
         a.install_cost     AS "installCost",
         a.retailer_id      AS "retailerId",
         a.installer_id     AS "installerId",
         a.expected_lifespan_years AS "expectedLifespanYears",
         a.status,
         a.replaced_by_id AS "replacedById",
         a.retired_at     AS "retiredAt",
         a.specs,
         a.notes,
         COALESCE((SELECT array_agg(t.tag ORDER BY t.tag) FROM asset_tags t WHERE t.asset_id = a.id), '{}') AS tags,
         a.created_at AS "createdAt",
         a.updated_at AS "updatedAt"
    FROM assets a
`

export const WARRANTY_SELECT = `
  SELECT w.id,
         w.asset_id    AS "assetId",
         w.kind,
         w.provider_id AS "providerId",
         v.name        AS "providerName",
         w.start_date  AS "startDate",
         w.end_date    AS "endDate",
         w.registered,
         w.registration_ref AS "registrationRef",
         w.transferable,
         w.coverage_notes AS "coverageNotes",
         w.claim_phone    AS "claimPhone"
    FROM warranties w
    LEFT JOIN vendors v ON v.id = w.provider_id
`

export const CONSUMABLE_SELECT = `
  SELECT c.id,
         c.asset_id     AS "assetId",
         c.name,
         c.part_number  AS "partNumber",
         c.size_or_spec AS "sizeOrSpec",
         c.interval_value AS "intervalValue",
         c.interval_unit  AS "intervalUnit",
         c.last_replaced_on AS "lastReplacedOn",
         c.quantity_on_hand AS "quantityOnHand",
         c.reorder_url AS "reorderUrl",
         c.unit_cost   AS "unitCost",
         c.notes
    FROM consumables c
`

export const TASK_SELECT = `
  SELECT t.id,
         t.property_id AS "propertyId",
         p.name        AS "propertyName",
         t.asset_id    AS "assetId",
         a.name        AS "assetName",
         t.name,
         t.interval_value AS "intervalValue",
         t.interval_unit  AS "intervalUnit",
         t.season_month   AS "seasonMonth",
         t.diy,
         t.preferred_vendor_id AS "preferredVendorId",
         v.name                AS "preferredVendorName",
         t.last_done_on AS "lastDoneOn",
         t.instructions,
         t.active
    FROM maintenance_tasks t
    JOIN properties p     ON p.id = t.property_id
    LEFT JOIN assets a    ON a.id = t.asset_id
    LEFT JOIN vendors v   ON v.id = t.preferred_vendor_id
`

export const EVENT_SELECT = `
  SELECT e.id,
         e.asset_id AS "assetId",
         a.name     AS "assetName",
         a.property_id AS "propertyId",
         e.task_id       AS "taskId",
         e.consumable_id AS "consumableId",
         e.kind,
         e.occurred_on AS "occurredOn",
         e.vendor_id   AS "vendorId",
         v.name        AS "vendorName",
         e.technician,
         e.cost,
         e.covered_by_warranty_id AS "coveredByWarrantyId",
         e.summary,
         COALESCE(e.parts_replaced, '{}') AS "partsReplaced",
         e.readings,
         e.created_at AS "createdAt"
    FROM service_events e
    JOIN assets a       ON a.id = e.asset_id
    LEFT JOIN vendors v ON v.id = e.vendor_id
`

export const DOCUMENT_SELECT = `
  SELECT d.id,
         d.property_id AS "propertyId",
         d.asset_id    AS "assetId",
         a.name        AS "assetName",
         d.warranty_id AS "warrantyId",
         d.service_event_id AS "serviceEventId",
         d.kind,
         d.title,
         d.storage_url AS "storageUrl",
         d.mime_type   AS "mimeType",
         d.byte_size   AS "byteSize",
         d.captured_on AS "capturedOn",
         d.notes,
         d.created_at AS "createdAt"
    FROM documents d
    LEFT JOIN assets a ON a.id = d.asset_id
`

/**
 * Vendor columns, shared so the `roles` cast below cannot be forgotten at a
 * new call site.
 *
 * `roles` is `vendor_role[]` - an array of a user-defined enum. node-postgres
 * ships array parsers keyed by built-in type OIDs only, so a user-defined
 * enum's array OID is unknown to it and the value arrives as the raw literal
 * `'{installer,service}'` rather than an array. `text[]` is a built-in, so
 * casting hands the driver something it knows how to parse, and the enum
 * labels are exactly the strings the domain type declares.
 *
 * `useCount` is deliberately not here: it is four correlated subqueries, and
 * the asset page reads vendors on a path that does not need the number.
 */
export const VENDOR_COLUMNS = `
  v.id,
  v.name,
  v.roles::text[] AS roles,
  v.phone,
  v.email,
  v.website,
  v.account_number AS "accountNumber",
  v.notes
`

/**
 * How much history points at a vendor. Their references are ON DELETE SET
 * NULL, so this is what the UI shows before anyone confirms a delete.
 */
export const VENDOR_USE_COUNT = `(
  (SELECT count(*)::int FROM assets a WHERE a.retailer_id = v.id OR a.installer_id = v.id)
  + (SELECT count(*)::int FROM service_events e WHERE e.vendor_id = v.id)
  + (SELECT count(*)::int FROM warranties w WHERE w.provider_id = v.id)
  + (SELECT count(*)::int FROM maintenance_tasks t WHERE t.preferred_vendor_id = v.id)
)`
