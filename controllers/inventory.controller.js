import { ristaClient } from "../ristaClient.js";

export const getInventoryItems = async (req, res) => {
  try {
    const { branchCode } = req.query;

    if (!branchCode) {
      return res.status(400).json({
        message: "branchCode is required",
      });
    }
 
    // IMPORTANT:
    // Rista expects `x-api-token` to be a JWT signed with `RISTA_SECRET_KEY`.
    // Use the shared ristaClient so we don't accidentally send the wrong token.
    const items = await ristaClient.getInventory(branchCode);

    const filteredItems = (items || []).map((item) => ({
      skuCode: item.skuCode,
      branchCode: item.branchCode,
      name: item.name,
      categoryName: item.categoryName,
      measuringUnit: item.measuringUnit,
      itemQty: item.itemQty,
      averageCost: item.averageCost,
    }));

    res.json({ data: filteredItems });

  } catch (error) {
    console.error("Rista inventory error:", {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });

    res.status(error?.response?.status || 500).json({
      message: "Failed to fetch inventory items",
      error: error?.response?.data || error.message,
    });
  }
};
