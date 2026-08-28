#include "audio_engine.h"
#include "ipc_server.h"
#include "json.hpp"
#include "logger.hpp"

#include <objbase.h>
#include <string>
#include <windows.h>

namespace {

const char* kAllowed[] = {
    "ping",
    "listSessions",
    "listDevices",
    "getMaster",
    "setMasterVolume",
    "setMasterMute",
    "toggleMasterMute",
    "adjustMasterVolume",
    "getApp",
    "setAppVolume",
    "setAppMute",
    "toggleAppMute",
    "adjustAppVolume",
};

bool allowed_command(const std::string& cmd) {
    for (const char* item : kAllowed) {
        if (cmd == item) return true;
    }
    return false;
}

Json ok(const Json& request, const Json& data) {
    Json response = Json::object();
    response["id"] = request["id"];
    response["ok"] = true;
    response["data"] = data;
    return response;
}

Json fail(const Json& request, const std::string& code, const std::string& message) {
    Json response = Json::object();
    response["id"] = request["id"];
    response["ok"] = false;
    response["code"] = code;
    response["error"] = message;
    return response;
}

}  // namespace

int main() {
    HANDLE mutex = CreateMutexW(nullptr, TRUE, IpcServer::kMutexName);
    if (!mutex) return 1;
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        LOG_INFO("Audio helper already running");
        CloseHandle(mutex);
        return 0;
    }

    const char* debug = getenv("ULN_AUDIO_DEBUG");
    if (debug && std::string(debug) == "1") Logger::instance().set_level(LogLevel::Debug);

    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr)) {
        LOG_ERROR("CoInitializeEx failed (%08lx)", hr);
        CloseHandle(mutex);
        return 1;
    }

    AudioEngine engine;
    if (!engine.start()) {
        LOG_ERROR("Failed to start Windows audio engine");
        CoUninitialize();
        CloseHandle(mutex);
        return 1;
    }

    IpcServer server([&](const Json& request) {
        std::string cmd = request["cmd"].as_string("");
        if (!allowed_command(cmd)) {
            LOG_WARN("Rejected command: %s", cmd.c_str());
            return fail(request, "forbidden", "command not allowed");
        }
        try {
            if (cmd == "ping") {
                Json data = Json::object();
                data["version"] = "1.0.0";
                data["protocol"] = 1;
                return ok(request, data);
            }
            if (cmd == "listSessions") return ok(request, engine.list_sessions());
            if (cmd == "listDevices") return ok(request, engine.list_devices(request["flow"].as_string("render")));
            if (cmd == "getMaster") return ok(request, engine.get_master());
            if (cmd == "setMasterVolume") return ok(request, engine.set_master_volume(request["volume"].as_number()));
            if (cmd == "setMasterMute") return ok(request, engine.set_master_mute(request["muted"].as_bool()));
            if (cmd == "toggleMasterMute") return ok(request, engine.toggle_master_mute());
            if (cmd == "adjustMasterVolume") return ok(request, engine.adjust_master(request["delta"].as_number()));
            if (cmd == "getApp") return ok(request, engine.get_app(request));
            if (cmd == "setAppVolume") return ok(request, engine.set_app_volume(request, request["volume"].as_number()));
            if (cmd == "setAppMute") return ok(request, engine.set_app_mute(request, request["muted"].as_bool()));
            if (cmd == "toggleAppMute") return ok(request, engine.toggle_app_mute(request));
            if (cmd == "adjustAppVolume") return ok(request, engine.adjust_app(request, request["delta"].as_number()));
            return fail(request, "unknown", "unknown command");
        } catch (const std::exception& ex) {
            return fail(request, "engine", ex.what());
        }
    });

    engine.set_event_sink([&](const std::string& event, const Json& data) {
        server.send_event(event, data);
    });

    if (!server.start()) {
        LOG_ERROR("Failed to start IPC server");
        engine.stop();
        CoUninitialize();
        CloseHandle(mutex);
        return 1;
    }

    LOG_INFO("Audio helper listening on named pipe");
    HANDLE shutdown = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    SetConsoleCtrlHandler([](DWORD) -> BOOL { return TRUE; }, TRUE);
    WaitForSingleObject(shutdown, INFINITE);

    server.stop();
    engine.stop();
    CoUninitialize();
    CloseHandle(mutex);
    return 0;
}
