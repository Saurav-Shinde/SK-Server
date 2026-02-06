import axios from "axios";

export const getInventoryItems = async (req, res) => {
  try {
    const { branchCode } = req.query;

    if (!branchCode) {
      return res.status(400).json({
        message: "branchCode is required",
      });
    }

    const url = `${process.env.RISTA_BASE_URL}/inventory/store/items`;
    console.log("Calling:", url);

    const response = await axios.get(url, {
      params: { branchCode },
      headers: {
        "x-api-key": process.env.RISTA_API_KEY,
        "x-api-token": process.env.RISTA_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });
    
    const filteredItems = response.data.data.map((item) => ({
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
    console.error(
      "Rista API Error:",
      error?.response?.data || error.message
    );

    res.status(error?.response?.status || 500).json({
      message: "Failed to fetch inventory items",
      error: error?.response?.data || error.message,
    });
  }
};
