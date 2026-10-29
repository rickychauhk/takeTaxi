package online.hktaketaxi.driverapp.incoming

import android.content.Intent

object IncomingOrderLaunch {
  @Volatile
  var pendingOrderId: String? = null

  fun captureFromIntent(intent: Intent?) {
    val id = intent?.getStringExtra("taxima_focus_order_id")?.trim().orEmpty()
    if (id.isNotEmpty()) pendingOrderId = id
  }
}
