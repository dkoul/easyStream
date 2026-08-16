package in.easystream.app.ui

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.os.BatteryManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import in.easystream.app.broadcast.AudioPresenceMeter
import in.easystream.app.data.EasyStreamApi
import in.easystream.app.data.EventCreateRequest
import in.easystream.app.data.EventRecord
import in.easystream.app.data.OtpRequest
import in.easystream.app.data.OtpVerify
import in.easystream.app.data.createApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class Screen {
    Welcome, Phone, Otp, ChooseType, Details, Design, Preview, Ready, Broadcast, ConfirmEnd, Ended
}

data class BroadcastHealth(
    val networkOk: Boolean = true,
    val batteryPercent: Int = 100,
    val audioDetected: Boolean = true,
)

data class UiState(
    val screen: Screen = Screen.Welcome,
    val phone: String = "",
    val otp: String = "",
    val token: String? = null,
    val type: String = "prayer_meet",
    val title: String = "Prayer Meet",
    val personName: String = "",
    val date: String = "",
    val location: String = "",
    val message: String = "",
    val photoDataUrl: String? = null,
    val template: String = "classic",
    val event: EventRecord? = null,
    val shareUrl: String? = null,
    val shareText: String? = null,
    val error: String? = null,
    val busy: Boolean = false,
    val useFrontCamera: Boolean = false,
    val elapsedSeconds: Long = 0,
    val health: BroadcastHealth = BroadcastHealth(),
    val live: Boolean = false,
)

class EasyStreamViewModel(app: Application) : AndroidViewModel(app) {
    private val api: EasyStreamApi = createApi()
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state
    private val audioMeter = AudioPresenceMeter { ok -> setAudioDetected(ok) }

    fun go(screen: Screen) = _state.update { it.copy(screen = screen, error = null) }

    fun setPhone(v: String) = _state.update { it.copy(phone = v) }
    fun setOtp(v: String) = _state.update { it.copy(otp = v) }
    fun setType(v: String, title: String) = _state.update { it.copy(type = v, title = title, screen = Screen.Details) }
    fun setTitle(v: String) = _state.update { it.copy(title = v) }
    fun setPerson(v: String) = _state.update { it.copy(personName = v) }
    fun setDate(v: String) = _state.update { it.copy(date = v) }
    fun setLocation(v: String) = _state.update { it.copy(location = v) }
    fun setMessage(v: String) = _state.update { it.copy(message = v) }
    fun setPhoto(v: String?) = _state.update { it.copy(photoDataUrl = v) }
    fun setTemplate(v: String) = _state.update { it.copy(template = v) }
    fun flipCamera() = _state.update { it.copy(useFrontCamera = !it.useFrontCamera) }
    fun setAudioDetected(ok: Boolean) = _state.update { it.copy(health = it.health.copy(audioDetected = ok)) }

    fun requestOtp() = launch {
        api.requestOtp(OtpRequest(_state.value.phone))
        go(Screen.Otp)
    }

    fun verifyOtp() = launch {
        val res = api.verifyOtp(OtpVerify(_state.value.phone, _state.value.otp))
        _state.update { it.copy(token = res.token, screen = Screen.ChooseType) }
    }

    fun createEvent() = launch {
        val s = _state.value
        val token = s.token ?: return@launch
        val res = api.createEvent(
            "Bearer $token",
            EventCreateRequest(
                type = s.type,
                title = s.title,
                personName = s.personName.ifBlank { null },
                date = s.date,
                location = s.location,
                message = s.message.ifBlank { null },
                template = s.template,
                photoDataUrl = s.photoDataUrl,
            ),
        )
        _state.update {
            it.copy(event = res.event, shareUrl = res.shareUrl, screen = Screen.Ready)
        }
    }

    fun startLive() = launch {
        val s = _state.value
        val token = s.token ?: return@launch
        val id = s.event?.id ?: return@launch
        val res = api.goLive("Bearer $token", id)
        _state.update {
            it.copy(
                event = res.event,
                shareUrl = res.shareUrl,
                shareText = res.shareText,
                live = true,
                elapsedSeconds = 0,
                screen = Screen.Broadcast,
            )
        }
        audioMeter.start()
        tickWhileLive()
        monitorHealth()
    }

    fun confirmEnd() = go(Screen.ConfirmEnd)

    fun keepLive() = go(Screen.Broadcast)

    fun endLive() = launch {
        val s = _state.value
        val token = s.token ?: return@launch
        val id = s.event?.id ?: return@launch
        audioMeter.stop()
        val res = api.endLive("Bearer $token", id)
        _state.update { it.copy(event = res.event, live = false, screen = Screen.Ended) }
    }

    fun done() = _state.update { UiState(token = it.token, phone = it.phone, screen = Screen.Welcome) }

    fun shareIntent(context: Context): Intent {
        val text = _state.value.shareText ?: _state.value.shareUrl.orEmpty()
        return Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            putExtra("sms_body", text)
            `package` = if (isWhatsAppInstalled(context)) "com.whatsapp" else null
        }
    }

    private fun isWhatsAppInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo("com.whatsapp", 0)
            true
        } catch (_: Exception) {
            try {
                context.packageManager.getPackageInfo("com.whatsapp.w4b", 0)
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    private fun tickWhileLive() = viewModelScope.launch {
        while (_state.value.live) {
            delay(1000)
            _state.update { it.copy(elapsedSeconds = it.elapsedSeconds + 1) }
        }
    }

    private fun monitorHealth() = viewModelScope.launch {
        val app = getApplication<Application>()
        while (_state.value.live) {
            val bm = app.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val net = cm.activeNetwork != null
            _state.update {
                it.copy(health = it.health.copy(batteryPercent = pct, networkOk = net))
            }
            delay(5000)
        }
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(busy = true, error = null) }
            try {
                block()
            } catch (e: Exception) {
                _state.update {
                    it.copy(error = friendlyError(e))
                }
            } finally {
                _state.update { it.copy(busy = false) }
            }
        }
    }

    private fun friendlyError(e: Exception): String {
        val msg = e.message.orEmpty()
        return when {
            msg.contains("Unable to resolve host", true) || msg.contains("Failed to connect", true) ->
                "Your internet connection is weak. Please try again in a moment."
            else -> "Something went wrong. Please try again."
        }
    }

    override fun onCleared() {
        audioMeter.stop()
        super.onCleared()
    }
}

fun formatDuration(seconds: Long): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return "%02d:%02d:%02d".format(h, m, s)
}
