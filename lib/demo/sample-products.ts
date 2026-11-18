// OFFLINE SAMPLE DATA — invented products, not Shopify listings.
// Used only when the live catalog can't be reached, so a demo never dead-ends.
// Shopify's guidelines don't allow storing real catalog results long term, so the
// fallback is made up and labelled as such in the UI.

import type { CatalogProduct } from "../shopify/catalog";

const shop = (name: string) => ({ name, domain: "" });
const v = (id: string, title: string, amount: number, s: string, optionText = "") => ({
  id,
  title,
  optionText,
  price: { amount, currency: "CAD" },
  available: true,
  seller: shop(s),
});

export const SAMPLE_PRODUCTS: (CatalogProduct & { interest: string; shippingText: string })[] = [
  {
    id: "sample:teaset",
    title: "Blue-and-white porcelain tea set for 6",
    description: "Hand-painted porcelain teapot with six cups.",
    features: [],
    optionsText: "",
    variants: [v("sample:teaset:1", "Default", 6800, "Sample ceramics studio")],
    interest: "Oolong tea",
    shippingText: "2 to 4 business days",
  },
  {
    id: "sample:planter",
    title: "Red glazed planter with herb seeds",
    description: "Glazed stoneware planter with basil, chive and mint seeds.",
    features: [],
    optionsText: "",
    variants: [v("sample:planter:1", "Default", 5400, "Sample garden shop")],
    interest: "Balcony garden",
    shippingText: "15 to 25 business days",
  },
  {
    id: "sample:brush",
    title: "Calligraphy brush and ink stone set",
    description: "Three wolf-hair brushes, ink stick and stone.",
    features: [],
    optionsText: "",
    variants: [v("sample:brush:1", "Default", 7200, "Sample art supply shop")],
    interest: "Calligraphy",
    shippingText: "",
  },
  {
    id: "sample:clock",
    title: "Walnut desk clock",
    description: "Silent sweep movement.",
    features: [],
    optionsText: "",
    variants: [v("sample:clock:1", "Default", 6000, "Sample home goods")],
    interest: "Calligraphy",
    shippingText: "3 to 5 business days",
  },
  {
    id: "sample:cups",
    title: "Celadon tea cups, set of 4",
    description: "Four celadon cups.",
    features: [],
    optionsText: "",
    variants: [v("sample:cups:1", "Default", 5200, "Sample ceramics studio")],
    interest: "Oolong tea",
    shippingText: "2 to 4 business days",
  },
];
