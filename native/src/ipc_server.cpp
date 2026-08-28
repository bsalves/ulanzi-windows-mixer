#include "ipc_server.h"

#include "logger.hpp"

#include <algorithm>
#include <atomic>
#include <mutex>
#include <thread>
#include <vector>
#include <windows.h>

struct IpcServer::Impl {
    Handler handler;
    std::atomic<bool> running{false};
    std::thread accept_thread;
    std::mutex clients_mtx;
    std::vector<HANDLE> clients;
    HANDLE stop_event = nullptr;

    void accept_loop();
    void client_loop(HANDLE pipe);
    void write_json(HANDLE pipe, const Json& json);
    void close_clients();
};

IpcServer::IpcServer(Handler handler) : impl_(new Impl()) {
    impl_->handler = std::move(handler);
}

IpcServer::~IpcServer() {
    stop();
    delete impl_;
}

bool IpcServer::start() {
    impl_->stop_event = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    impl_->running = true;
    impl_->accept_thread = std::thread([this]() { impl_->accept_loop(); });
    return true;
}

void IpcServer::stop() {
    impl_->running = false;
    if (impl_->stop_event) SetEvent(impl_->stop_event);
    impl_->close_clients();
    if (impl_->accept_thread.joinable()) impl_->accept_thread.join();
    if (impl_->stop_event) {
        CloseHandle(impl_->stop_event);
        impl_->stop_event = nullptr;
    }
}

void IpcServer::send_event(const std::string& event, const Json& data) {
    Json message = Json::object();
    message["type"] = "event";
    message["event"] = event;
    message["data"] = data;
    std::lock_guard<std::mutex> lock(impl_->clients_mtx);
    for (HANDLE pipe : impl_->clients) {
        impl_->write_json(pipe, message);
    }
}

void IpcServer::Impl::accept_loop() {
    while (running) {
        HANDLE pipe = CreateNamedPipeW(
            IpcServer::kPipeName,
            PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
            PIPE_UNLIMITED_INSTANCES,
            64 * 1024,
            64 * 1024,
            0,
            nullptr);
        if (pipe == INVALID_HANDLE_VALUE) {
            LOG_ERROR("CreateNamedPipe failed (%lu)", GetLastError());
            Sleep(500);
            continue;
        }

        OVERLAPPED ov{};
        ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        BOOL connected = ConnectNamedPipe(pipe, &ov);
        DWORD err = GetLastError();
        if (!connected && err == ERROR_IO_PENDING) {
            HANDLE waits[2] = {ov.hEvent, stop_event};
            DWORD wait = WaitForMultipleObjects(2, waits, FALSE, INFINITE);
            if (wait != WAIT_OBJECT_0) {
                CancelIo(pipe);
                CloseHandle(ov.hEvent);
                CloseHandle(pipe);
                break;
            }
        } else if (!connected && err != ERROR_PIPE_CONNECTED) {
            CloseHandle(ov.hEvent);
            CloseHandle(pipe);
            continue;
        }
        CloseHandle(ov.hEvent);

        LOG_DEBUG("Plugin connected to helper pipe");
        {
            std::lock_guard<std::mutex> lock(clients_mtx);
            clients.push_back(pipe);
        }
        std::thread([this, pipe]() { client_loop(pipe); }).detach();
    }
}

void IpcServer::Impl::client_loop(HANDLE pipe) {
    std::string buffer;
    char chunk[4096];
    while (running) {
        DWORD read = 0;
        BOOL ok = ReadFile(pipe, chunk, sizeof(chunk), &read, nullptr);
        if (!ok || read == 0) break;
        buffer.append(chunk, chunk + read);
        size_t pos;
        while ((pos = buffer.find('\n')) != std::string::npos) {
            std::string line = buffer.substr(0, pos);
            buffer.erase(0, pos + 1);
            if (line.empty()) continue;
            Json request;
            Json response = Json::object();
            try {
                request = Json::parse(line);
                response = handler(request);
            } catch (const std::exception& ex) {
                response["id"] = request.contains("id") ? request["id"] : Json("");
                response["ok"] = false;
                response["error"] = ex.what();
                response["code"] = "invalid_request";
            }
            write_json(pipe, response);
        }
        if (buffer.size() > 1024 * 1024) buffer.clear();
    }
    DisconnectNamedPipe(pipe);
    CloseHandle(pipe);
    std::lock_guard<std::mutex> lock(clients_mtx);
    clients.erase(std::remove(clients.begin(), clients.end(), pipe), clients.end());
    LOG_WARN("Plugin disconnected from helper");
}

void IpcServer::Impl::write_json(HANDLE pipe, const Json& json) {
    std::string payload = json.dump() + "\n";
    DWORD written = 0;
    WriteFile(pipe, payload.data(), static_cast<DWORD>(payload.size()), &written, nullptr);
}

void IpcServer::Impl::close_clients() {
    std::lock_guard<std::mutex> lock(clients_mtx);
    for (HANDLE pipe : clients) {
        CancelIoEx(pipe, nullptr);
        DisconnectNamedPipe(pipe);
        CloseHandle(pipe);
    }
    clients.clear();
}
