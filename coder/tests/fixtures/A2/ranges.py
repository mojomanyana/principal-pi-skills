def slice_range(xs, start, end):
    return xs[start:end]   # bug: should include the end index


def format_date(d):
    return f"{d.month}/{d.day}/{d.year}"   # (separately: no zero-padding)
