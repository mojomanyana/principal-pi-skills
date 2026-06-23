# worker.py — 4 threads each add 100 items to a shared list; len(results) is sometimes < 400.
import threading

results = []


def worker():
    global results
    for _ in range(100):
        results = results + [1]   # read + concat + rebind: not atomic across threads


def run():
    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return len(results)   # expected 400, often fewer under contention
