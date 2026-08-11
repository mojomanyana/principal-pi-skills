---
description: DEPRECATED alias for /principal-feature. Same workflow; the namespaced command is the supported one.
---
`/feature` is a deprecated alias kept so existing muscle memory and scripts keep working.
`feature` is a name any installed package can claim, and whichever loads last wins silently,
so the supported command is `/principal-feature`.

Run `/principal-feature` for: $@

Execute that workflow exactly as written — it is the single definition of the feature spine,
and this file deliberately does not restate its steps. A copy here is a second place for the
workflow to drift, which is the failure this rename exists to prevent.

Mention once, in the closing digest, that `/feature` is deprecated and `/principal-feature`
is the command to use. Once — not per step, and never instead of doing the work.
