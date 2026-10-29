package online.hktaketaxi.driverapp.incoming

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import online.hktaketaxi.driverapp.MainActivity
import online.hktaketaxi.driverapp.R

class IncomingOrderWindowModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "IncomingOrderWindow"

  @ReactMethod
  fun activateIncomingOrderDisplay() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(true)
        activity.setTurnScreenOn(true)
      }
      activity.window.addFlags(
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
  }

  @ReactMethod
  fun deactivateIncomingOrderDisplay() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(false)
        activity.setTurnScreenOn(false)
      }
      activity.window.clearFlags(
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
  }

  /** 背景有新柯打：Full-screen intent 喚醒接單主畫面（Android 10+ 需允許全屏通知） */
  @ReactMethod
  fun postFullScreenNewOrderAlert(orderId: String, title: String, body: String) {
    val context = reactApplicationContext.applicationContext
    val channelId = "taxima_driver_new_orders"
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel =
        NotificationChannel(channelId, "新柯打", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "附近新柯打全屏提醒"
          lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
      nm.createNotificationChannel(channel)
    }

    val launch =
      Intent(context, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        putExtra("taxima_focus_order_id", orderId)
      }
    val pendingFlags =
      PendingIntent.FLAG_UPDATE_CURRENT or
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    val fullScreenPending = PendingIntent.getActivity(context, orderId.hashCode(), launch, pendingFlags)
    val contentPending = PendingIntent.getActivity(context, orderId.hashCode() + 1, launch, pendingFlags)

    val notification =
      NotificationCompat.Builder(context, channelId)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title.ifBlank { "新柯打" })
        .setContentText(body.ifBlank { "點擊查看" })
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setAutoCancel(true)
        .setContentIntent(contentPending)
        .setFullScreenIntent(fullScreenPending, true)
        .build()

    nm.notify(orderId.hashCode(), notification)
  }

  @ReactMethod
  fun consumeLaunchOrderId(promise: Promise) {
    val id = IncomingOrderLaunch.pendingOrderId
    IncomingOrderLaunch.pendingOrderId = null
    promise.resolve(id)
  }

  @ReactMethod
  fun bringMainActivityToFront(orderId: String?) {
    val context = reactApplicationContext.applicationContext
    val launch =
      Intent(context, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (!orderId.isNullOrBlank()) putExtra("taxima_focus_order_id", orderId)
      }
    context.startActivity(launch)
  }
}
