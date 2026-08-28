#pragma once

#include "json.hpp"

#include <functional>
#include <mutex>
#include <string>
#include <vector>

struct VolumeState {
    double volume = 0;
    bool muted = false;
};

struct SessionInfo {
    std::string sessionId;
    unsigned pid = 0;
    std::string executable;
    std::string displayName;
    double volume = 0;
    bool muted = false;
};

struct DeviceInfo {
    std::string id;
    std::string name;
    std::string flow;
    bool isDefault = false;
};

class AudioEngine {
public:
    using EventFn = std::function<void(const std::string& event, const Json& data)>;

    AudioEngine();
    ~AudioEngine();

    bool start();
    void stop();

    Json list_sessions();
    Json list_devices(const std::string& flow);
    Json get_master();
    Json set_master_volume(double volume);
    Json set_master_mute(bool muted);
    Json toggle_master_mute();
    Json adjust_master(double delta);
    Json get_app(const Json& query);
    Json set_app_volume(const Json& query, double volume);
    Json set_app_mute(const Json& query, bool muted);
    Json toggle_app_mute(const Json& query);
    Json adjust_app(const Json& query, double delta);

    void set_event_sink(EventFn fn);
    void on_sessions_changed();
    void on_master_changed();
    void on_device_changed();

private:
    struct Impl;
    Impl* impl_;
};
