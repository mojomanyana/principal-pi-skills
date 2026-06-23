from parity import is_even


def test_is_even():
    assert is_even(4) is True
    assert is_even(3) is False
