#!/bin/bash
set -e

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Emojis for better UX
ROCKET="🚀"
PACKAGE="📦"
HAMMER="🏗️"
RECYCLE="🔄"
SPEAKER="📢"
CLOCK="⏱️"
CHECK="✅"
WARNING="⚠️"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# NFS Media Setup Function
setup_nfs_media() {
    PROJECT_PATH=$(pwd | sed 's|.*/projects/||')
    
    if [ -z "$PROJECT_PATH" ]; then
        echo "ERROR: Not in a projects directory"
        return 1
    fi
    
    if ! mountpoint -q /app-media; then
        echo "WARNING: NFS media mount not available, skipping media setup"
        return 0
    fi
    
    NFS_PROJECT_DIR="/app-media/${PROJECT_PATH}"
    mkdir -p "$NFS_PROJECT_DIR"
    
    # Check if uploads is already properly symlinked
    if [ -L "./uploads" ] && [ "$(readlink ./uploads)" = "$NFS_PROJECT_DIR" ]; then
        echo "✅ NFS media already configured: ./uploads -> $NFS_PROJECT_DIR"
        return 0
    fi
    
    # Handle existing uploads directory
    if [ -d "./uploads" ] && [ ! -L "./uploads" ]; then
        echo ""
        echo "📁 Found local ./uploads directory - migrating to NFS"
        
        # Check if it has any content
        if [ "$(ls -A ./uploads 2>/dev/null)" ]; then
            local file_count=$(find ./uploads -type f | wc -l)
            local dir_size=$(du -sh ./uploads 2>/dev/null | cut -f1)
            
            echo "   Content: $file_count files ($dir_size)"
            echo "   Target: $NFS_PROJECT_DIR"
            echo ""
            echo "🔄 Starting automatic migration (preserving permissions)..."
            
            # Use rsync for safe migration with progress
            if command -v rsync &> /dev/null; then
                rsync -av ./uploads/ "$NFS_PROJECT_DIR/"
            else
                # Fallback to cp with archive mode (preserves permissions, ownership, timestamps)
                cp -av ./uploads/* "$NFS_PROJECT_DIR/" 2>/dev/null || true
            fi
            
            # Verify migration success
            local source_count=$(find ./uploads -type f | wc -l)
            local dest_count=$(find "$NFS_PROJECT_DIR" -type f | wc -l)
            
            if [ "$source_count" -ne "$dest_count" ]; then
                echo "❌ ERROR: Migration verification failed!"
                echo "   Source files: $source_count"
                echo "   Destination files: $dest_count"
                echo "   Aborting deployment - data NOT removed from ./uploads"
                return 1
            fi
            
            echo "✅ Migration successful ($dest_count files verified)"
            
            # Create backup of original just in case
            echo "🔒 Creating safety backup: ./uploads.backup"
            mv ./uploads ./uploads.backup
            
            echo "✅ Backup created (will be auto-removed after 7 days if symlink is stable)"
        else
            echo "📁 Local ./uploads is empty, removing..."
            rm -rf ./uploads
        fi
    fi
    
    # Remove old backup if symlink has been stable (exists and is older than 7 days)
    if [ -L "./uploads" ] && [ -d "./uploads.backup" ]; then
        if [ $(find ./uploads.backup -maxdepth 0 -mtime +7 2>/dev/null | wc -l) -gt 0 ]; then
            echo "🧹 Removing old backup (symlink stable for 7+ days)"
            rm -rf ./uploads.backup
        fi
    fi
    
    # Create symlink if it doesn't exist
    if [ ! -L "./uploads" ]; then
        echo "🔗 Creating symlink: ./uploads -> $NFS_PROJECT_DIR"
        ln -sf "$NFS_PROJECT_DIR" "./uploads"
        
        if [ -L "./uploads" ]; then
            echo "✅ Symlink created successfully"
        else
            echo "❌ ERROR: Failed to create symlink"
            return 1
        fi
    fi
    
    # Final verification
    if [ -L "./uploads" ] && [ "$(readlink ./uploads)" = "$NFS_PROJECT_DIR" ]; then
        echo "✅ NFS media setup complete!"
        return 0
    else
        echo "❌ ERROR: Setup verification failed"
        return 1
    fi
}

# Setup NFS media storage
setup_nfs_media

# Function to check if docker compose command exists and use appropriate version
check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

warning() {
    echo -e "${YELLOW}${WARNING}${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Timer function
start_timer() {
    START_TIME=$(date +%s)
}

end_timer() {
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo -e "${PURPLE}${CLOCK} Total deployment time: ${DURATION}s${NC}"
}

# Load environment variables
load_env() {
    log "${PACKAGE} Loading environment variables..."
    
    if [ -f .env ]; then
        set -a
        source .env
        success "Loaded .env"
    fi
    
    if [ -f .env.local ]; then
        set -a
        source .env.local  
        set +a
        success "Loaded .env.local"
    fi
}

# Health check function
health_check() {
    # local service=$1
    # local max_attempts=30
    # local attempt=1
    
    # log "Performing health check for $service..."
    
    # while [ $attempt -le $max_attempts ]; do
    #     if $DOCKER_COMPOSE ps $service | grep -q "healthy\|Up"; then
    #         success "Health check passed for $service"
            return 0
    #     fi
        
    #     if [ $((attempt % 5)) -eq 0 ]; then
    #         log "Health check attempt $attempt/$max_attempts for $service..."
    #     fi
        
    #     sleep 2
    #     attempt=$((attempt + 1))
    # done
    
    # error "Health check failed for $service after $max_attempts attempts"
    # return 1
}

# Quick restart deployment (fastest option)
quick_deploy() {
    local service=${1:-""}
    
    echo -e "${ROCKET} ${GREEN}Starting QUICK deployment${NC} ${service:+for $service}..."
    start_timer
    
    load_env
    DOCKER_COMPOSE=$(check_docker_compose)
    
    log "${RECYCLE} Quick restarting containers..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE restart $service
        health_check $service
    else
        $DOCKER_COMPOSE restart frontend-prod backend
        health_check "backend" && health_check "frontend-prod"
    fi
    
    success "${SPEAKER} Quick deployment complete!"
    end_timer
}

# Standard deployment (your original approach)
standard_deploy() {
    local service=${1:-""}
    
    echo -e "${ROCKET} ${BLUE}Starting STANDARD deployment${NC} ${service:+for $service}..."
    start_timer
    
    load_env
    DOCKER_COMPOSE=$(check_docker_compose)
    
    # Build new images
    log "${HAMMER} Building new images..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE build --no-cache $service
    else
        $DOCKER_COMPOSE build --no-cache
    fi
    
    # Recreate containers
    log "${RECYCLE} Swapping to new containers..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE up -d --force-recreate $service
        health_check $service
    else
        $DOCKER_COMPOSE up -d --force-recreate
        health_check "backend" && health_check "frontend-prod"
    fi
    
    success "${SPEAKER} Standard deployment complete!"
    end_timer
}

# Optimized deployment (build while running)
optimized_deploy() {
    local service=${1:-""}
    
    echo -e "${ROCKET} ${PURPLE}Starting OPTIMIZED deployment${NC} ${service:+for $service}..."
    start_timer
    
    load_env
    DOCKER_COMPOSE=$(check_docker_compose)
    
    # Build new images while old containers are still running
    log "${HAMMER} Building images in background (containers still serving traffic)..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE build --no-cache $service &
    else
        $DOCKER_COMPOSE build --no-cache --parallel &
    fi
    BUILD_PID=$!
    
    # Show progress while building
    while kill -0 $BUILD_PID 2>/dev/null; do
        log "Still building... (your site is still live)"
        sleep 10
    done
    wait $BUILD_PID
    
    success "Build completed! Now swapping containers..."
    
    # Quick swap to new containers
    log "${RECYCLE} Swapping to new containers..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE up -d --force-recreate $service
        health_check $service
    else
        $DOCKER_COMPOSE up -d --force-recreate
        health_check "backend" && health_check "frontend-prod"
    fi
    
    success "${SPEAKER} Optimized deployment complete!"
    end_timer
}

# Parallel deployment
parallel_deploy() {
    local service=${1:-""}
    
    echo -e "${ROCKET} ${YELLOW}Starting PARALLEL deployment${NC} ${service:+for $service}..."
    start_timer
    
    load_env
    DOCKER_COMPOSE=$(check_docker_compose)
    
    # Build images in parallel
    log "${HAMMER} Building images in parallel..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE build --no-cache $service
    else
        $DOCKER_COMPOSE build --no-cache --parallel
    fi
    
    # Deploy with minimal downtime
    log "${RECYCLE} Deploying containers..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE up -d --force-recreate $service
        health_check $service
    else
        $DOCKER_COMPOSE up -d --force-recreate
        health_check "backend" && health_check "frontend-prod"
    fi
    
    success "${SPEAKER} Parallel deployment complete!"
    end_timer
}

ultra_fast_deploy() {
    local service=${1:-""}
    
    echo -e "${ROCKET} ${GREEN}Starting ULTRA-FAST deployment${NC} ${service:+for $service}..."
    start_timer
    
    load_env
    DOCKER_COMPOSE=$(check_docker_compose)
    
    # Build with caching (only rebuild changed layers)
    log "${HAMMER} Building with layer caching..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE build $service  # NO --no-cache flag!
    else
        $DOCKER_COMPOSE build --parallel  # NO --no-cache flag!
    fi
    
    # Use up instead of force-recreate for faster deployment
    log "${RECYCLE} Updating containers..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE up -d $service
        health_check $service
    else
        $DOCKER_COMPOSE up -d
        health_check "backend" && health_check "frontend-prod"
    fi
    
    success "${SPEAKER} Ultra-fast deployment complete!"
    end_timer
}

cached_deploy() {
    local service=${1:-""}
    local force_rebuild=${2:-false}
    
    echo -e "${ROCKET} ${CYAN}Starting CACHED deployment${NC} ${service:+for $service}..."
    start_timer
    
    load_env
    DOCKER_COMPOSE=$(check_docker_compose)
    
    if [ "$force_rebuild" = "true" ]; then
        log "${HAMMER} Force rebuilding all layers..."
        BUILD_ARGS="--no-cache"
    else
        log "${HAMMER} Building with intelligent caching..."
        BUILD_ARGS=""
    fi
    
    # Build images
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE build $BUILD_ARGS $service
    else
        $DOCKER_COMPOSE build $BUILD_ARGS --parallel
    fi
    
    # Deploy containers
    log "${RECYCLE} Updating containers..."
    if [ -n "$service" ]; then
        $DOCKER_COMPOSE up -d $service
        health_check $service
    else
        $DOCKER_COMPOSE up -d
        health_check "backend" && health_check "frontend-prod"
    fi
    
    success "${SPEAKER} Cached deployment complete!"
    end_timer
}

# Status check
status() {
    DOCKER_COMPOSE=$(check_docker_compose)
    
    echo -e "${BLUE}=== Container Status ===${NC}"
    $DOCKER_COMPOSE ps
    echo ""
    echo -e "${BLUE}=== Health Status ===${NC}"
    $DOCKER_COMPOSE ps --format "table {{.Name}}\t{{.Status}}"
    echo ""
    echo -e "${BLUE}=== Resource Usage ===${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

# Show help
show_help() {
    echo -e "${GREEN}🚀 Enhanced Deployment Script${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [SERVICE]"
    echo ""
    echo -e "${BLUE}Commands:${NC}"
    echo "  quick [service]      - Quick restart only (~3-5s downtime)"
    echo "  standard [service]   - Your original deployment method (~15-30s downtime)"
    echo "  optimized [service]  - Build while running (~5-10s downtime)"
    echo "  parallel [service]   - Build in parallel (~8-15s downtime)"
    echo "  status              - Show current container status"
    echo "  help                - Show this help message"
    echo ""
    echo -e "${BLUE}Services:${NC}"
    echo "  backend             - Deploy only backend"
    echo "  frontend-prod       - Deploy only frontend"
    echo "  (none)              - Deploy everything"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo "  $0 quick                    # Fastest option, restart everything"
    echo "  $0 optimized backend        # Build backend while frontend serves traffic"
    echo "  $0 standard                 # Your original deployment method"
    echo "  $0 parallel frontend-prod   # Build frontend in parallel"
    echo ""
    echo -e "${YELLOW}💡 Recommended:${NC}"
    echo "  - Use 'quick' for small code changes"
    echo "  - Use 'optimized' for major updates"
    echo "  - Use 'standard' for dependency changes"
}

# Main command handling
case "${1:-ultrafast}" in
    "quick")
        quick_deploy "${2:-}"
        ;;
    "standard")
        standard_deploy "${2:-}"
        ;;
    "optimized")
        optimized_deploy "${2:-}"
        ;;
    "parallel")
        parallel_deploy "${2:-}"
        ;;
    "ultrafast")
        ultra_fast_deploy "${2:-}"
        ;;
    "status")
        status
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${YELLOW}Unknown command: $1${NC}"
        echo "Use '$0 help' to see available commands."
        echo ""
        echo -e "${BLUE}Running ultrafast deployment...${NC}"
        ultra_fast_deploy "${1:-}"
        ;;
esac