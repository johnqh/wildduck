#!/bin/bash

# WildDuck API Testing Script
# Quick command-line testing for WildDuck API endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${WILDDUCK_API_URL:-"http://localhost:8080"}
TEST_USER_PREFIX="apitest$(date +%s)"
CREATED_USER_ID=""

# Get test configuration from centralized config
get_test_config() {
    node -e "const config = require('./test-config'); console.log(JSON.stringify({domains: config.TEST_DOMAINS}));"
}

TEST_CONFIG=$(get_test_config)
TEST_DOMAIN=$(echo "$TEST_CONFIG" | jq -r '.domains.example')

# Helper functions
print_test() { echo -e "${BLUE}Testing: $1${NC}"; }
print_pass() { echo -e "${GREEN}✓ PASS: $1${NC}"; }
print_fail() { echo -e "${RED}✗ FAIL: $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ WARN: $1${NC}"; }

# HTTP request wrapper with error handling
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="${4:-200}"

    if [[ -n "$data" ]]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
            -X "$method" \
            "$BASE_URL$endpoint")
    fi

    body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')

    if [[ "$status" -eq "$expected_status" ]]; then
        echo "$body"
        return 0
    else
        print_fail "Expected status $expected_status, got $status"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# Test health endpoint
test_health() {
    print_test "Health Check"

    if response=$(api_request "GET" "/health"); then
        if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
            print_pass "Health check successful"
            echo "$response" | jq -r '"Version: " + .version'
        else
            print_fail "Health check response invalid"
            return 1
        fi
    else
        print_fail "Health check failed"
        return 1
    fi
}

# Test user creation
test_create_user() {
    print_test "Create User"

    local user_data='{
        "username": "'$TEST_USER_PREFIX'",
        "password": "TestPassword123!",
        "address": "'$TEST_USER_PREFIX'@'$TEST_DOMAIN'",
        "name": "Test User",
        "quota": 1073741824,
        "tags": ["api-test"],
        "metadata": {
            "source": "api-test-script",
            "created": "'$(date -Iseconds)'"
        }
    }'

    if response=$(api_request "POST" "/users" "$user_data"); then
        if user_id=$(echo "$response" | jq -r '.id // empty'); then
            if [[ -n "$user_id" ]]; then
                CREATED_USER_ID="$user_id"
                print_pass "User created with ID: $user_id"
            else
                print_fail "User creation response missing ID"
                return 1
            fi
        else
            print_fail "User creation failed"
            echo "$response" | jq '.'
            return 1
        fi
    else
        print_fail "User creation request failed"
        return 1
    fi
}

# Test user retrieval
test_get_user() {
    print_test "Get User"

    if [[ -z "$CREATED_USER_ID" ]]; then
        print_warn "Skipping - no user ID available"
        return 0
    fi

    if response=$(api_request "GET" "/users/$CREATED_USER_ID"); then
        if username=$(echo "$response" | jq -r '.data.username // empty'); then
            if [[ "$username" == "$TEST_USER_PREFIX" ]]; then
                print_pass "User retrieved successfully: $username"
                echo "$response" | jq -r '"Quota: " + (.data.quota | tostring) + " bytes"'
            else
                print_fail "Retrieved user has wrong username: $username"
                return 1
            fi
        else
            print_fail "User retrieval failed"
            echo "$response" | jq '.'
            return 1
        fi
    else
        print_fail "User retrieval request failed"
        return 1
    fi
}

# Test mailbox listing
test_list_mailboxes() {
    print_test "List Mailboxes"

    if [[ -z "$CREATED_USER_ID" ]]; then
        print_warn "Skipping - no user ID available"
        return 0
    fi

    if response=$(api_request "GET" "/users/$CREATED_USER_ID/mailboxes"); then
        if mailbox_count=$(echo "$response" | jq -r '.results | length'); then
            if [[ "$mailbox_count" -gt 0 ]]; then
                print_pass "Found $mailbox_count mailboxes"

                # Check for INBOX
                if echo "$response" | jq -e '.results[] | select(.path == "INBOX")' > /dev/null; then
                    print_pass "INBOX mailbox exists"
                else
                    print_fail "INBOX mailbox not found"
                    return 1
                fi
            else
                print_fail "No mailboxes found"
                return 1
            fi
        else
            print_fail "Mailbox listing failed"
            echo "$response" | jq '.'
            return 1
        fi
    else
        print_fail "Mailbox listing request failed"
        return 1
    fi
}

# Test message search
test_search_messages() {
    print_test "Search Messages"

    if [[ -z "$CREATED_USER_ID" ]]; then
        print_warn "Skipping - no user ID available"
        return 0
    fi

    if response=$(api_request "GET" "/users/$CREATED_USER_ID/search?q=test&limit=10"); then
        if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
            result_count=$(echo "$response" | jq -r '.results | length')
            print_pass "Search completed, found $result_count messages"
        else
            print_fail "Search failed"
            echo "$response" | jq '.'
            return 1
        fi
    else
        print_fail "Search request failed"
        return 1
    fi
}

# Test filter creation
test_create_filter() {
    print_test "Create Filter"

    if [[ -z "$CREATED_USER_ID" ]]; then
        print_warn "Skipping - no user ID available"
        return 0
    fi

    local filter_data='{
        "name": "Test Spam Filter",
        "query": {
            "from": "spam@'$TEST_DOMAIN'"
        },
        "action": {
            "moveTo": "Junk",
            "flags": {
                "add": ["\\Seen"]
            }
        },
        "active": true
    }'

    if response=$(api_request "POST" "/users/$CREATED_USER_ID/filters" "$filter_data"); then
        if filter_id=$(echo "$response" | jq -r '.id // empty'); then
            if [[ -n "$filter_id" ]]; then
                print_pass "Filter created with ID: $filter_id"
            else
                print_fail "Filter creation response missing ID"
                return 1
            fi
        else
            print_fail "Filter creation failed"
            echo "$response" | jq '.'
            return 1
        fi
    else
        print_fail "Filter creation request failed"
        return 1
    fi
}

# Test user update
test_update_user() {
    print_test "Update User"

    if [[ -z "$CREATED_USER_ID" ]]; then
        print_warn "Skipping - no user ID available"
        return 0
    fi

    local update_data='{
        "quota": 2147483648,
        "name": "Updated Test User"
    }'

    if response=$(api_request "PUT" "/users/$CREATED_USER_ID" "$update_data"); then
        if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
            print_pass "User updated successfully"
        else
            print_fail "User update failed"
            echo "$response" | jq '.'
            return 1
        fi
    else
        print_fail "User update request failed"
        return 1
    fi
}

# Test error handling
test_error_handling() {
    print_test "Error Handling"

    # Test non-existent user
    if response=$(api_request "GET" "/users/507f1f77bcf86cd799439011" "" "404"); then
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            print_pass "404 error handled correctly"
        else
            print_fail "Error response format incorrect"
            return 1
        fi
    else
        print_fail "Error handling test failed"
        return 1
    fi

    # Test invalid data
    if response=$(api_request "POST" "/users" '{"invalid": "data"}' "400"); then
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            print_pass "400 validation error handled correctly"
        else
            print_fail "Validation error response format incorrect"
            return 1
        fi
    else
        print_fail "Validation error test failed"
        return 1
    fi
}

# Cleanup test user
cleanup_user() {
    if [[ -n "$CREATED_USER_ID" ]]; then
        print_test "Cleanup - Delete User"

        if response=$(api_request "DELETE" "/users/$CREATED_USER_ID"); then
            if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
                print_pass "Test user deleted successfully"
            else
                print_warn "User deletion may have failed"
                echo "$response" | jq '.'
            fi
        else
            print_warn "User deletion request failed"
        fi
    fi
}

# Performance test
test_performance() {
    print_test "Performance Test"

    local start_time=$(date +%s%N)

    # Run multiple health checks
    for i in {1..10}; do
        api_request "GET" "/health" "" "200" > /dev/null
    done

    local end_time=$(date +%s%N)
    local duration=$(((end_time - start_time) / 1000000)) # Convert to milliseconds

    if [[ $duration -lt 5000 ]]; then # Less than 5 seconds for 10 requests
        print_pass "Performance test passed: ${duration}ms for 10 requests"
    else
        print_warn "Performance test slow: ${duration}ms for 10 requests"
    fi
}

# Main test execution
run_tests() {
    echo "WildDuck API Testing"
    echo "==================="
    echo "Base URL: $BASE_URL"
    echo ""

    local tests_passed=0
    local tests_total=0

    # Run tests
    declare -a test_functions=(
        "test_health"
        "test_create_user"
        "test_get_user"
        "test_list_mailboxes"
        "test_search_messages"
        "test_create_filter"
        "test_update_user"
        "test_error_handling"
        "test_performance"
    )

    for test_func in "${test_functions[@]}"; do
        echo ""
        ((tests_total++))
        if $test_func; then
            ((tests_passed++))
        fi
    done

    # Cleanup
    echo ""
    cleanup_user

    # Summary
    echo ""
    echo "Test Summary"
    echo "============"
    echo "Passed: $tests_passed/$tests_total"

    if [[ $tests_passed -eq $tests_total ]]; then
        print_pass "All tests passed!"
        exit 0
    else
        print_fail "Some tests failed"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        print_fail "curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_fail "jq is required but not installed"
        exit 1
    fi
}

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL    Set base URL (default: http://localhost:8080)"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  WILDDUCK_API_URL    Base URL for WildDuck API"
    echo ""
    echo "Examples:"
    echo "  $0                          # Test against localhost"
    echo "  $0 -u http://api.example.com # Test against remote server"
    echo "  WILDDUCK_API_URL=http://test.local $0  # Use environment variable"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main execution
check_dependencies
run_tests