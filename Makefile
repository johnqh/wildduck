# WildDuck Makefile for Development
# This Makefile provides convenient commands for development tasks

.PHONY: help install dev test clean lint docs health setup start stop restart db redis logs user api-test

# Default target
help:
	@echo "WildDuck Development Commands"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install     - Install dependencies"
	@echo "  make setup       - Setup development environment"
	@echo "  make clean       - Clean build artifacts and logs"
	@echo ""
	@echo "Development:"
	@echo "  make dev         - Start development server"
	@echo "  make start       - Start all services"
	@echo "  make stop        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo "  make logs        - Watch server logs"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test        - Run test suite"
	@echo "  make lint        - Run ESLint"
	@echo "  make lint-fix    - Fix linting issues"
	@echo "  make api-test    - Test API endpoints"
	@echo ""
	@echo "Database:"
	@echo "  make db          - Open MongoDB console"
	@echo "  make redis       - Open Redis console"
	@echo "  make db-indexes  - Create database indexes"
	@echo "  make db-clean    - Clean database (WARNING: deletes data)"
	@echo ""
	@echo "Documentation:"
	@echo "  make docs        - Generate all documentation"
	@echo "  make api-docs    - Generate API documentation"
	@echo ""
	@echo "Utilities:"
	@echo "  make health      - Check system health"
	@echo "  make user        - Create test user"
	@echo "  make config      - Show current configuration"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@npm install
	@echo "✅ Dependencies installed"

# Development server
dev:
	@echo "🚀 Starting development server..."
	@npm start

# Start all services
start:
	@echo "🚀 Starting all services..."
	@bash scripts/dev-helpers.sh start

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	@bash scripts/dev-helpers.sh stop

# Restart services
restart:
	@echo "🔄 Restarting services..."
	@bash scripts/dev-helpers.sh restart

# Setup development environment
setup:
	@echo "🔧 Setting up development environment..."
	@mkdir -p logs data/db
	@chmod +x scripts/dev-helpers.sh
	@bash scripts/dev-helpers.sh setup
	@echo "✅ Setup complete"

# Run tests
test:
	@echo "🧪 Running tests..."
	@npm test

# Lint code
lint:
	@echo "🔍 Linting code..."
	@npx eslint lib/**/*.js

# Fix linting issues
lint-fix:
	@echo "🔧 Fixing linting issues..."
	@npx eslint lib/**/*.js --fix

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf node_modules
	@rm -rf logs/*.log
	@rm -f package-lock.json
	@echo "✅ Clean complete"

# Generate documentation
docs:
	@echo "📚 Generating documentation..."
	@npm run apidoc
	@npm run generate-api-docs
	@echo "✅ Documentation generated"

# Generate API documentation
api-docs:
	@echo "📚 Generating API documentation..."
	@npm run generate-api-docs

# Health check
health:
	@echo "🏥 Checking system health..."
	@bash scripts/dev-helpers.sh health

# Database console
db:
	@echo "🗄️ Opening MongoDB console..."
	@mongosh wildduck

# Redis console
redis:
	@echo "📮 Opening Redis console..."
	@redis-cli

# Create database indexes
db-indexes:
	@echo "🗂️ Creating database indexes..."
	@mongosh wildduck --eval 'load("indexes.js")'

# Clean database (WARNING: destructive)
db-clean:
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		mongosh wildduck --eval "db.dropDatabase()"; \
		redis-cli FLUSHALL; \
		echo "✅ Database cleaned"; \
	else \
		echo "❌ Cancelled"; \
	fi

# Watch logs
logs:
	@echo "📋 Watching logs..."
	@mkdir -p logs
	@tail -f logs/*.log 2>/dev/null || echo "No log files found. Start the server first."

# Create test user
user:
	@echo "👤 Creating test user..."
	@curl -X POST http://localhost:8080/users \
		-H "Content-Type: application/json" \
		-d '{"username":"testuser","password":"testpass","address":"testuser@localhost","quota":1073741824}' \
		|| echo "❌ Could not create user. Is the API server running?"

# Show configuration
config:
	@echo "⚙️  Current configuration:"
	@npm run show

# Test API endpoints
api-test:
	@echo "🧪 Testing API endpoints..."
	@echo "Testing health endpoint..."
	@curl -s http://localhost:8080/health | python3 -m json.tool || echo "API server not responding"
	@echo ""
	@echo "Testing users endpoint..."
	@curl -s http://localhost:8080/users | python3 -m json.tool || echo "Could not fetch users"

# Development environment with auto-restart
dev-watch:
	@echo "👁️ Starting development server with auto-restart..."
	@npx nodemon server.js

# Run specific test file
test-file:
	@echo "🧪 Running specific test file..."
	@read -p "Enter test file path: " filepath; \
	npx mocha $$filepath

# Generate test coverage report
coverage:
	@echo "📊 Generating test coverage report..."
	@npx nyc npm test
	@npx nyc report --reporter=html
	@echo "✅ Coverage report generated in coverage/index.html"

# Check for security vulnerabilities
security:
	@echo "🔒 Checking for security vulnerabilities..."
	@npm audit

# Update dependencies
update-deps:
	@echo "📦 Updating dependencies..."
	@npx npm-check-updates -u
	@npm install
	@echo "✅ Dependencies updated"

# Docker build
docker-build:
	@echo "🐳 Building Docker image..."
	@docker build -t wildduck:dev .

# Docker run
docker-run:
	@echo "🐳 Running Docker container..."
	@docker-compose up -d

# Docker stop
docker-stop:
	@echo "🐳 Stopping Docker container..."
	@docker-compose down

# Performance profiling
profile:
	@echo "📊 Starting performance profiling..."
	@node --inspect server.js

# Memory analysis
memory:
	@echo "🧠 Analyzing memory usage..."
	@node --expose-gc --trace-gc server.js

# Quick development setup (install + setup + start)
quick-start: install setup start
	@echo "🎉 WildDuck is ready for development!"
	@echo "API: http://localhost:8080"
	@echo "IMAP: localhost:143"
	@echo "POP3: localhost:110"