import sys


def main(path, scale=1.0):
    rows = [line.strip().split(",") for line in open(path)]
    peak = max(float(v) for _, v in rows) or 1.0
    for label, value in rows:
        bar = "#" * int(float(value) / peak * 40 * scale)
        print(f"{label:20} {bar}")


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 1.0)
