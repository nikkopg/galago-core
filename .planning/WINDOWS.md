---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-11-02T03:15:55.352Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 05 | deviation | controller/test/staticScan.test.ts | 799 | 05-02 Rule 3: G-04-2 block's renderer pins re-targeted from RunRecoverySection.tsx to the shared components/ui/BoundedRawJson.tsx (the extraction moved the pinned renderer); usage pins stay on the card — intent (exactly one bounded display) preserved | open |  | 2026-11-02T03:15:55.352Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "05",
    "file": "controller/test/staticScan.test.ts",
    "line": 799,
    "description": "05-02 Rule 3: G-04-2 block's renderer pins re-targeted from RunRecoverySection.tsx to the shared components/ui/BoundedRawJson.tsx (the extraction moved the pinned renderer); usage pins stay on the card — intent (exactly one bounded display) preserved",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-02T03:15:55.352Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
