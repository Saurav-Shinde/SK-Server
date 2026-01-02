import Products from "../models/products.js";

export const getProducts = async (req, res) => {
  try {
    const { supplierName } = req.query;

    const matchStage = {};

    if (supplierName) {
      matchStage["Supplier Name"] = supplierName;
    }

    const products = await Products.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            name: "$Supplier Item Name",
            unit: "$Supplier Unit",
            unitCost: "$Supplier Unit Cost",
            supplier: "$Supplier Name"
          },
          totalQty: { $sum: "$Supplier Qty" }
        }
      },
      {
        $project: {
          _id: 0,
          supplierName: "$_id.supplier",
          itemName: "$_id.name",
          unit: "$_id.unit",
          unitCost: "$_id.unitCost",
          totalQty: 1
        }
      }
    ]);

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export const createProduct = async (req, res) => {
  try {
    const data = req.body;

    // image should be optional — do NOT fail if missing
    const newProduct = new Products({
      "Store Name": data.storeName,
      "GRN Number": data.grnNumber,
      "GRN Date": data.grnDate,
      "Supplier Code": data.supplierCode,
      "Supplier Name": data.supplierName,
      "Supplier Item Name": data.supplierItemName,
      "Supplier SKU": data.supplierSKU,
      Category: data.category,
      "Supplier Qty": data.supplierQty,
      "Supplier Unit": data.supplierUnit,
      "Supplier Unit Cost": data.supplierUnitCost,
      "Discount Amount": data.discountAmount,
      "Charge Amount": data.chargeAmount,
      "Delivery Charges": data.deliveryCharges,
      "Total Cost": data.baseCost,
      "Total Tax": data.totalTax,
      "Total ITC": data.totalITC,
      "Total Amount": data.totalAmount,

      // optional
      image_url: data.imageUrl || null
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      product: newProduct,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};