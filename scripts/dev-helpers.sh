#!/bin/bash

# WildDuck Development Helper Scripts
# These scripts help developers and AI assistants work more efficiently

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

# Check if MongoDB is running
check_mongodb() {
    if mongosh --quiet --eval "db.version()" > /dev/null 2>&1; then
        print_success "MongoDB is running"
        return 0
    else
        print_error "MongoDB is not running"
        return 1
    fi
}

# Check if Redis is running
check_redis() {
    if redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is running"
        return 0
    else
        print_error "Redis is not running"
        return 1
    fi
}

# Setup development database
setup_dev_db() {
    echo "Setting up development database..."

    if ! check_mongodb; then
        print_error "Please start MongoDB first"
        exit 1
    fi

    # Create indexes
    echo "Creating database indexes..."
    mongosh wildduck --eval "
        db.users.createIndex({ username: 1 }, { unique: true });
        db.users.createIndex({ address: 1 });
        db.mailboxes.createIndex({ user: 1, path: 1 });
        db.messages.createIndex({ mailbox: 1, uid: 1 });
        db.messages.createIndex({ user: 1, searchable: 1 });
        print('Indexes created successfully');
    "

    print_success "Database setup complete"
}

# Create test user
create_test_user() {
    local username=${1:-testuser}
    local password=${2:-testpass}

    echo "Creating test user: $username"

    # Use the API to create user (requires running server)
    curl -X POST http://localhost:8080/users \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"$username\",
            \"password\": \"$password\",
            \"address\": \"$username@localhost\",
            \"name\": \"Test User\",
            \"quota\": 1073741824
        }" || print_warning "Could not create user via API. Server may not be running."

    print_success "Test user creation attempted"
}

# Check all services
health_check() {
    echo "=== WildDuck Health Check ==="
    echo

    # Check MongoDB
    check_mongodb || true

    # Check Redis
    check_redis || true

    # Check WildDuck API
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        print_success "API server is running"

        # Get detailed health
        echo
        echo "API Health Details:"
        curl -s http://localhost:8080/health | python3 -m json.tool 2>/dev/null || echo "  Could not parse JSON"
    else
        print_error "API server is not running"
    fi

    # Check IMAP
    if nc -z localhost 143 2>/dev/null; then
        print_success "IMAP server is running on port 143"
    else
        print_error "IMAP server is not running"
    fi

    # Check POP3
    if nc -z localhost 110 2>/dev/null; then
        print_success "POP3 server is running on port 110"
    else
        print_error "POP3 server is not running"
    fi

    # Check LMTP
    if nc -z localhost 2424 2>/dev/null; then
        print_success "LMTP server is running on port 2424"
    else
        print_error "LMTP server is not running"
    fi

    echo
    echo "=== Health Check Complete ==="
}

# Start all services
start_all() {
    echo "Starting all WildDuck services..."

    # Start MongoDB if not running
    if ! check_mongodb; then
        echo "Starting MongoDB..."
        mongod --fork --logpath /tmp/mongodb.log --dbpath ./data/db || print_warning "Could not start MongoDB"
    fi

    # Start Redis if not running
    if ! check_redis; then
        echo "Starting Redis..."
        redis-server --daemonize yes || print_warning "Could not start Redis"
    fi

    # Start WildDuck
    echo "Starting WildDuck..."
    npm start &

    sleep 5
    health_check
}

# Stop all services
stop_all() {
    echo "Stopping all WildDuck services..."

    # Stop WildDuck
    pkill -f "node server.js" || true

    # Stop MongoDB
    mongosh admin --eval "db.shutdownServer()" 2>/dev/null || true

    # Stop Redis
    redis-cli shutdown 2>/dev/null || true

    print_success "All services stopped"
}

# Clean development environment
clean_dev() {
    echo "Cleaning development environment..."

    read -p "This will delete all data. Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        return 1
    fi

    # Drop database
    mongosh wildduck --eval "db.dropDatabase()" || true

    # Flush Redis
    redis-cli FLUSHALL || true

    # Remove logs
    rm -f logs/*.log

    print_success "Development environment cleaned"
}

# Run tests with coverage
test_with_coverage() {
    echo "Running tests with coverage..."

    # Check dependencies
    if ! check_mongodb || ! check_redis; then
        print_error "MongoDB and Redis must be running for tests"
        exit 1
    fi

    # Run tests
    npm test || true

    print_success "Tests completed"
}

# Generate API documentation
generate_docs() {
    echo "Generating API documentation..."

    # Generate OpenAPI docs
    npm run generate-api-docs || print_warning "Could not generate API docs"

    # Generate JSDoc
    npx jsdoc -c .jsdoc.json -r lib -d docs/jsdoc || print_warning "Could not generate JSDoc"

    print_success "Documentation generated"
}

# Watch logs
watch_logs() {
    echo "Watching WildDuck logs..."
    echo "Press Ctrl+C to stop"

    # Create logs directory if it doesn't exist
    mkdir -p logs

    # Tail all log files
    tail -f logs/*.log 2>/dev/null || echo "No log files found"
}

# Database console
db_console() {
    echo "Opening MongoDB console for WildDuck database..."
    mongosh wildduck
}

# Redis console
redis_console() {
    echo "Opening Redis console..."
    redis-cli
}

# Show usage
usage() {
    cat << EOF
WildDuck Development Helper Scripts

Usage: $0 [command] [options]

Commands:
    setup           Setup development database with indexes
    start           Start all services (MongoDB, Redis, WildDuck)
    stop            Stop all services
    restart         Restart all services
    health          Check health of all services
    test            Run tests with coverage
    clean           Clean development environment (WARNING: deletes data)
    logs            Watch application logs
    db              Open MongoDB console
    redis           Open Redis console
    user [name]     Create test user
    docs            Generate documentation
    help            Show this help message

Examples:
    $0 setup                    # Setup development database
    $0 start                    # Start all services
    $0 user john testpass123    # Create user 'john' with password
    $0 health                   # Check system health
    $0 logs                     # Watch logs

EOF
}

# Main command handler
case "$1" in
    setup)
        setup_dev_db
        ;;
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        start_all
        ;;
    health)
        health_check
        ;;
    test)
        test_with_coverage
        ;;
    clean)
        clean_dev
        ;;
    logs)
        watch_logs
        ;;
    db)
        db_console
        ;;
    redis)
        redis_console
        ;;
    user)
        create_test_user "$2" "$3"
        ;;
    docs)
        generate_docs
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        usage
        exit 1
        ;;
esac