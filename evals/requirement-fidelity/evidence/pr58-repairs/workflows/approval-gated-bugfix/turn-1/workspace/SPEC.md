# Parser authority
PARSE-1: parseCount MUST accept only an entire nonempty ASCII decimal digit string, returning its numeric value when it is a safe integer. Otherwise it MUST throw TypeError('invalid count'). Whitespace, signs, suffixes, fractions, nonstrings and unsafe integers are invalid. Leading zeros are permitted.
QUAL-P (Gate): reject '3x', '', ' 3', '-1', '1.5', null, and '9007199254740992'; accept '0', '03', and '3'.
