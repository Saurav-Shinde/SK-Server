import TrialRecipe from "../models/trialRecipe.models.js";
import TrainingRecipe from "../models/trainingRecipe.models.js";

export const createTrialRecipe = async (req, res) => {
  try {
    const { brand, trialCode, recipeName, items } = req.body || {};
    if (!brand || !trialCode || !recipeName || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid trial recipe payload" });
    }

    const doc = await TrialRecipe.create({
      brand,
      trialCode,
      recipeName,
      items,
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error("Create trial recipe error:", err?.message || err);
    return res.status(500).json({ message: "Failed to save trial recipe" });
  }
};

export const createTrainingRecipe = async (req, res) => {
  try {
    const { brand, trainingCode, recipeName, items } = req.body || {};
    if (!brand || !trainingCode || !recipeName || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid training recipe payload" });
    }

    const doc = await TrainingRecipe.create({
      brand,
      trainingCode,
      recipeName,
      items,
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error("Create training recipe error:", err?.message || err);
    return res.status(500).json({ message: "Failed to save training recipe" });
  }
};

export const listTrialRecipes = async (req, res) => {
  try {
    const docs = await TrialRecipe.find({})
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: docs });
  } catch (err) {
    console.error("List trial recipes error:", err?.message || err);
    return res.status(500).json({ message: "Failed to list trial recipes" });
  }
};

export const listTrainingRecipes = async (req, res) => {
  try {
    const docs = await TrainingRecipe.find({})
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: docs });
  } catch (err) {
    console.error("List training recipes error:", err?.message || err);
    return res.status(500).json({ message: "Failed to list training recipes" });
  }
};

export const getTrialRecipeById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await TrialRecipe.findById(id).lean();
    if (!doc) {
      return res.status(404).json({ message: "Trial recipe not found" });
    }
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("Get trial recipe error:", err?.message || err);
    return res.status(500).json({ message: "Failed to fetch trial recipe" });
  }
};

export const updateTrialRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "items[] is required" });
    }
    const doc = await TrialRecipe.findByIdAndUpdate(
      id,
      { $set: { items } },
      { new: true }
    ).lean();
    if (!doc) {
      return res.status(404).json({ message: "Trial recipe not found" });
    }
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("Update trial recipe error:", err?.message || err);
    return res.status(500).json({ message: "Failed to update trial recipe" });
  }
};

export const getTrainingRecipeById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await TrainingRecipe.findById(id).lean();
    if (!doc) {
      return res.status(404).json({ message: "Training recipe not found" });
    }
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("Get training recipe error:", err?.message || err);
    return res.status(500).json({ message: "Failed to fetch training recipe" });
  }
};

export const updateTrainingRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "items[] is required" });
    }
    const doc = await TrainingRecipe.findByIdAndUpdate(
      id,
      { $set: { items } },
      { new: true }
    ).lean();
    if (!doc) {
      return res.status(404).json({ message: "Training recipe not found" });
    }
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("Update training recipe error:", err?.message || err);
    return res.status(500).json({ message: "Failed to update training recipe" });
  }
};


