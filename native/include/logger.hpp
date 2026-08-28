#pragma once

#include <chrono>
#include <cstdarg>
#include <cstdio>
#include <ctime>
#include <mutex>
#include <string>

enum class LogLevel { Debug = 0, Info = 1, Warn = 2, Error = 3 };

inline LogLevel log_level_from_string(const std::string& value) {
    if (value == "debug" || value == "DEBUG") return LogLevel::Debug;
    if (value == "warn" || value == "WARN") return LogLevel::Warn;
    if (value == "error" || value == "ERROR") return LogLevel::Error;
    return LogLevel::Info;
}

class Logger {
public:
    static Logger& instance() {
        static Logger logger;
        return logger;
    }

    void set_level(LogLevel level) { level_ = level; }

    void log(LogLevel level, const char* fmt, ...) {
        if (level < level_) return;
        char body[1024];
        va_list args;
        va_start(args, fmt);
        std::vsnprintf(body, sizeof(body), fmt, args);
        va_end(args);

        const char* name = "INFO";
        if (level == LogLevel::Debug) name = "DEBUG";
        else if (level == LogLevel::Warn) name = "WARN";
        else if (level == LogLevel::Error) name = "ERROR";

        std::lock_guard<std::mutex> lock(mutex_);
        std::fprintf(stderr, "[%s] %s\n", name, body);
        std::fflush(stderr);
    }

private:
    std::mutex mutex_;
    LogLevel level_ = LogLevel::Info;
};

#define LOG_DEBUG(...) Logger::instance().log(LogLevel::Debug, __VA_ARGS__)
#define LOG_INFO(...) Logger::instance().log(LogLevel::Info, __VA_ARGS__)
#define LOG_WARN(...) Logger::instance().log(LogLevel::Warn, __VA_ARGS__)
#define LOG_ERROR(...) Logger::instance().log(LogLevel::Error, __VA_ARGS__)
