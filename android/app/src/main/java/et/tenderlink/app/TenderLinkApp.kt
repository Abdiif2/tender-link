package et.tenderlink.app

import android.app.Application
import et.tenderlink.app.di.AppContainer

class TenderLinkApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
