class GatewayError(Exception):
    pass


class _PaymentGateway:
    def charge(self, amount):
        raise GatewayError("gateway timeout")   # the gateway can fail


payment_gateway = _PaymentGateway()


class Order:
    def __init__(self, total):
        self.total = total
        self.paid = False

    def mark_paid(self, txn_id):
        self.paid = True
        self.txn_id = txn_id


def charge(order):
    resp = payment_gateway.charge(order.total)   # can raise GatewayError
    order.mark_paid(resp.id)
