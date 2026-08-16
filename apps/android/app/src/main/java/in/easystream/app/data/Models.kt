package in.easystream.app.data

data class User(val id: String, val name: String?, val phone: String)
data class TokenResponse(val token: String, val user: User)
data class OtpRequest(val phone: String)
data class OtpVerify(val phone: String, val code: String, val name: String? = null)
data class EventCreateRequest(
    val type: String,
    val title: String,
    val personName: String?,
    val date: String,
    val location: String,
    val message: String?,
    val template: String,
    val photoDataUrl: String?,
)

data class EventRecord(
    val id: String,
    val slug: String,
    val type: String,
    val title: String,
    val personName: String?,
    val photoUrl: String?,
    val date: String,
    val location: String,
    val message: String?,
    val template: String,
    val status: String,
    val ingestUrl: String?,
    val streamKey: String?,
    val playbackUrl: String?,
    val viewerCount: Int = 0,
)

data class EventEnvelope(
    val event: EventRecord,
    val shareUrl: String? = null,
    val shareText: String? = null,
)
