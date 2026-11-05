# The report's shape

Read this before writing the report, in every mode that writes one.

```
## UI verification: <what changed>

Verified at: <the URL actually loaded>

### Observed
- <state>: <what the snapshot/screenshot actually showed>

### Not observed
- <state>: <why — unreachable without fixture data, needs auth, no browser tool>

### Findings
- <path:line or component> — what renders wrong, and the evidence you saw

### Console / network
- <errors and warnings, verbatim, with the page they came from>  |  clean
```
