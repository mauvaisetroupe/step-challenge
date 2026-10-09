package lu.architech.stepchallenge.stepsync

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * What the background worker needs (API address, session token) and the
 * history of its runs, in the app's private preferences (ADR 0009).
 *
 * The token is encrypted with an AES-GCM key kept in the Android
 * Keystore (not exportable): the same protection as expo-secure-store,
 * without depending on its internal format. It is never logged.
 */
internal class SyncStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveConfig(apiUrl: String, token: String) {
    prefs.edit()
      .putString(KEY_API_URL, apiUrl)
      .putString(KEY_TOKEN, encrypt(token))
      .apply()
  }

  fun apiUrl(): String? = prefs.getString(KEY_API_URL, null)

  /** Null when signed out, or when the token cannot be decrypted. */
  fun token(): String? =
    prefs.getString(KEY_TOKEN, null)?.let { runCatching { decrypt(it) }.getOrNull() }

  fun clear() {
    prefs.edit().remove(KEY_API_URL).remove(KEY_TOKEN).apply()
  }

  /** Adds a run at the top of the history, which keeps the last ten. */
  fun addRun(run: JSONObject) {
    val previous = JSONArray(historyJson())
    val history = JSONArray().put(run)

    for (index in 0 until minOf(previous.length(), MAX_HISTORY - 1)) {
      history.put(previous.get(index))
    }

    prefs.edit().putString(KEY_HISTORY, history.toString()).apply()
  }

  fun historyJson(): String = prefs.getString(KEY_HISTORY, null) ?: "[]"

  /** Interval of the last schedule, to schedule again at sign-in. */
  fun saveIntervalMinutes(minutes: Long) {
    prefs.edit().putLong(KEY_INTERVAL, minutes).apply()
  }

  fun intervalMinutes(): Long? =
    prefs.getLong(KEY_INTERVAL, 0L).takeIf { it > 0 }

  /** Sleep hours of Settings → Activity (src/services/sleepHours.ts). */
  fun saveSleepHours(hours: ActivityCalculator.SleepHours) {
    prefs.edit().putInt(KEY_SLEEP_BED, hours.bed).putInt(KEY_SLEEP_WAKE, hours.wake).apply()
  }

  /** The default ones (23:00 → 06:00) until the app gives them. */
  fun sleepHours() = ActivityCalculator.SleepHours(
    bed = prefs.getInt(KEY_SLEEP_BED, ActivityCalculator.DEFAULT_SLEEP_HOURS.bed),
    wake = prefs.getInt(KEY_SLEEP_WAKE, ActivityCalculator.DEFAULT_SLEEP_HOURS.wake),
  )

  private fun key(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .build(),
    )

    return generator.generateKey()
  }

  /** "base64(iv):base64(ciphertext)". */
  private fun encrypt(value: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key())

    val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))

    return encode(cipher.iv) + ":" + encode(ciphertext)
  }

  private fun decrypt(stored: String): String {
    val (iv, ciphertext) = stored.split(":", limit = 2)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, decode(iv)))

    return String(cipher.doFinal(decode(ciphertext)), Charsets.UTF_8)
  }

  private fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)

  private fun decode(text: String) = Base64.decode(text, Base64.NO_WRAP)

  private companion object {
    const val PREFS = "step-challenge-background-sync"
    const val KEY_API_URL = "apiUrl"
    const val KEY_TOKEN = "token"
    const val KEY_HISTORY = "history"
    const val KEY_INTERVAL = "intervalMinutes"
    const val KEY_SLEEP_BED = "sleepBed"
    const val KEY_SLEEP_WAKE = "sleepWake"
    const val MAX_HISTORY = 10
    const val KEYSTORE = "AndroidKeyStore"
    const val KEY_ALIAS = "step-challenge-background-sync"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
  }
}
