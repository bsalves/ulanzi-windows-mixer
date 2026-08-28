#include "audio_engine.h"

#include "com_utils.hpp"
#include "logger.hpp"
#include "process_info.h"

#include <algorithm>
#include <atomic>
#include <map>
#include <utility>
#include <audiopolicy.h>
#include <endpointvolume.h>
#include <functiondiscoverykeys_devpkey.h>
#include <mmdeviceapi.h>
#include <objbase.h>
#include <mutex>
#include <thread>
#include <vector>

using namespace std;

namespace {

double clamp01(double value) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

double apply_delta(double current, double delta) {
    int percent = static_cast<int>(current * 100.0 + 0.5);
    int step = static_cast<int>(abs(delta) * 100.0 + 0.5);
    if (step <= 0) step = 2;
    percent += (delta >= 0 ? step : -step);
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    return percent / 100.0;
}

string lower_exe(const string& value) {
    return to_lower_ascii(filename_of(value));
}

Json volume_json(const VolumeState& state) {
    Json json = Json::object();
    json["volume"] = state.volume;
    json["muted"] = state.muted;
    return json;
}

Json session_json(const SessionInfo& session) {
    Json json = Json::object();
    json["sessionId"] = session.sessionId;
    json["pid"] = static_cast<int>(session.pid);
    json["executable"] = session.executable;
    json["displayName"] = session.displayName;
    json["volume"] = session.volume;
    json["muted"] = session.muted;
    return json;
}

class VolumeCallback;
class SessionNotification;
class DeviceNotification;
class SessionEvents;

}  // namespace

struct AudioEngine::Impl {
    std::recursive_mutex mtx;
    EventFn sink;
    atomic<bool> running{false};
    thread refresh_thread;

    ComPtr<IMMDeviceEnumerator> enumerator;
    ComPtr<IMMDevice> device;
    ComPtr<IAudioEndpointVolume> master;
    ComPtr<IAudioSessionManager2> sessions;
    VolumeCallback* volume_cb = nullptr;
    SessionNotification* session_cb = nullptr;
    DeviceNotification* device_cb = nullptr;
    vector<pair<ComPtr<IAudioSessionControl>, SessionEvents*>> session_events;
    map<string, VolumeState> last_known;
    AudioEngine* owner = nullptr;

    VolumeState read_master();
    vector<SessionInfo> read_sessions();
    bool bind_default_device();
    void unbind_sessions();
    void emit(const string& event, const Json& data);
    vector<SessionInfo> match_app(const Json& query);
    Json app_state(const Json& query, const vector<SessionInfo>& matched);
    HRESULT apply_app_volume(const vector<SessionInfo>& matched, double volume, bool set_volume, bool set_mute, bool muted);
};

namespace {

class VolumeCallback : public IAudioEndpointVolumeCallback {
public:
    explicit VolumeCallback(AudioEngine* owner) : owner_(owner), ref_(1) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** pp) override {
        if (!pp) return E_POINTER;
        if (riid == IID_IUnknown || riid == __uuidof(IAudioEndpointVolumeCallback)) {
            *pp = static_cast<IAudioEndpointVolumeCallback*>(this);
            AddRef();
            return S_OK;
        }
        *pp = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return InterlockedIncrement(&ref_); }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG v = InterlockedDecrement(&ref_);
        if (!v) delete this;
        return v;
    }
    HRESULT STDMETHODCALLTYPE OnNotify(PAUDIO_VOLUME_NOTIFICATION_DATA) override {
        if (owner_) owner_->on_master_changed();
        return S_OK;
    }

private:
    AudioEngine* owner_;
    LONG ref_;
};

class SessionNotification : public IAudioSessionNotification {
public:
    explicit SessionNotification(AudioEngine* owner) : owner_(owner), ref_(1) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** pp) override {
        if (!pp) return E_POINTER;
        if (riid == IID_IUnknown || riid == __uuidof(IAudioSessionNotification)) {
            *pp = static_cast<IAudioSessionNotification*>(this);
            AddRef();
            return S_OK;
        }
        *pp = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return InterlockedIncrement(&ref_); }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG v = InterlockedDecrement(&ref_);
        if (!v) delete this;
        return v;
    }
    HRESULT STDMETHODCALLTYPE OnSessionCreated(IAudioSessionControl*) override {
        if (owner_) owner_->on_sessions_changed();
        return S_OK;
    }

private:
    AudioEngine* owner_;
    LONG ref_;
};

class DeviceNotification : public IMMNotificationClient {
public:
    explicit DeviceNotification(AudioEngine* owner) : owner_(owner), ref_(1) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** pp) override {
        if (!pp) return E_POINTER;
        if (riid == IID_IUnknown || riid == __uuidof(IMMNotificationClient)) {
            *pp = static_cast<IMMNotificationClient*>(this);
            AddRef();
            return S_OK;
        }
        *pp = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return InterlockedIncrement(&ref_); }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG v = InterlockedDecrement(&ref_);
        if (!v) delete this;
        return v;
    }
    HRESULT STDMETHODCALLTYPE OnDeviceStateChanged(LPCWSTR, DWORD) override {
        if (owner_) owner_->on_device_changed();
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE OnDeviceAdded(LPCWSTR) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnDeviceRemoved(LPCWSTR) override {
        if (owner_) owner_->on_device_changed();
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE OnDefaultDeviceChanged(EDataFlow flow, ERole, LPCWSTR) override {
        if (flow == eRender && owner_) owner_->on_device_changed();
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE OnPropertyValueChanged(LPCWSTR, const PROPERTYKEY) override { return S_OK; }

private:
    AudioEngine* owner_;
    LONG ref_;
};

class SessionEvents : public IAudioSessionEvents {
public:
    explicit SessionEvents(AudioEngine* owner) : owner_(owner), ref_(1) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** pp) override {
        if (!pp) return E_POINTER;
        if (riid == IID_IUnknown || riid == __uuidof(IAudioSessionEvents)) {
            *pp = static_cast<IAudioSessionEvents*>(this);
            AddRef();
            return S_OK;
        }
        *pp = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return InterlockedIncrement(&ref_); }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG v = InterlockedDecrement(&ref_);
        if (!v) delete this;
        return v;
    }
    HRESULT STDMETHODCALLTYPE OnDisplayNameChanged(LPCWSTR, LPCGUID) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnIconPathChanged(LPCWSTR, LPCGUID) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnSimpleVolumeChanged(float, BOOL, LPCGUID) override {
        if (owner_) owner_->on_sessions_changed();
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE OnChannelVolumeChanged(DWORD, float*, DWORD, LPCGUID) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnGroupingParamChanged(LPCGUID, LPCGUID) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnStateChanged(AudioSessionState) override {
        if (owner_) owner_->on_sessions_changed();
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE OnSessionDisconnected(AudioSessionDisconnectReason) override {
        if (owner_) owner_->on_sessions_changed();
        return S_OK;
    }

private:
    AudioEngine* owner_;
    LONG ref_;
};

}  // namespace

AudioEngine::AudioEngine() : impl_(new Impl()) {
    impl_->owner = this;
}

AudioEngine::~AudioEngine() {
    stop();
    delete impl_;
}

bool AudioEngine::start() {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                  __uuidof(IMMDeviceEnumerator), reinterpret_cast<void**>(impl_->enumerator.put()));
    if (FAILED(hr) || !impl_->enumerator) {
        LOG_ERROR("Windows Audio Service unavailable (%08lx)", hr);
        return false;
    }
    impl_->device_cb = new DeviceNotification(this);
    impl_->enumerator->RegisterEndpointNotificationCallback(impl_->device_cb);
    if (!impl_->bind_default_device()) return false;
    impl_->running = true;
    impl_->refresh_thread = thread([this]() {
        while (impl_->running) {
            for (int i = 0; i < 20 && impl_->running; ++i) Sleep(100);
            if (impl_->running) on_sessions_changed();
        }
    });
    LOG_INFO("Audio helper started");
    return true;
}

void AudioEngine::stop() {
    impl_->running = false;
    if (impl_->refresh_thread.joinable()) impl_->refresh_thread.join();
    lock_guard<recursive_mutex> lock(impl_->mtx);
    impl_->unbind_sessions();
    if (impl_->master && impl_->volume_cb) impl_->master->UnregisterControlChangeNotify(impl_->volume_cb);
    if (impl_->sessions && impl_->session_cb) impl_->sessions->UnregisterSessionNotification(impl_->session_cb);
    if (impl_->enumerator && impl_->device_cb) impl_->enumerator->UnregisterEndpointNotificationCallback(impl_->device_cb);
    if (impl_->volume_cb) {
        impl_->volume_cb->Release();
        impl_->volume_cb = nullptr;
    }
    if (impl_->session_cb) {
        impl_->session_cb->Release();
        impl_->session_cb = nullptr;
    }
    if (impl_->device_cb) {
        impl_->device_cb->Release();
        impl_->device_cb = nullptr;
    }
    impl_->master.reset();
    impl_->sessions.reset();
    impl_->device.reset();
    impl_->enumerator.reset();
}

void AudioEngine::set_event_sink(EventFn fn) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    impl_->sink = std::move(fn);
}

void AudioEngine::on_sessions_changed() {
    Json data;
    {
        lock_guard<recursive_mutex> lock(impl_->mtx);
        data = list_sessions();
    }
    impl_->emit("sessionsChanged", data);
}

void AudioEngine::on_master_changed() {
    Json data;
    {
        lock_guard<recursive_mutex> lock(impl_->mtx);
        data = get_master();
    }
    impl_->emit("masterChanged", data);
}

void AudioEngine::on_device_changed() {
    {
        lock_guard<recursive_mutex> lock(impl_->mtx);
        impl_->bind_default_device();
    }
    on_master_changed();
    on_sessions_changed();
}

Json AudioEngine::list_sessions() {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    Json root = Json::object();
    Json arr = Json::array();
    auto sessions = impl_->read_sessions();
    for (const auto& session : sessions) {
        arr.push_back(session_json(session));
        LOG_DEBUG("Found audio session: %s pid=%u volume=%.2f mute=%s",
                  session.executable.c_str(), session.pid, session.volume, session.muted ? "true" : "false");
    }
    root["sessions"] = arr;
    return root;
}

Json AudioEngine::list_devices(const std::string& flow) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    Json root = Json::object();
    Json arr = Json::array();
    if (!impl_->enumerator) {
        root["devices"] = arr;
        return root;
    }
    EDataFlow dataFlow = flow == "capture" ? eCapture : eRender;
    ComPtr<IMMDeviceCollection> collection;
    if (FAILED(impl_->enumerator->EnumAudioEndpoints(dataFlow, DEVICE_STATE_ACTIVE, collection.put()))) {
        root["devices"] = arr;
        return root;
    }
    LPWSTR defaultId = nullptr;
    ComPtr<IMMDevice> def;
    if (SUCCEEDED(impl_->enumerator->GetDefaultAudioEndpoint(dataFlow, eMultimedia, def.put())) && def) {
        def->GetId(&defaultId);
    }
    UINT count = 0;
    collection->GetCount(&count);
    for (UINT i = 0; i < count; ++i) {
        ComPtr<IMMDevice> item;
        if (FAILED(collection->Item(i, item.put())) || !item) continue;
        LPWSTR id = nullptr;
        item->GetId(&id);
        ComPtr<IPropertyStore> props;
        std::string name;
        if (SUCCEEDED(item->OpenPropertyStore(STGM_READ, props.put())) && props) {
            PROPVARIANT var;
            PropVariantInit(&var);
            if (SUCCEEDED(props->GetValue(PKEY_Device_FriendlyName, &var)) && var.vt == VT_LPWSTR) {
                name = wide_to_utf8(var.pwszVal);
            }
            PropVariantClear(&var);
        }
        Json device = Json::object();
        device["id"] = id ? wide_to_utf8(id) : "";
        device["name"] = name;
        device["flow"] = flow == "capture" ? "capture" : "render";
        device["isDefault"] = defaultId && id && wcscmp(defaultId, id) == 0;
        arr.push_back(device);
        if (id) CoTaskMemFree(id);
    }
    if (defaultId) CoTaskMemFree(defaultId);
    root["devices"] = arr;
    return root;
}

Json AudioEngine::get_master() {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    return volume_json(impl_->read_master());
}

Json AudioEngine::set_master_volume(double volume) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    volume = clamp01(volume);
    if (impl_->master) {
        impl_->master->SetMasterVolumeLevelScalar(static_cast<float>(volume), nullptr);
        if (volume > 0) impl_->master->SetMute(FALSE, nullptr);
        LOG_INFO("Setting master volume: %.0f%%", volume * 100.0);
    }
    return get_master();
}

Json AudioEngine::set_master_mute(bool muted) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    if (impl_->master) {
        impl_->master->SetMute(muted ? TRUE : FALSE, nullptr);
        LOG_INFO("Master mute: %s", muted ? "true" : "false");
    }
    return get_master();
}

Json AudioEngine::toggle_master_mute() {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    VolumeState state = impl_->read_master();
    return set_master_mute(!state.muted);
}

Json AudioEngine::adjust_master(double delta) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    VolumeState state = impl_->read_master();
    double next = apply_delta(state.volume, delta);
    if (state.muted && next > 0 && impl_->master) impl_->master->SetMute(FALSE, nullptr);
    return set_master_volume(next);
}

Json AudioEngine::get_app(const Json& query) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    auto matched = impl_->match_app(query);
    return impl_->app_state(query, matched);
}

Json AudioEngine::set_app_volume(const Json& query, double volume) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    volume = clamp01(volume);
    auto matched = impl_->match_app(query);
    impl_->apply_app_volume(matched, volume, true, volume > 0, false);
    string exe = query["executable"].as_string("");
    LOG_INFO("Setting %s volume: %.0f%%", exe.c_str(), volume * 100.0);
    matched = impl_->match_app(query);
    return impl_->app_state(query, matched);
}

Json AudioEngine::set_app_mute(const Json& query, bool muted) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    auto matched = impl_->match_app(query);
    impl_->apply_app_volume(matched, 0, false, true, muted);
    string exe = query["executable"].as_string("");
    LOG_INFO("%s mute: %s", exe.c_str(), muted ? "true" : "false");
    matched = impl_->match_app(query);
    return impl_->app_state(query, matched);
}

Json AudioEngine::toggle_app_mute(const Json& query) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    Json current = get_app(query);
    return set_app_mute(query, !current["muted"].as_bool());
}

Json AudioEngine::adjust_app(const Json& query, double delta) {
    lock_guard<recursive_mutex> lock(impl_->mtx);
    Json current = get_app(query);
    double next = apply_delta(current["volume"].as_number(), delta);
    if (current["muted"].as_bool() && next > 0) set_app_mute(query, false);
    return set_app_volume(query, next);
}

bool AudioEngine::Impl::bind_default_device() {
    unbind_sessions();
    if (master && volume_cb) master->UnregisterControlChangeNotify(volume_cb);
    if (sessions && session_cb) sessions->UnregisterSessionNotification(session_cb);
    master.reset();
    sessions.reset();
    device.reset();
    if (!enumerator) return false;
    HRESULT hr = enumerator->GetDefaultAudioEndpoint(eRender, eMultimedia, device.put());
    if (FAILED(hr) || !device) {
        LOG_ERROR("Default render device unavailable (%08lx)", hr);
        return false;
    }
    hr = device->Activate(__uuidof(IAudioEndpointVolume), CLSCTX_ALL, nullptr, reinterpret_cast<void**>(master.put()));
    if (FAILED(hr)) {
        LOG_ERROR("IAudioEndpointVolume activate failed (%08lx)", hr);
        return false;
    }
    hr = device->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr, reinterpret_cast<void**>(sessions.put()));
    if (FAILED(hr)) {
        LOG_ERROR("IAudioSessionManager2 activate failed (%08lx)", hr);
        return false;
    }
    if (!volume_cb) volume_cb = new VolumeCallback(owner);
    master->RegisterControlChangeNotify(volume_cb);
    if (!session_cb) session_cb = new SessionNotification(owner);
    sessions->RegisterSessionNotification(session_cb);
    return true;
}

void AudioEngine::Impl::unbind_sessions() {
    for (auto& entry : session_events) {
        if (entry.first && entry.second) entry.first->UnregisterAudioSessionNotification(entry.second);
        if (entry.second) entry.second->Release();
    }
    session_events.clear();
}

VolumeState AudioEngine::Impl::read_master() {
    VolumeState state;
    if (!master) return state;
    float volume = 0;
    BOOL muted = FALSE;
    master->GetMasterVolumeLevelScalar(&volume);
    master->GetMute(&muted);
    state.volume = volume;
    state.muted = muted == TRUE;
    return state;
}

vector<SessionInfo> AudioEngine::Impl::read_sessions() {
    vector<SessionInfo> result;
    unbind_sessions();
    if (!sessions) return result;
    ComPtr<IAudioSessionEnumerator> enumerator;
    if (FAILED(sessions->GetSessionEnumerator(enumerator.put())) || !enumerator) return result;
    int count = 0;
    enumerator->GetCount(&count);
    for (int i = 0; i < count; ++i) {
        ComPtr<IAudioSessionControl> control;
        if (FAILED(enumerator->GetSession(i, control.put())) || !control) continue;
        ComPtr<IAudioSessionControl2> control2;
        if (FAILED(control->QueryInterface(__uuidof(IAudioSessionControl2), reinterpret_cast<void**>(control2.put())))) {
            continue;
        }
        if (SUCCEEDED(control2->IsSystemSoundsSession()) && control2->IsSystemSoundsSession() == S_OK) {
            // Keep system sounds as a controllable session.
        }
        DWORD pid = 0;
        control2->GetProcessId(&pid);
        LPWSTR sessionId = nullptr;
        control2->GetSessionIdentifier(&sessionId);
        LPWSTR display = nullptr;
        control->GetDisplayName(&display);
        ComPtr<ISimpleAudioVolume> volumeCtl;
        float volume = 0;
        BOOL muted = FALSE;
        if (SUCCEEDED(control->QueryInterface(__uuidof(ISimpleAudioVolume), reinterpret_cast<void**>(volumeCtl.put()))) && volumeCtl) {
            volumeCtl->GetMasterVolume(&volume);
            volumeCtl->GetMute(&muted);
        }
        ProcessInfo proc = get_process_info(pid);
        string displayName = resolve_display_name(display);
        if (displayName.empty() || displayName[0] == '@') displayName = proc.displayName;
        SessionInfo info;
        info.sessionId = sessionId ? wide_to_utf8(sessionId) : "";
        info.pid = pid;
        info.executable = proc.executable;
        info.displayName = displayName.empty() ? proc.executable : displayName;
        info.volume = volume;
        info.muted = muted == TRUE;
        if (!info.executable.empty()) {
            last_known[lower_exe(info.executable)] = VolumeState{info.volume, info.muted};
            LOG_DEBUG("Found audio session: %s", info.executable.c_str());
        }
        result.push_back(info);
        auto* events = new SessionEvents(owner);
        control->RegisterAudioSessionNotification(events);
        session_events.push_back({std::move(control), events});
        if (sessionId) CoTaskMemFree(sessionId);
        if (display) CoTaskMemFree(display);
    }
    return result;
}

vector<SessionInfo> AudioEngine::Impl::match_app(const Json& query) {
    auto sessions = read_sessions();
    string exe = lower_exe(query["executable"].as_string(""));
    unsigned pid = static_cast<unsigned>(query["pid"].as_int(0));
    string sessionId = query["sessionId"].as_string("");
    string mode = query["sessionMode"].as_string("all");
    vector<SessionInfo> byPid;
    vector<SessionInfo> byExe;
    for (const auto& session : sessions) {
        if (lower_exe(session.executable) != exe) continue;
        byExe.push_back(session);
        if (pid && session.pid == pid) byPid.push_back(session);
    }
    vector<SessionInfo> matched = !byPid.empty() ? byPid : byExe;
    if (!sessionId.empty()) {
        vector<SessionInfo> bySession;
        for (const auto& session : matched) {
            if (session.sessionId == sessionId) bySession.push_back(session);
        }
        if (!bySession.empty()) matched = bySession;
    }
    sort(matched.begin(), matched.end(), [](const SessionInfo& a, const SessionInfo& b) {
        if (a.pid != b.pid) return a.pid < b.pid;
        return a.sessionId < b.sessionId;
    });
    if (mode == "first" && !matched.empty()) matched = {matched.front()};
    return matched;
}

Json AudioEngine::Impl::app_state(const Json& query, const vector<SessionInfo>& matched) {
    Json json = Json::object();
    string exe = query["executable"].as_string("");
    string display = query["displayName"].as_string("");
    json["executable"] = exe;
    json["displayName"] = display.empty() ? exe : display;
    json["sessionCount"] = static_cast<int>(matched.size());
    if (matched.empty()) {
        auto it = last_known.find(lower_exe(exe));
        json["waiting"] = true;
        json["volume"] = it == last_known.end() ? 0 : it->second.volume;
        json["muted"] = it == last_known.end() ? false : it->second.muted;
        return json;
    }
    double volume = 0;
    bool muted = true;
    for (const auto& session : matched) {
        volume = max(volume, session.volume);
        if (!session.muted) muted = false;
    }
    json["waiting"] = false;
    json["volume"] = volume;
    json["muted"] = muted;
    json["pid"] = static_cast<int>(matched.front().pid);
    json["sessionId"] = matched.front().sessionId;
    json["displayName"] = display.empty() ? matched.front().displayName : display;
    json["executable"] = matched.front().executable;
    last_known[lower_exe(matched.front().executable)] = VolumeState{volume, muted};
    return json;
}

HRESULT AudioEngine::Impl::apply_app_volume(const vector<SessionInfo>& matched, double volume, bool set_volume, bool set_mute, bool muted) {
    if (!sessions) return E_FAIL;
    ComPtr<IAudioSessionEnumerator> enumerator;
    if (FAILED(sessions->GetSessionEnumerator(enumerator.put())) || !enumerator) return E_FAIL;
    int count = 0;
    enumerator->GetCount(&count);
    for (int i = 0; i < count; ++i) {
        ComPtr<IAudioSessionControl> control;
        if (FAILED(enumerator->GetSession(i, control.put())) || !control) continue;
        ComPtr<IAudioSessionControl2> control2;
        if (FAILED(control->QueryInterface(__uuidof(IAudioSessionControl2), reinterpret_cast<void**>(control2.put())))) continue;
        LPWSTR sessionId = nullptr;
        control2->GetSessionIdentifier(&sessionId);
        string id = sessionId ? wide_to_utf8(sessionId) : "";
        if (sessionId) CoTaskMemFree(sessionId);
        bool hit = false;
        for (const auto& session : matched) {
            if (session.sessionId == id) {
                hit = true;
                break;
            }
        }
        if (!hit) continue;
        ComPtr<ISimpleAudioVolume> volumeCtl;
        if (FAILED(control->QueryInterface(__uuidof(ISimpleAudioVolume), reinterpret_cast<void**>(volumeCtl.put()))) || !volumeCtl) {
            continue;
        }
        if (set_volume) volumeCtl->SetMasterVolume(static_cast<float>(volume), nullptr);
        if (set_mute) volumeCtl->SetMute(muted ? TRUE : FALSE, nullptr);
    }
    return S_OK;
}

void AudioEngine::Impl::emit(const string& event, const Json& data) {
    EventFn copy;
    {
        lock_guard<recursive_mutex> lock(mtx);
        copy = sink;
    }
    if (!copy) return;
    copy(event, data);
}
