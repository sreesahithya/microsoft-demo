import mongoose from "mongoose";

const pdfSchema = new mongoose.Schema(
  {
    userId: String,

    fileName: String,
  },
  { timestamps: true }
);

export default mongoose.model("Pdf", pdfSchema);