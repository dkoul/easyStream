package in.easystream.app.data

import in.easystream.app.BuildConfig
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import java.util.concurrent.TimeUnit

interface EasyStreamApi {
    @POST("auth/otp/request")
    suspend fun requestOtp(@Body body: OtpRequest)

    @POST("auth/otp/verify")
    suspend fun verifyOtp(@Body body: OtpVerify): TokenResponse

    @POST("events")
    suspend fun createEvent(
        @Header("Authorization") auth: String,
        @Body body: EventCreateRequest,
    ): EventEnvelope

    @POST("events/{id}/go-live")
    suspend fun goLive(
        @Header("Authorization") auth: String,
        @Path("id") id: String,
    ): EventEnvelope

    @POST("events/{id}/end")
    suspend fun endLive(
        @Header("Authorization") auth: String,
        @Path("id") id: String,
    ): EventEnvelope

    @GET("events/{id}")
    suspend fun getEvent(
        @Header("Authorization") auth: String,
        @Path("id") id: String,
    ): EventEnvelope
}

fun createApi(): EasyStreamApi {
    val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    return Retrofit.Builder()
        .baseUrl(BuildConfig.API_URL.trimEnd('/') + "/")
        .client(client)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()
        .create(EasyStreamApi::class.java)
}
