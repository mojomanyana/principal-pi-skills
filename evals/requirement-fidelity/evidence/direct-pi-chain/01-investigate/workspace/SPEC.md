# Admission authority
LIMIT-1: permit(count) MUST allow integer Count values from 0 through 3 inclusive and reject every other input without coercion.
QUAL-1 (Gate): Before qualification, execute boundary tests for -1, 0, 3, 4 and malformed inputs including strings, null, NaN and fractions on the actual candidate.
Definition: definitions.md#Count is normative. SUMMARY.md is discovery guidance, not authority.
