#pragma once

#include <string>
#include <windows.h>

struct ProcessInfo {
    DWORD pid = 0;
    std::string executable;
    std::string displayName;
    std::string path;
};

ProcessInfo get_process_info(DWORD pid);
std::string resolve_display_name(const wchar_t* raw);
