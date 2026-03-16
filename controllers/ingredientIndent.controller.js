import IngredientIndent from "../models/ingredientIndent.js";

export const createIndent = async (req, res) => {
  try {
    const { recipeId, recipeKind, recipeName, branchCode, items } = req.body || {};

    if (!recipeId || !recipeKind || !branchCode || !Array.isArray(items)) {
      return res.status(400).json({ message: "recipeId, recipeKind, branchCode, items[] are required" });
    }
    if (!["main", "sub"].includes(recipeKind)) {
      return res.status(400).json({ message: "recipeKind must be main or sub" });
    }

    const docs = items
      .map((r) => ({
        recipeId,
        recipeKind,
        recipeName: String(recipeName || ""),
        branchCode: String(branchCode).trim(),
        skuCode: String(r.skuCode || ""),
        itemName: String(r.itemName || "").trim(),
        categoryName: String(r.categoryName || ""),
        uom: String(r.uom || ""),
        qty: Number(r.qty || 0),
        cost: Number(r.cost || 0),
        status: "INDENT_PENDING",
      }))
      .filter((d) => d.itemName);

    if (docs.length === 0) {
      return res.status(400).json({ message: "No valid items to indent" });
    }

    const created = await IngredientIndent.insertMany(docs, { ordered: false });
    return res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) {
    console.error("Create indent error:", err?.message || err);
    return res.status(500).json({ message: "Failed to create indent" });
  }
};

export const listIndent = async (req, res) => {
  try {
    const { status } = req.query;
    const q = {};
    if (status) q.status = status;

    const list = await IngredientIndent.find(q).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: list });
  } catch (err) {
    console.error("List indent error:", err?.message || err);
    return res.status(500).json({ message: "Failed to fetch indent list" });
  }
};

export const verifyIndentItem = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await IngredientIndent.findById(id);
    if (!doc) return res.status(404).json({ message: "Indent item not found" });

    if (doc.status === "ISSUED") {
      return res.status(400).json({ message: "Already issued" });
    }

    doc.status = "INDENT_VERIFIED";
    doc.verifiedAt = new Date();
    await doc.save();

    return res.json({ success: true });
  } catch (err) {
    console.error("Verify indent error:", err?.message || err);
    return res.status(500).json({ message: "Failed to verify indent item" });
  }
};

export const issueIndentItem = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await IngredientIndent.findById(id);
    if (!doc) return res.status(404).json({ message: "Indent item not found" });

    if (doc.status !== "INDENT_VERIFIED") {
      return res.status(400).json({ message: "Item must be verified before issuing" });
    }

    doc.status = "ISSUED";
    doc.issuedAt = new Date();
    await doc.save();

    return res.json({ success: true });
  } catch (err) {
    console.error("Issue indent error:", err?.message || err);
    return res.status(500).json({ message: "Failed to issue indent item" });
  }
};

