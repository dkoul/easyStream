package in.easystream.app.ui

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun EasyStreamRoot(vm: EasyStreamViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { }

    LaunchedEffect(state.screen) {
        if (state.screen == Screen.Broadcast || state.screen == Screen.Ready) {
            permissionLauncher.launch(
                arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
            )
        }
    }

    when (state.screen) {
        Screen.Welcome -> ScreenScaffold {
            Text("easyStream", color = Muted, fontSize = 14.sp)
            Spacer(Modifier.height(12.dp))
            Title("Share your family moments with everyone.")
            Spacer(Modifier.height(16.dp))
            Note("Create an event, press Start Live, and send a WhatsApp link. Relatives watch without installing anything.")
            Spacer(Modifier.height(28.dp))
            PrimaryButton("Create an Event") { vm.go(Screen.Phone) }
        }

        Screen.Phone -> ScreenScaffold {
            Title("Your phone number")
            Spacer(Modifier.height(8.dp))
            Note("We will send a one-time code. No password to remember.")
            Spacer(Modifier.height(16.dp))
            Field("Mobile number", state.phone, androidx.compose.ui.text.input.KeyboardType.Phone, vm::setPhone)
            ErrorText(state.error)
            PrimaryButton("Send code", enabled = !state.busy) { vm.requestOtp() }
        }

        Screen.Otp -> ScreenScaffold {
            Title("Enter the 6-digit code")
            Spacer(Modifier.height(8.dp))
            Note("Check your messages. In demo mode the code is 123456.")
            Field("Code", state.otp, androidx.compose.ui.text.input.KeyboardType.Number, vm::setOtp)
            ErrorText(state.error)
            PrimaryButton("Continue", enabled = !state.busy) { vm.verifyOtp() }
        }

        Screen.ChooseType -> ScreenScaffold {
            Title("Choose Event")
            Spacer(Modifier.height(16.dp))
            listOf(
                "prayer_meet" to "Prayer Meet",
                "family_function" to "Family Function",
                "wedding" to "Wedding",
                "birthday" to "Birthday",
                "other" to "Other",
            ).forEach { (id, label) ->
                Choice(label) { vm.setType(id, label) }
            }
        }

        Screen.Details -> DetailsScreen(state, vm)

        Screen.Design -> ScreenScaffold {
            Title("Choose design")
            Spacer(Modifier.height(12.dp))
            listOf("classic" to "Classic", "elegant" to "Elegant", "traditional" to "Traditional").forEach { (id, label) ->
                Choice(label, selected = state.template == id) { vm.setTemplate(id) }
            }
            PrimaryButton("Preview") { vm.go(Screen.Preview) }
        }

        Screen.Preview -> ScreenScaffold {
            Title("This is what relatives will see")
            Spacer(Modifier.height(12.dp))
            Note("${state.title}\n${state.personName}\n${state.date} · ${state.location}")
            Spacer(Modifier.height(8.dp))
            Note("Design: ${state.template.replaceFirstChar { it.uppercase() }}")
            ErrorText(state.error)
            Spacer(Modifier.height(16.dp))
            SecondaryButton("Edit") { vm.go(Screen.Details) }
            Spacer(Modifier.height(10.dp))
            PrimaryButton("Create Event", enabled = !state.busy) { vm.createEvent() }
        }

        Screen.Ready -> ScreenScaffold {
            Title("Your event is ready.")
            Spacer(Modifier.height(8.dp))
            Note("🔒 Anyone with this link can watch.")
            Spacer(Modifier.height(8.dp))
            Note(state.shareUrl.orEmpty())
            Spacer(Modifier.height(16.dp))
            CameraPreview(state.useFrontCamera)
            Spacer(Modifier.height(8.dp))
            SecondaryButton(if (state.useFrontCamera) "Use rear camera" else "Use front camera") { vm.flipCamera() }
            HealthRow(state.health)
            ErrorText(state.error)
            PrimaryButton("🔴 START LIVE", enabled = !state.busy) { vm.startLive() }
        }

        Screen.Broadcast -> ScreenScaffold {
            Text("🔴 LIVE", color = LiveRed, fontSize = 28.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Title(formatDuration(state.elapsedSeconds))
            Note("👁 ${state.event?.viewerCount ?: 0} watching")
            Spacer(Modifier.height(12.dp))
            CameraPreview(state.useFrontCamera)
            HealthRow(state.health)
            if (!state.health.networkOk) {
                Note("We're trying to reconnect. Keep the phone where it is.")
            }
            Spacer(Modifier.height(8.dp))
            PrimaryButton("Share with family") {
                val intent = Intent.createChooser(vm.shareIntent(context), "Share with family")
                context.startActivity(intent)
            }
            Spacer(Modifier.height(10.dp))
            SecondaryButton("STOP LIVE") { vm.confirmEnd() }
        }

        Screen.ConfirmEnd -> ScreenScaffold {
            Title("End livestream?")
            Spacer(Modifier.height(12.dp))
            Note("Relatives will no longer see the live video. A recording will be prepared on the same link.")
            Spacer(Modifier.height(20.dp))
            PrimaryButton("End Live", enabled = !state.busy) { vm.endLive() }
            Spacer(Modifier.height(10.dp))
            SecondaryButton("Keep streaming") { vm.keepLive() }
        }

        Screen.Ended -> ScreenScaffold {
            Title("Your livestream has ended.")
            Spacer(Modifier.height(12.dp))
            Note("The recording will appear on the same family link in a moment.")
            Spacer(Modifier.height(20.dp))
            PrimaryButton("Share Recording") {
                context.startActivity(Intent.createChooser(vm.shareIntent(context), "Share recording"))
            }
            Spacer(Modifier.height(10.dp))
            SecondaryButton("Done") { vm.done() }
        }
    }
}

@Composable
private fun DetailsScreen(state: UiState, vm: EasyStreamViewModel) {
    val context = LocalContext.current
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@rememberLauncherForActivityResult
        val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        vm.setPhoto("data:image/jpeg;base64,$b64")
    }
    ScreenScaffold {
        Title("Event details")
        Field("Event name", state.title, onChange = vm::setTitle)
        Field("Person's name (optional)", state.personName, onChange = vm::setPerson)
        Field("Date", state.date, onChange = vm::setDate)
        Field("Location", state.location, onChange = vm::setLocation)
        Field("Short message (optional)", state.message, onChange = vm::setMessage)
        SecondaryButton(if (state.photoDataUrl != null) "Change photograph" else "Add photograph") {
            photoPicker.launch("image/*")
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton("Choose design") { vm.go(Screen.Design) }
    }
}

@Composable
private fun ErrorText(error: String?) {
    if (error != null) {
        Spacer(Modifier.height(8.dp))
        Note(error)
        Spacer(Modifier.height(8.dp))
    }
}
