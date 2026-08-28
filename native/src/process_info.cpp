#include "process_info.h"

#include "com_utils.hpp"
#include "logger.hpp"

#include <cwchar>
#include <vector>
#include <shlwapi.h>

#ifdef _MSC_VER
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "version.lib")
#endif

namespace {

std::string file_description(const std::wstring& path) {
    DWORD handle = 0;
    DWORD size = GetFileVersionInfoSizeW(path.c_str(), &handle);
    if (!size) return {};
    std::vector<unsigned char> buffer(size);
    if (!GetFileVersionInfoW(path.c_str(), 0, size, buffer.data())) return {};

    struct LANGANDCODEPAGE {
        WORD language;
        WORD codePage;
    } *translate = nullptr;
    UINT translateBytes = 0;
    if (!VerQueryValueW(buffer.data(), L"\\VarFileInfo\\Translation", reinterpret_cast<void**>(&translate), &translateBytes)
        || !translate || translateBytes < sizeof(LANGANDCODEPAGE)) {
        return {};
    }

    wchar_t subBlock[64];
#ifdef _MSC_VER
    swprintf_s(subBlock, L"\\StringFileInfo\\%04x%04x\\FileDescription", translate[0].language, translate[0].codePage);
#else
    swprintf(subBlock, 64, L"\\StringFileInfo\\%04x%04x\\FileDescription", translate[0].language, translate[0].codePage);
#endif
    wchar_t* description = nullptr;
    UINT descriptionLen = 0;
    if (!VerQueryValueW(buffer.data(), subBlock, reinterpret_cast<void**>(&description), &descriptionLen) || !description) {
        return {};
    }
    return wide_to_utf8(description);
}

}  // namespace

std::string resolve_display_name(const wchar_t* raw) {
    if (!raw || !*raw) return {};
    if (raw[0] == L'@') {
        wchar_t resolved[512];
        if (SUCCEEDED(SHLoadIndirectString(raw, resolved, 512, nullptr))) {
            return wide_to_utf8(resolved);
        }
    }
    return wide_to_utf8(raw);
}

ProcessInfo get_process_info(DWORD pid) {
    ProcessInfo info;
    info.pid = pid;
    if (pid == 0) {
        info.executable = "SystemSounds";
        info.displayName = "System Sounds";
        return info;
    }

    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!process) {
        info.executable = "unknown";
        info.displayName = "Unknown";
        return info;
    }

    wchar_t path[MAX_PATH];
    DWORD size = MAX_PATH;
    if (QueryFullProcessImageNameW(process, 0, path, &size)) {
        info.path = wide_to_utf8(path);
        info.executable = filename_of(info.path);
        info.displayName = file_description(path);
        if (info.displayName.empty()) {
            std::string name = info.executable;
            if (name.size() > 4 && to_lower_ascii(name.substr(name.size() - 4)) == ".exe") {
                name = name.substr(0, name.size() - 4);
            }
            info.displayName = name;
        }
    } else {
        info.executable = "unknown";
        info.displayName = "Unknown";
    }
    CloseHandle(process);
    return info;
}
