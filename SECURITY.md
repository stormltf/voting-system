# Security Considerations

## Known Vulnerabilities

### xlsx (SheetJS) Library - HIGH Risk

The project uses `xlsx@0.18.5` which has known vulnerabilities:
- **Prototype Pollution** (CVE-2023-30533)
- **ReDoS** (Regular Expression Denial of Service)

#### Mitigation Recommendations

1. **Input Validation**: The application already validates file types and sizes before processing
2. **Sandboxed Processing**: Consider running Excel parsing in an isolated environment
3. **Migration Option**: Consider migrating to `exceljs` which is actively maintained:
   ```bash
   npm uninstall xlsx
   npm install exceljs
   ```

#### Temporary Mitigations Applied
- File size limit: 5MB maximum
- File type validation: Only .xlsx, .xls, .csv allowed
- MIME type checking enabled

## Deployment Security

### Environment Variables

**NEVER commit real credentials.** The following files contain default values for development only:

- `docker-compose.yml` - Uses `${VAR:-default}` syntax for defaults
- `.env.example` - Template file, copy to `.env` and customize

Required production environment variables:
```
MYSQL_ROOT_PASSWORD=<strong-random-password>
MYSQL_PASSWORD=<strong-random-password>
JWT_SECRET=<cryptographically-secure-random-string>
```

### JWT Token Storage

Current implementation stores JWT in localStorage. For enhanced security in production:
- Consider using HttpOnly cookies
- Implement CSRF protection if using cookies
- Use short token expiration with refresh tokens

### CORS Policy

Production deployments should restrict CORS origins to specific domains rather than wildcards.

## Reporting Security Issues

Please report security vulnerabilities by opening a private issue or contacting the maintainers directly.
