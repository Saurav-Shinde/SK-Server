import mongoose from "mongoose";

const ItemMasterSchema = new mongoose.Schema(
  {
    // Raw Excel Columns (DO NOT RENAME)
    "Item Name": { type: String, required: true },
    "UOM": { type: String, required: true },

    "Unit Price(for 1000 GM/1 PC)": { type: Number },
    "IF PRICE NOT FOUND IN SEP-DEC USED OLD ITEM MASTER PRICE": { type: Number },

    "Yield": { type: String, default: "100.00%" }   // stored like "95.00%"
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

//
// ---------- VIRTUAL FIELDS (computed, not stored) ----------
//

// 95.00%  →  95
ItemMasterSchema.virtual("yieldPercent").get(function () {
  if (!this["Yield"]) return 100;
  return parseFloat(this["Yield"].replace("%", "")) || 100;
});

// Price that Excel uses (Column D fallback if Column C missing)
ItemMasterSchema.virtual("priceUsed").get(function () {
  return (
    this["IF PRICE NOT FOUND IN SEP-DEC USED OLD ITEM MASTER PRICE"] ??
    this["Unit Price(for 1000 GM/1 PC)"] ??
    0
  );
});

// Excel Column F: Net Price After Yield
ItemMasterSchema.virtual("netPriceAfterYield").get(function () {
  const yieldPct = this.yieldPercent || 100;
  if (!yieldPct) return 0;
  return this.priceUsed / (yieldPct / 100);
});

// Cost per gram (for kg-based items)
ItemMasterSchema.virtual("costPerGram").get(function () {
  if (this["UOM"].toLowerCase() === "kg") {
    return this.netPriceAfterYield / 1000;
  }
  return null;
});

// Cost per piece
ItemMasterSchema.virtual("costPerPc").get(function () {
  if (this["UOM"].toLowerCase() === "pcs" || this["UOM"].toLowerCase() === "pc") {
    return this.netPriceAfterYield;
  }
  return null;
});

export default mongoose.model("ItemMaster", ItemMasterSchema, "itemmaster_raw");
