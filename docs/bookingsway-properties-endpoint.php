<?php
/**
 * Delivr ⇄ Bookingsway — full property export
 *
 * Bookingsway's existing `GET bw/v1/properties` returns only the distinct
 * property NAMES pulled from booking meta, which is not enough to place a
 * delivery: Delivr needs a street address and, ideally, coordinates.
 *
 * This snippet adds `GET bw/v1/properties/full`, which returns the Hospitable
 * catalog with `address`, `lat` and `lng` already normalised by
 * bw_hosp_property_detail(). Drop it in as a small plugin (or into the
 * bookingsway-api plugin) on the Bookingsway site, then in Delivr:
 *
 *   Διαχείριση → Καταλύματα & QR → 📥 Μαζική εισαγωγή
 *   and paste the JSON returned by:
 *   curl -H "X-BW-API-Key: <key>" https://bookingsway.com/wp-json/bw/v1/properties/full
 *
 * The importer maps name / address / area / lat / lng / phone automatically and
 * generates a unique QR code for every property that does not already have one.
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
    register_rest_route('bw/v1', '/properties/full', [
        'methods'             => 'GET',
        'callback'            => 'bw_api_list_properties_full',
        'permission_callback' => 'bw_api_permission',   // same API key as the rest of bw/v1
    ]);
});

function bw_api_list_properties_full(WP_REST_Request $request): WP_REST_Response {
    $out = [];

    // The Hospitable catalog is what actually carries addresses and coordinates.
    $catalog = function_exists('bw_hosp_property_catalog') ? bw_hosp_property_catalog() : [];

    foreach ((array) $catalog as $entry) {
        $uuid = is_array($entry) ? ($entry['uuid'] ?? $entry['id'] ?? '') : (string) $entry;
        if ($uuid === '') continue;

        $detail = function_exists('bw_hosp_property_detail') ? bw_hosp_property_detail($uuid) : null;
        if (!is_array($detail)) continue;

        $address = trim((string) ($detail['address'] ?? ''));
        if ($address === '') continue;   // nothing to deliver to

        // "Street 14, Elounda, 72053, Greece" → area/postcode best-effort
        $parts    = array_map('trim', explode(',', $address));
        $postcode = '';
        foreach ($parts as $part) {
            if (preg_match('/^\d{3}\s?\d{2}$/', $part)) { $postcode = $part; break; }
        }
        $area = count($parts) >= 2 ? $parts[1] : '';

        $out[] = [
            'external_ref' => $uuid,
            'source'       => 'bookingsway',
            'name'         => (string) ($detail['name'] ?? ''),
            'address'      => $address,
            'area'         => $area,
            'postal_code'  => $postcode,
            'lat'          => (string) ($detail['lat'] ?? ''),
            'lng'          => (string) ($detail['lng'] ?? ''),
            'type'         => strtolower((string) ($detail['property_type'] ?? 'villa')),
            'max_guests'   => (int) ($detail['max'] ?? 0),
        ];
    }

    return new WP_REST_Response(['data' => $out, 'count' => count($out)], 200);
}
