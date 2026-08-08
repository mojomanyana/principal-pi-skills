---
description: DEPRECATED alias for /principal-bugfix. Same workflow; the namespaced command is the supported one.
---
`/bugfix` is a deprecated alias kept so existing muscle memory and scripts keep working.
`bugfix` is a name any installed package can claim, and whichever loads last wins silently,
so the supported command is `/principal-bugfix`.

Run `/principal-bugfix` for: $@

Execute that workflow exactly as written — it is the single definition of the bug spine, and
this file deliberately does not restate its steps. A copy here is a second place for the
workflow to drift, which is the failure this rename exists to prevent.

Mention once, in the closing digest, that `/bugfix` is deprecated and `/principal-bugfix` is
the command to use. Once — not per step, and never instead of doing the work.
