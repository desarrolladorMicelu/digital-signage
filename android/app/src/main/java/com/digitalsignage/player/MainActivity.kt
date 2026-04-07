package com.digitalsignage.player

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.EditText
import android.widget.TextView

class MainActivity : Activity() {

    // ===== CONFIGURAR ESTOS VALORES =====
    private val PLAYER_BASE_URL = "http://20.81.42.176:5174"
    //private val PLAYER_BASE_URL = "http://192.168.0.11:5174"
    // Cada cuántos segundos reintenta si no hay red
    private val RETRY_INTERVAL_MS = 5000L
    // =====================================
    private val PREFS_NAME = "digital_signage_prefs"
    private val PREF_DEVICE_ID = "device_id"

    private lateinit var webView: WebView
    private lateinit var errorLayout: LinearLayout
    private lateinit var statusText: TextView

    private val handler = Handler(Looper.getMainLooper())
    private var hasError = false
    private var isLoading = false

    private val retryRunnable = object : Runnable {
        override fun run() {
            if (hasError) {
                if (isNetworkAvailable()) {
                    statusText.text = "Red disponible — cargando..."
                    loadPlayer()
                } else {
                    statusText.text = "Sin conexión — reintentando en ${RETRY_INTERVAL_MS / 1000}s..."
                    handler.postDelayed(this, RETRY_INTERVAL_MS)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)

        applyImmersive()
        setupViews()
        ensureDeviceConfiguredAndLoad()
    }

    private fun setupViews() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }
        setContentView(root)

        // WebView a pantalla completa
        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        root.addView(webView)

        // Pantalla de error / espera (invisible por defecto)
        errorLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0f172a"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            visibility = View.GONE
        }

        val spinner = ProgressBar(this).apply {
            isIndeterminate = true
            layoutParams = LinearLayout.LayoutParams(80, 80).apply {
                bottomMargin = 32
            }
        }

        val titleText = TextView(this).apply {
            text = "📺 Digital Signage"
            textSize = 24f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 16 }
        }

        statusText = TextView(this).apply {
            text = "Sin conexión — reintentando..."
            textSize = 14f
            setTextColor(Color.parseColor("#94a3b8"))
            gravity = Gravity.CENTER
            setPadding(48, 0, 48, 0)
        }

        errorLayout.addView(spinner)
        errorLayout.addView(titleText)
        errorLayout.addView(statusText)
        root.addView(errorLayout)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            // LOAD_NO_CACHE: evita servir recursos obsoletos; el player maneja su propio caché
            cacheMode = WebSettings.LOAD_NO_CACHE
            allowFileAccess = true
            databaseEnabled = true
            // Necesario para que los blob:// URLs generados por el player funcionen en WebView
            @Suppress("SetJavaScriptEnabled")
            allowUniversalAccessFromFileURLs = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
        }

        // Habilitar reproducción de video en segundo plano y aceleración por hardware
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        webView.webChromeClient = WebChromeClient()

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                isLoading = false
                if (!hasError) {
                    showPlayer()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                // Solo actuar en el recurso principal (la URL del player, no sub-recursos)
                if (request?.isForMainFrame == true) {
                    isLoading = false
                    hasError = true
                    showError("Sin conexión — reintentando en ${RETRY_INTERVAL_MS / 1000}s...")
                    scheduleRetry()
                }
            }

            // Para API < 23
            @Suppress("DEPRECATION")
            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                isLoading = false
                hasError = true
                showError("Sin conexión — reintentando en ${RETRY_INTERVAL_MS / 1000}s...")
                scheduleRetry()
            }
        }
    }

    private fun loadPlayer() {
        val serverUrl = buildServerUrl() ?: return
        hasError = false
        isLoading = true
        handler.removeCallbacks(retryRunnable)
        webView.loadUrl(serverUrl)
        showPlayer()
    }

    private fun ensureDeviceConfiguredAndLoad() {
        val savedDeviceId = getConfiguredDeviceId()
        if (savedDeviceId.isNullOrBlank()) {
            showDeviceConfigDialog()
        } else {
            loadPlayer()
        }
    }

    private fun showDeviceConfigDialog(prefill: String = "") {
        val input = EditText(this).apply {
            hint = "Ej: screen-001"
            setText(prefill)
            inputType = InputType.TYPE_CLASS_TEXT
            isSingleLine = true
            setPadding(40, 20, 40, 20)
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle("Configurar pantalla")
            .setMessage("Ingresa el device_id asignado en el dashboard")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Guardar", null)
            .create()

        dialog.setOnShowListener {
            val button = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            button.setOnClickListener {
                val deviceId = input.text.toString().trim()
                if (deviceId.isBlank()) {
                    input.error = "El device_id es obligatorio"
                    return@setOnClickListener
                }
                saveDeviceId(deviceId)
                dialog.dismiss()
                loadPlayer()
            }
        }
        dialog.show()
    }

    private fun buildServerUrl(): String? {
        val deviceId = getConfiguredDeviceId()
        if (deviceId.isNullOrBlank()) {
            showDeviceConfigDialog()
            return null
        }
        return Uri.parse(PLAYER_BASE_URL).buildUpon()
            .appendQueryParameter("device", deviceId)
            .build()
            .toString()
    }

    private fun getConfiguredDeviceId(): String? {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        return prefs.getString(PREF_DEVICE_ID, null)
    }

    private fun saveDeviceId(deviceId: String) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().putString(PREF_DEVICE_ID, deviceId).apply()
    }

    private fun showPlayer() {
        runOnUiThread {
            webView.visibility = View.VISIBLE
            errorLayout.visibility = View.GONE
        }
    }

    private fun showError(msg: String) {
        runOnUiThread {
            statusText.text = msg
            webView.visibility = View.GONE
            errorLayout.visibility = View.VISIBLE
        }
    }

    private fun scheduleRetry() {
        handler.removeCallbacks(retryRunnable)
        handler.postDelayed(retryRunnable, RETRY_INTERVAL_MS)
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            cm.activeNetworkInfo?.isConnected == true
        }
    }

    private fun applyImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            )
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showDeviceConfigDialog(getConfiguredDeviceId().orEmpty())
            return true
        }
        if (keyCode == KeyEvent.KEYCODE_BACK) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        webView.destroy()
    }
}
