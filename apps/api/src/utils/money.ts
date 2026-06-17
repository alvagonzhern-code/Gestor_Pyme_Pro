export type LineItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTotals(items: LineItemInput[]) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  const taxTotal = roundMoney(
    items.reduce(
      (sum, item) =>
        sum + item.quantity * item.unitPrice * (item.taxRate / 100),
      0,
    ),
  );
  return { subtotal, taxTotal, total: roundMoney(subtotal + taxTotal) };
}
