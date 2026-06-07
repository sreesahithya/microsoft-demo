import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },

  content: {
    type: String,
    required: true,
  },

  // ✅ NEW: embedding vector for semantic search
  embedding: {
    type: [Number],
    default: [],
  },

  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const Document = mongoose.model("Document", documentSchema);

export default Document;