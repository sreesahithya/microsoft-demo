import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PdfReader } from "pdfreader";
import Groq from "groq-sdk";
import { pipeline } from "@xenova/transformers";

import Chat from "./Chat.js";
import Chunk from "./models/Chunk.js";
import User from "./models/User.js";
import Pdf from "./models/Pdf.js";

dotenv.config();

// ================= APP =================

const app = express();

app.use(cors());
app.use(express.json());

// ================= DATABASE =================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch((err) => console.log("Mongo Error:", err));

// ================= GROQ =================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ================= MULTER =================

const upload = multer({
  dest: "uploads/",
});

// ================= AUTH =================

const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization");

    if (!token) {
      return res
        .status(401)
        .json({
          message: "Access denied",
        });
    }

    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = verified;

    next();

  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }
};

// ================= EMBEDDINGS =================

let embedder;

async function loadEmbedder() {
  embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );

  console.log("Embedding model loaded ✅");
}

async function getEmbedding(text) {
  if (!embedder)
    throw new Error(
      "Embedding model still loading"
    );

  const output = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data);
}

// ================= HELPERS =================

function chunkText(text, size = 1000) {
  const chunks = [];

  for (
    let i = 0;
    i < text.length;
    i += size
  ) {
    chunks.push(
      text.slice(i, i + size)
    );
  }

  return chunks;
}

function extractPdfText(filePath) {
  return new Promise(
    (resolve, reject) => {
      let text = "";

      new PdfReader().parseFileItems(
        filePath,
        (err, item) => {
          if (err)
            reject(err);

          else if (!item)
            resolve(text);

          else if (item.text)
            text += item.text + " ";
        }
      );
    }
  );
}

// ================= ROUTES =================

// Health

app.get("/", (req, res) => {
  res.send(
    "Server running 🚀"
  );
});

// ================= SIGNUP =================

app.post(
  "/signup",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      const existing =
        await User.findOne({
          email,
        });

      if (existing) {
        return res
          .status(400)
          .json({
            message:
              "User already exists",
          });
      }

      const hashed =
        await bcrypt.hash(
          password,
          10
        );

      await User.create({
        email,
        password: hashed,
      });

      res.json({
        message:
          "Signup successful",
      });

    } catch (err) {
      console.log(err);

      res
        .status(500)
        .json({
          message:
            "Server error",
        });
    }
  }
);

// ================= LOGIN =================

app.post(
  "/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      const user =
        await User.findOne({
          email,
        });

      if (!user) {
        return res
          .status(400)
          .json({
            message:
              "User not found",
          });
      }

      const match =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!match) {
        return res
          .status(400)
          .json({
            message:
              "Invalid password",
          });
      }

      const token =
        jwt.sign(
          {
            userId:
              user._id,
            email:
              user.email,
          },
          process.env.JWT_SECRET,
          {
            expiresIn:
              "7d",
          }
        );

      res.json({
        token,
      });

    } catch (err) {
      console.log(err);

      res
        .status(500)
        .json({
          message:
            "Server error",
        });
    }
  }
);

// ================= MY PDFS =================

app.get(
  "/my-pdfs",
  auth,
  async (req, res) => {
    try {
      const pdfs =
        await Pdf.find({
          userId:
            req.user.userId,
        }).sort({
          createdAt: -1,
        });

      res.json(
        pdfs
      );

    } catch (err) {
      res
        .status(500)
        .json({
          message:
            "Server error",
        });
    }
  }
);

// ================= PDF UPLOAD =================

app.post(
  "/upload-pdf",
  auth,
  upload.single("pdf"),
  async (
    req,
    res
  ) => {
    try {
      await Chunk.deleteMany({});
      if (!req.file) {
        return res
          .status(400)
          .json({
            message:
              "No file uploaded",
          });
      }

      const text =
        await extractPdfText(
          req.file.path
        );

      if (
        !text.trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "No readable text found in PDF",
          });
      }

      const chunks =
        chunkText(
          text,
          1000
        );

      const pdfDoc =
        await Pdf.create({
          userId:
            req.user.userId,
          fileName:
            req.file
              .originalname,
        });

      for (
        const chunk of chunks
      ) {
        const embedding =
          await getEmbedding(
            chunk
          );

        await Chunk.create(
          {
            

            fileName:
              req.file
                .originalname,

            text:
              chunk,

            embedding,
          }
        );
      }

      res.json({
        message:
          "PDF uploaded successfully",

       
      });

    } catch (err) {
      console.log(
        "Upload error:",
        err
      );

      res
        .status(500)
        .json({
          message:
            "Upload failed",
        });
    }
  }
);

// ================= CHAT =================
app.post("/chat", auth, async (req, res) => {
  try {
    const { question } = req.body;

    const questionEmbedding = await getEmbedding(question);

    const results = await Chunk.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: questionEmbedding,
          numCandidates: 100,
          limit: 5,

          // Search only this user's chunks
          
        },
      },
    ]);

    if (!results.length) {
      return res.json({
        answer:
          "I could not find relevant information in your PDF.",
      });
    }

    const context = results
      .map((r) => r.text)
      .join("\n\n");

    const completion =
      await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",

        messages: [
          {
            role: "system",
            content: `
You are a PDF assistant.
Answer only from provided context.
If answer not found say:
"Not found in document."
`,
          },
          {
            role: "user",
            content: `
Context:
${context}

Question:
${question}
`,
          },
        ],

        temperature: 0.2,
      });

    const answer =
      completion.choices[0].message.content;

    await Chat.create({
      userId: req.user.userId,
      question,
      answer,
    });

    res.json({
      answer,
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Server error",
    });
  }
});

// ================= CHAT HISTORY =================

app.get("/chat-history", auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      userId: req.user.userId
    }).sort({
      createdAt: -1
    });

    res.json(chats);

  } catch (err) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// ================= DELETE PDF =================

app.delete(
  "/pdf/:id",
  auth,
  async (req, res) => {
    try {
      await Pdf.findOneAndDelete(
        {
          _id:
            req.params.id,

          userId:
            req.user.userId,
        }
      );

      

      res.json({
        message:
          "PDF deleted",
      });

    } catch (err) {
      res
        .status(500)
        .json({
          message:
            "Delete failed",
        });
    }
  }
);

// ================= START =================

async function startServer() {
  try {
    await loadEmbedder();

    app.listen(
      5000,
      () => {
        console.log(
          "Server running on port 5000 🚀"
        );
      }
    );

  } catch (err) {
    console.log(
      "Startup error:",
      err
    );
  }
}

startServer();