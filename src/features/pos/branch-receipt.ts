/**
 * What a receipt prints about the branch that made the sale (Settings →
 * Branches). The Khmer name comes first, as on the shop's invoices. Empty
 * values are left to the caller's shop-wide defaults.
 */
export function branchReceipt(branch?: Record<string, unknown>) {
  const text = (key: string) => String(branch?.[key] ?? "").trim();
  return {
    name: text("nameKm") || text("name"),
    logo: text("logo"),
    address: [text("address"), text("city"), text("country")]
      .filter(Boolean)
      .join(", "),
    phone: text("phone"),
    vat: text("vat"),
    footer: text("invoiceFooter"),
  };
}
