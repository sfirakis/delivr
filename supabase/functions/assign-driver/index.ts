// supabase/functions/assign-driver/index.ts
// Auto-assigns the nearest available driver to a confirmed order
// Called by: confirm-order function (fire & forget)
// Also supports manual re-assignment from admin panel

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Haversine distance formula (km)
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Driver score: lower = better (distance + workload penalty)
function driverScore(driver: any, storeLat: number, storeLng: number): number {
  const dist = distanceKm(
    driver.current_lat ?? storeLat,
    driver.current_lng ?? storeLng,
    storeLat, storeLng
  )
  const activeOrderPenalty = (driver.active_orders_count ?? 0) * 1.5
  return dist + activeOrderPenalty
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { orderId, storeId, forceDriverId } = await req.json()

    // 1. Get order & store location
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, total, delivery_address, store:stores(lat, lng, name, avg_delivery_time)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) throw new Error('Order not found')

    const store = order.store as any
    if (!store?.lat) throw new Error('Store location not found')

    // 2. If manual assignment, use that driver
    if (forceDriverId) {
      await supabase.from('orders').update({
        driver_id: forceDriverId,
        status:    'preparing',
      }).eq('id', orderId)

      return new Response(
        JSON.stringify({ success: true, driverId: forceDriverId, method: 'manual' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Find available drivers within 8km radius
    const { data: drivers } = await supabase
      .from('driver_sessions')
      .select(`
        driver_id,
        current_lat,
        current_lng,
        active_orders_count,
        vehicle_type,
        profiles(full_name, phone, fcm_token)
      `)
      .eq('is_online', true)
      .eq('is_available', true)
      .gte('last_seen', new Date(Date.now() - 5 * 60000).toISOString()) // Active in last 5 min

    if (!drivers || drivers.length === 0) {
      console.log(`No drivers available for order ${orderId}`)
      // Schedule retry in 2 minutes
      return new Response(
        JSON.stringify({ success: false, reason: 'no_drivers_available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Score & rank drivers
    const scored = drivers
      .map(d => ({ ...d, score: driverScore(d, store.lat, store.lng) }))
      .filter(d => d.score <= 8) // Max 8km away
      .sort((a, b) => a.score - b.score)

    if (scored.length === 0) {
      return new Response(
        JSON.stringify({ success: false, reason: 'no_drivers_in_range' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bestDriver = scored[0]
    const estimatedKm = distanceKm(bestDriver.current_lat, bestDriver.current_lng, store.lat, store.lng)
    const estimatedPickupMins = Math.ceil(estimatedKm * 3 + 5) // ~3 min/km + 5 min buffer
    const totalETA = (store.avg_delivery_time ?? 30) + estimatedPickupMins

    // 5. Assign driver
    await supabase.from('orders').update({
      driver_id:            bestDriver.driver_id,
      estimated_delivery_at: new Date(Date.now() + totalETA * 60000).toISOString(),
    }).eq('id', orderId)

    // 6. Notify driver via FCM push
    const driverProfile = bestDriver.profiles as any
    if (driverProfile?.fcm_token) {
      const notifUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
      await fetch(notifUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          userId:  bestDriver.driver_id,
          title:   '🛵 Νέα ανάθεση!',
          body:    `${store.name} · €${Number(order.total).toFixed(2)} · ${estimatedKm.toFixed(1)}km`,
          type:    'new_assignment',
          data: {
            orderId,
            storeId,
            storeName:  store.name,
            estimatedKm: estimatedKm.toFixed(1),
            total:      order.total,
          },
        }),
      })
    }

    // 7. Update driver session
    await supabase
      .from('driver_sessions')
      .update({ active_orders_count: (bestDriver.active_orders_count ?? 0) + 1 })
      .eq('driver_id', bestDriver.driver_id)

    console.log(`Order ${orderId} assigned to driver ${bestDriver.driver_id} (score: ${bestDriver.score.toFixed(2)})`)

    return new Response(
      JSON.stringify({
        success:          true,
        driverId:         bestDriver.driver_id,
        driverName:       driverProfile?.full_name,
        estimatedKm:      estimatedKm.toFixed(1),
        estimatedPickupMins,
        totalETA,
        method:           'auto',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('assign-driver error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
