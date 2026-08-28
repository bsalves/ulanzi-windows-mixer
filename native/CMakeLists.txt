cmake_minimum_required(VERSION 3.16)
project(ulanzi-audio-helper LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT WIN32)
  message(FATAL_ERROR "ulanzi-audio-helper can only be built on Windows (WASAPI).")
endif()

add_executable(ulanzi-audio-helper
  src/main.cpp
  src/audio_engine.cpp
  src/ipc_server.cpp
  src/process_info.cpp
)

target_include_directories(ulanzi-audio-helper PRIVATE include src)

target_compile_definitions(ulanzi-audio-helper PRIVATE
  UNICODE
  _UNICODE
  WIN32_LEAN_AND_MEAN
  NOMINMAX
)

target_link_libraries(ulanzi-audio-helper PRIVATE
  ole32
  oleaut32
  uuid
  shlwapi
  version
)

if(MSVC)
  target_compile_options(ulanzi-audio-helper PRIVATE /W4 /EHsc /utf-8)
  set_target_properties(ulanzi-audio-helper PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  )
else()
  target_compile_options(ulanzi-audio-helper PRIVATE -Wall -Wextra)
endif()

install(TARGETS ulanzi-audio-helper RUNTIME DESTINATION native)
