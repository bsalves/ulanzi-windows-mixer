#pragma once

#include "json.hpp"

#include <functional>
#include <string>

class IpcServer {
public:
    using Handler = std::function<Json(const Json&)>;
    using Broadcast = std::function<void(const Json&)>;

    static constexpr wchar_t kPipeName[] = L"\\\\.\\pipe\\ulanzi-windows-audio-helper";
    static constexpr wchar_t kMutexName[] = L"Local\\UlanziWindowsAudioHelper";

    explicit IpcServer(Handler handler);
    ~IpcServer();

    bool start();
    void stop();
    void send_event(const std::string& event, const Json& data);

private:
    struct Impl;
    Impl* impl_;
};
