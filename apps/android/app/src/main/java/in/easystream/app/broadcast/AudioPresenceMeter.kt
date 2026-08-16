package in.easystream.app.broadcast

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlin.math.abs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Listens for usable microphone levels. Camera frames are previewed with CameraX.
 * When a managed provider (Mux) returns an RTMP ingest URL, wire a publisher here
 * at 1080p / 30fps with automatic bitrate fallback.
 */
class AudioPresenceMeter(private val onAudio: (Boolean) -> Unit) {
    private var job: Job? = null

    fun start() {
        job?.cancel()
        job = CoroutineScope(Dispatchers.Default).launch {
            val min = AudioRecord.getMinBufferSize(
                16_000,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
            )
            val recorder = try {
                AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    16_000,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    min,
                )
            } catch (_: SecurityException) {
                onAudio(true)
                return@launch
            }
            if (recorder.state != AudioRecord.STATE_INITIALIZED) {
                onAudio(true)
                return@launch
            }
            val buf = ShortArray(min.coerceAtLeast(256))
            recorder.startRecording()
            while (isActive) {
                val n = recorder.read(buf, 0, buf.size)
                val peak = (0 until n.coerceAtLeast(0)).maxOfOrNull { abs(buf[it].toInt()) } ?: 0
                onAudio(peak > 200)
                delay(800)
            }
            recorder.stop()
            recorder.release()
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }
}
