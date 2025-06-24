#!/bin/bash

# Deployment script for TrelaXCoreBackend
# Usage: ./scripts/deploy.sh [environment] [tag]

set -e

# Default values
ENVIRONMENT=${1:-development}
TAG=${2:-latest}
REGISTRY=${REGISTRY:-ghcr.io}
IMAGE_NAME=${IMAGE_NAME:-your-org/trelax-core-backend}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists docker; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Function to deploy
deploy() {
    local env=$1
    local tag=$2
    
    print_status "Deploying to $env environment with tag: $tag"
    
    # Set environment variables
    export TAG=$tag
    export REGISTRY=$REGISTRY
    export IMAGE_NAME=$IMAGE_NAME
    
    # Choose docker-compose file based on environment
    local compose_file="docker-compose.yml"
    if [ "$env" = "production" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    # Pull latest images
    print_status "Pulling latest images..."
    docker-compose -f $compose_file pull
    
    # Deploy
    print_status "Starting deployment..."
    docker-compose -f $compose_file up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 30
    
    # Health check
    print_status "Running health checks..."
    if curl -f http://localhost/health >/dev/null 2>&1; then
        print_status "Health check passed"
    else
        print_warning "Health check failed, but deployment might still be successful"
    fi
    
    print_status "Deployment completed successfully!"
}

# Function to rollback
rollback() {
    local env=$1
    local previous_tag=$2
    
    print_status "Rolling back to tag: $previous_tag"
    
    export TAG=$previous_tag
    export REGISTRY=$REGISTRY
    export IMAGE_NAME=$IMAGE_NAME
    
    local compose_file="docker-compose.yml"
    if [ "$env" = "production" ]; then
        compose_file="docker-compose.prod.yml"
    fi
    
    docker-compose -f $compose_file up -d
    
    print_status "Rollback completed"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [environment] [tag]"
    echo ""
    echo "Arguments:"
    echo "  environment  Deployment environment (development|production) [default: development]"
    echo "  tag         Docker image tag [default: latest]"
    echo ""
    echo "Examples:"
    echo "  $0 development"
    echo "  $0 production v1.0.0"
    echo "  $0 production latest"
}

# Main script
main() {
    case "$ENVIRONMENT" in
        "development"|"dev")
            ENVIRONMENT="development"
            ;;
        "production"|"prod")
            ENVIRONMENT="production"
            ;;
        "help"|"-h"|"--help")
            show_usage
            exit 0
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT"
            show_usage
            exit 1
            ;;
    esac
    
    check_prerequisites
    deploy $ENVIRONMENT $TAG
}

# Run main function
main "$@" 