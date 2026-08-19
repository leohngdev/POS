/** Venue stubs for Sprint 1. PIN is a local till gate, not a secret store. */
export const VENUE = {
  name: "POS",
  pin: "1234",
  tables: ["01", "02", "03", "04", "05", "06", "07", "08"],
  gstEnabled: false,
  surchargeEnabled: false,
  gstRate: 0.1,
  surchargeRate: 0.1,
  menu: [
    { id: "wagyu", name: "Wagyu bulgogi", unitPrice: 12 },
    { id: "unagi", name: "Unagi tamago", unitPrice: 12 },
    { id: "prawn", name: "Butter prawn", unitPrice: 12 },
    { id: "ssam", name: "SSAM", unitPrice: 12 },
    { id: "pork", name: "Spicy pork bulgogi", unitPrice: 12 },
    { id: "kimchi", name: "Kimchi", unitPrice: 8 },
  ],
};
