# Systems Navigator Revenue Dashboard — test

Static test deployment of the Systems Navigator revenue analysis tool.

## Data handling during the test phase

- No invoice data is stored in this GitHub repository.
- Imported Excel/CSV data is processed in the browser and stored in the browser's IndexedDB.
- Backup/restore files are created and read locally by the browser.
- The site itself is public during this static test phase, so do not treat access to the URL as authentication.

## Production direction

For the multi-user production version, use authenticated access and a central database with role-based permissions and audit logging.
