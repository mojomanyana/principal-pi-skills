export class GatewayError extends Error {}

export const paymentGateway = {
  charge(total: number): { id: string } {
    if (total > 100) {
      throw new GatewayError("declined");
    }
    return { id: "tx_" + total };
  },
};

export interface Order {
  total: number;
  paidId: string | null;
  failedReason: string | null;
  markPaid(id: string): void;
  markFailed(reason: string): void;
}

export function charge(order: Order): void {
  const resp = paymentGateway.charge(order.total); // can throw GatewayError
  order.markPaid(resp.id);
}
