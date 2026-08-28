#pragma once

#include <string>
#include <windows.h>

template <typename T>
class ComPtr {
public:
    ComPtr() : ptr_(nullptr) {}
    ComPtr(T* ptr) : ptr_(ptr) {}
    ComPtr(const ComPtr&) = delete;
    ComPtr& operator=(const ComPtr&) = delete;
    ComPtr(ComPtr&& other) noexcept : ptr_(other.ptr_) { other.ptr_ = nullptr; }
    ComPtr& operator=(ComPtr&& other) noexcept {
        if (this != &other) {
            reset();
            ptr_ = other.ptr_;
            other.ptr_ = nullptr;
        }
        return *this;
    }
    ~ComPtr() { reset(); }

    T** put() {
        reset();
        return &ptr_;
    }
    T* get() const { return ptr_; }
    T* operator->() const { return ptr_; }
    explicit operator bool() const { return ptr_ != nullptr; }
    T* detach() {
        T* tmp = ptr_;
        ptr_ = nullptr;
        return tmp;
    }
    void reset() {
        if (ptr_) {
            ptr_->Release();
            ptr_ = nullptr;
        }
    }

private:
    T* ptr_;
};

inline std::string wide_to_utf8(const wchar_t* input) {
    if (!input || !*input) return {};
    int size = WideCharToMultiByte(CP_UTF8, 0, input, -1, nullptr, 0, nullptr, nullptr);
    if (size <= 1) return {};
    std::string out(static_cast<size_t>(size - 1), '\0');
    WideCharToMultiByte(CP_UTF8, 0, input, -1, out.data(), size, nullptr, nullptr);
    return out;
}

inline std::wstring utf8_to_wide(const std::string& input) {
    if (input.empty()) return {};
    int size = MultiByteToWideChar(CP_UTF8, 0, input.c_str(), -1, nullptr, 0);
    if (size <= 1) return {};
    std::wstring out(static_cast<size_t>(size - 1), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, input.c_str(), -1, out.data(), size);
    return out;
}

inline std::string to_lower_ascii(std::string value) {
    for (char& ch : value) {
        if (ch >= 'A' && ch <= 'Z') ch = static_cast<char>(ch - 'A' + 'a');
    }
    return value;
}

inline std::string filename_of(const std::string& path) {
    size_t pos = path.find_last_of("\\/");
    return pos == std::string::npos ? path : path.substr(pos + 1);
}
