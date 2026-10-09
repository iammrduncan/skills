# Proposal: a plugin system for date formatting

Two places in the CLI format a date differently — `project status` shows "3 minutes ago", and the
build log shows an ISO timestamp.

Proposal: a `DateFormatterRegistry` with a plugin interface, a resolution order, per-workspace
config in the manifest, and a fallback chain. Formatters register at startup. This gives us the
flexibility to add locale support later, and third parties could ship their own formatters.

Estimated 6 files, ~400 lines, plus config schema changes.
