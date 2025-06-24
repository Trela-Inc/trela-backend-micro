# TrelaX Core Backend

A microservices-based backend application built with Node.js, Express, and MongoDB.

## 🏗️ Architecture

This project follows a microservices architecture with the following services:

- **Main App**: Core application server
- **Auth Service**: Authentication and authorization
- **Chat Service**: Real-time messaging
- **CMS Service**: Content management
- **CRM Service**: Customer relationship management
- **Notification Service**: Push notifications and emails
- **Project Service**: Project management
- **Property Service**: Property management
- **User Service**: User management

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- Docker and Docker Compose
- MongoDB

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TrelaXCoreBackend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development environment**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   - Main API: http://localhost:6010
   - MongoDB: localhost:27017

## 🔄 CI/CD Pipeline

This project includes a comprehensive CI/CD pipeline using GitHub Actions.

### Pipeline Stages

1. **Lint and Test**
   - Runs on multiple Node.js versions (18.x, 20.x)
   - Executes linting and unit tests
   - Performs security audits

2. **Build Microservices**
   - Builds all microservices in parallel
   - Validates each service independently

3. **Build Docker Images**
   - Builds and pushes Docker images to GitHub Container Registry
   - Creates tagged versions for releases
   - Implements layer caching for faster builds

4. **Deploy to Development**
   - Automatic deployment to development environment
   - Triggers on pushes to `develop` branch
   - Includes health checks

5. **Deploy to Production**
   - Manual deployment to production environment
   - Triggers on pushes to `main` branch
   - Includes rollback capabilities

6. **Security Scanning**
   - Runs Trivy vulnerability scanner
   - Uploads results to GitHub Security tab

### Deployment Environments

#### Development
- **Branch**: `develop`
- **Auto-deploy**: Yes
- **URL**: `https://dev-api.yourdomain.com`

#### Production
- **Branch**: `main`
- **Auto-deploy**: Yes (with approval)
- **URL**: `https://api.yourdomain.com`

### Manual Deployment

Use the deployment script for manual deployments:

```bash
# Deploy to development
./scripts/deploy.sh development

# Deploy to production with specific tag
./scripts/deploy.sh production v1.0.0

# Deploy to production with latest tag
./scripts/deploy.sh production latest
```

## 🐳 Docker

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables
Set the following environment variables for production:

```bash
export REGISTRY=ghcr.io
export IMAGE_NAME=your-org/trelax-core-backend
export TAG=v1.0.0
export MONGO_URI=mongodb://your-mongo-uri
```

## 📊 Monitoring and Health Checks

### Health Check Endpoint
```
GET /health
```

### Metrics Endpoint
```
GET /metrics
```

## 🔒 Security

### Security Features
- Rate limiting (10 requests/second per IP)
- Security headers (XSS protection, CSRF, etc.)
- JWT-based authentication
- Input validation and sanitization
- Dependency vulnerability scanning

### Security Headers
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- X-Content-Type-Options: nosniff
- Referrer-Policy: no-referrer-when-downgrade
- Content-Security-Policy: configured

## 📝 API Documentation

### Swagger Documentation
- Development: http://localhost:6010/api-docs
- Production: https://api.yourdomain.com/api-docs

### Service Endpoints

| Service | Port | Base URL |
|---------|------|----------|
| Main App | 6010 | `/` |
| Auth Service | 6011 | `/auth/` |
| Chat Service | 6012 | `/chat/` |
| CMS Service | 6013 | `/cms/` |
| CRM Service | 6014 | `/crm/` |
| Notification Service | 6015 | `/notifications/` |
| Project Service | 6016 | `/projects/` |
| Property Service | 6017 | `/properties/` |
| User Service | 6018 | `/users/` |

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific service tests
cd services/auth-service && npm test
```

### Test Coverage
- Unit tests: 80% minimum
- Integration tests: All critical paths
- E2E tests: Key user journeys

## 📦 Release Process

### Creating a Release
1. Create and push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. The release workflow will automatically:
   - Build Docker images
   - Create a GitHub release
   - Generate changelog
   - Deploy to production (if approved)

### Versioning
Follows [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Example: `v1.2.3`

## 🔧 Configuration

### Environment Variables
See `env.example` for all available configuration options.

### Key Configuration Files
- `docker-compose.yml` - Development environment
- `docker-compose.prod.yml` - Production environment
- `nginx/nginx.conf` - Load balancer configuration
- `.github/workflows/` - CI/CD workflows

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check what's using the port
   lsof -i :6010
   ```

2. **Docker build failures**
   ```bash
   # Clean Docker cache
   docker system prune -a
   ```

3. **Database connection issues**
   ```bash
   # Check MongoDB status
   docker-compose logs mongo
   ```

### Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Ensure all CI checks pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation and troubleshooting guide
