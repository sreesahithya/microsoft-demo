import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema({
  

  fileName: String,

  text: String,

  embedding: {
    type: [Number],
    required: true,
  },
});

export default mongoose.model("Chunk", chunkSchema);