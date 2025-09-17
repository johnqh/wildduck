# API Configuration

The WildDuck API server configuration is located in `config/api.toml`. 

## Host Binding

By default, the API server binds to all network interfaces (`host = "0.0.0.0"`), which is suitable for:
- Docker/container deployments
- Production servers with reverse proxies
- Multi-server setups

### Development Configuration

For local development and integration testing, you may want to use `config/api-dev.toml` which binds to localhost only (`host = "127.0.0.1"`):

```bash
# Start API server with development config
node api.js --config=config/api-dev.toml
```

## CORS Configuration

CORS (Cross-Origin Resource Sharing) is enabled by default with all origins allowed:

```toml
[cors]
origins = ["*"]
```

### Production CORS Setup

For production environments, restrict CORS to specific domains:

```toml
[cors]
origins = ["https://yourdomain.com", "https://app.yourdomain.com"]
```

## Environment-Specific Configurations

| Environment | Config File | Host Binding | CORS | Access Control |
|-------------|-------------|--------------|------|----------------|
| Production | `api.toml` | `0.0.0.0` | Restricted | Enabled |
| Development | `api-dev.toml` | `127.0.0.1` | All origins | Disabled |
| Docker | `api.toml` | `0.0.0.0` | All origins | Enabled |

## Examples

### Local development:
```bash
# Use development config for localhost-only access
node api.js --config=config/api-dev.toml
```

### Docker deployment:
```bash
# Use default config for container access
node api.js --config=config/api.toml
```

### Production with specific domains:
Edit `config/api.toml`:
```toml
[cors]
origins = ["https://yourfrontend.com"]
```

This configuration ensures the API works correctly in different deployment scenarios while maintaining security best practices.