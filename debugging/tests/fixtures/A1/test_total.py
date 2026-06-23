from total import running_total


def test_running_total_sums():
    assert running_total([1, 2, 3]) == 6
