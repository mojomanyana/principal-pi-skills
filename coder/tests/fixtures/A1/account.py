class Account:
    def __init__(self):
        self.balance = 0

    def deposit(self, amount):
        self.balance += amount
