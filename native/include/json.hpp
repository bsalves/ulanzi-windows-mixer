#pragma once

#include <cctype>
#include <cmath>
#include <cstdio>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

class Json {
public:
    enum Type { Null, Bool, Number, String, Array, Object };

    Json() : type_(Null), number_(0), bool_(false) {}
    Json(std::nullptr_t) : Json() {}
    Json(bool value) : type_(Bool), number_(0), bool_(value) {}
    Json(int value) : type_(Number), number_(static_cast<double>(value)), bool_(false) {}
    Json(unsigned value) : type_(Number), number_(static_cast<double>(value)), bool_(false) {}
    Json(double value) : type_(Number), number_(value), bool_(false) {}
    Json(const char* value) : type_(String), number_(0), bool_(false), string_(value ? value : "") {}
    Json(std::string value) : type_(String), number_(0), bool_(false), string_(std::move(value)) {}

    static Json object() {
        Json json;
        json.type_ = Object;
        return json;
    }

    static Json array() {
        Json json;
        json.type_ = Array;
        return json;
    }

    Type type() const { return type_; }
    bool is_null() const { return type_ == Null; }
    bool is_bool() const { return type_ == Bool; }
    bool is_number() const { return type_ == Number; }
    bool is_string() const { return type_ == String; }
    bool is_array() const { return type_ == Array; }
    bool is_object() const { return type_ == Object; }

    bool as_bool(bool fallback = false) const {
        if (type_ == Bool) return bool_;
        if (type_ == Number) return number_ != 0;
        return fallback;
    }

    double as_number(double fallback = 0) const {
        return type_ == Number ? number_ : fallback;
    }

    int as_int(int fallback = 0) const {
        return type_ == Number ? static_cast<int>(number_) : fallback;
    }

    const std::string& as_string() const { return string_; }

    std::string as_string(const std::string& fallback) const {
        return type_ == String ? string_ : fallback;
    }

    Json& operator[](const std::string& key) {
        type_ = Object;
        return object_[key];
    }

    const Json& operator[](const std::string& key) const {
        static Json empty;
        auto it = object_.find(key);
        return it == object_.end() ? empty : it->second;
    }

    bool contains(const std::string& key) const {
        return type_ == Object && object_.count(key) > 0;
    }

    void push_back(Json value) {
        type_ = Array;
        array_.push_back(std::move(value));
    }

    const std::vector<Json>& items() const { return array_; }
    const std::map<std::string, Json>& fields() const { return object_; }

    std::string dump() const {
        std::ostringstream out;
        dump_into(out);
        return out.str();
    }

    static Json parse(const std::string& text) {
        Parser parser(text);
        Json value = parser.parse_value();
        parser.skip_ws();
        return value;
    }

private:
    Type type_;
    double number_;
    bool bool_;
    std::string string_;
    std::vector<Json> array_;
    std::map<std::string, Json> object_;

    void dump_into(std::ostringstream& out) const {
        switch (type_) {
        case Null:
            out << "null";
            break;
        case Bool:
            out << (bool_ ? "true" : "false");
            break;
        case Number:
            out << number_;
            break;
        case String:
            out << '"' << escape(string_) << '"';
            break;
        case Array: {
            out << '[';
            for (size_t i = 0; i < array_.size(); ++i) {
                if (i) out << ',';
                array_[i].dump_into(out);
            }
            out << ']';
            break;
        }
        case Object: {
            out << '{';
            bool first = true;
            for (const auto& [key, value] : object_) {
                if (!first) out << ',';
                first = false;
                out << '"' << escape(key) << "\":";
                value.dump_into(out);
            }
            out << '}';
            break;
        }
        }
    }

    static std::string escape(const std::string& input) {
        std::string out;
        out.reserve(input.size());
        for (unsigned char ch : input) {
            switch (ch) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (ch < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", ch);
                    out += buf;
                } else {
                    out += static_cast<char>(ch);
                }
            }
        }
        return out;
    }

    class Parser {
    public:
        explicit Parser(const std::string& text) : text_(text), i_(0) {}

        void skip_ws() {
            while (i_ < text_.size() && std::isspace(static_cast<unsigned char>(text_[i_]))) ++i_;
        }

        Json parse_value() {
            skip_ws();
            if (i_ >= text_.size()) return {};
            char ch = text_[i_];
            if (ch == 'n') return parse_literal("null", Json());
            if (ch == 't') return parse_literal("true", Json(true));
            if (ch == 'f') return parse_literal("false", Json(false));
            if (ch == '"') return Json(parse_string());
            if (ch == '{') return parse_object();
            if (ch == '[') return parse_array();
            return parse_number();
        }

    private:
        const std::string& text_;
        size_t i_;

        Json parse_literal(const char* literal, Json value) {
            size_t n = std::char_traits<char>::length(literal);
            if (text_.compare(i_, n, literal) != 0) throw std::runtime_error("invalid json literal");
            i_ += n;
            return value;
        }

        std::string parse_string() {
            ++i_;
            std::string out;
            while (i_ < text_.size()) {
                char ch = text_[i_++];
                if (ch == '"') return out;
                if (ch != '\\') {
                    out += ch;
                    continue;
                }
                if (i_ >= text_.size()) break;
                char esc = text_[i_++];
                switch (esc) {
                case '"':
                case '\\':
                case '/':
                    out += esc;
                    break;
                case 'b': out += '\b'; break;
                case 'f': out += '\f'; break;
                case 'n': out += '\n'; break;
                case 'r': out += '\r'; break;
                case 't': out += '\t'; break;
                case 'u': {
                    if (i_ + 4 > text_.size()) break;
                    unsigned code = std::stoul(text_.substr(i_, 4), nullptr, 16);
                    i_ += 4;
                    if (code < 128) out += static_cast<char>(code);
                    else out += '?';
                    break;
                }
                default:
                    out += esc;
                    break;
                }
            }
            throw std::runtime_error("unterminated string");
        }

        Json parse_object() {
            ++i_;
            Json obj = Json::object();
            skip_ws();
            if (i_ < text_.size() && text_[i_] == '}') {
                ++i_;
                return obj;
            }
            while (i_ < text_.size()) {
                skip_ws();
                if (text_[i_] != '"') throw std::runtime_error("object key");
                std::string key = parse_string();
                skip_ws();
                if (i_ >= text_.size() || text_[i_] != ':') throw std::runtime_error("missing colon");
                ++i_;
                obj[key] = parse_value();
                skip_ws();
                if (i_ < text_.size() && text_[i_] == ',') {
                    ++i_;
                    continue;
                }
                if (i_ < text_.size() && text_[i_] == '}') {
                    ++i_;
                    return obj;
                }
                throw std::runtime_error("object");
            }
            throw std::runtime_error("unterminated object");
        }

        Json parse_array() {
            ++i_;
            Json arr = Json::array();
            skip_ws();
            if (i_ < text_.size() && text_[i_] == ']') {
                ++i_;
                return arr;
            }
            while (i_ < text_.size()) {
                arr.push_back(parse_value());
                skip_ws();
                if (i_ < text_.size() && text_[i_] == ',') {
                    ++i_;
                    continue;
                }
                if (i_ < text_.size() && text_[i_] == ']') {
                    ++i_;
                    return arr;
                }
                throw std::runtime_error("array");
            }
            throw std::runtime_error("unterminated array");
        }

        Json parse_number() {
            size_t start = i_;
            if (i_ < text_.size() && text_[i_] == '-') ++i_;
            while (i_ < text_.size() && std::isdigit(static_cast<unsigned char>(text_[i_]))) ++i_;
            if (i_ < text_.size() && text_[i_] == '.') {
                ++i_;
                while (i_ < text_.size() && std::isdigit(static_cast<unsigned char>(text_[i_]))) ++i_;
            }
            if (i_ < text_.size() && (text_[i_] == 'e' || text_[i_] == 'E')) {
                ++i_;
                if (i_ < text_.size() && (text_[i_] == '+' || text_[i_] == '-')) ++i_;
                while (i_ < text_.size() && std::isdigit(static_cast<unsigned char>(text_[i_]))) ++i_;
            }
            return Json(std::stod(text_.substr(start, i_ - start)));
        }
    };
};
