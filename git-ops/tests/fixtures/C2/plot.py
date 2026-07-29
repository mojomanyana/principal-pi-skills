import sys


def main(path):
    rows = [line.strip().split(",") for line in open(path)]
    for label, value in rows:
        print(f"{label:20} {'#' * int(float(value))}")


if __name__ == "__main__":
    main(sys.argv[1])
