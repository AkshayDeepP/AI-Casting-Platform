import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// SCHEMAS

//  Audition
const auditionSchema = new mongoose.Schema({
  movie: String,
  role: String,
  ageRange: String,
  genderRequirement: String,
  skills: [String],
  deadline: String,
  maxApplicants: Number,
  applicants: { type: Number, default: 0 },
  poster: String,

  directorId: String   
});


const Audition = mongoose.model("Audition", auditionSchema);


//  Applicant
const applicantSchema = new mongoose.Schema({
  name: String,
  age: Number,
  gender: String,
  experience: Number,
  skills: [String],
  score: Number,
  reason: String,
  auditionId: String
});

const Applicant = mongoose.model("Applicant", applicantSchema);

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String   // "director" or "candidate"
});


const User = mongoose.model("User", userSchema);

const app = express();
app.use(cors());
app.use(express.json());

app.post("/evaluate", async (req, res) => {
  const { candidate, audition } = req.body;

  try {
    const prompt = `
You are a STRICT scoring system.

You MUST calculate score EXACTLY using the rules below.
Do NOT guess. Do NOT interpret loosely.

FINAL SCORE = SKILL + EXPERIENCE + AGE

--------------------------------

1. SKILL SCORE:
- If candidate has ALL required skills → 5
- If missing ANY required skill → 0

2. EXPERIENCE SCORE:
- 4+ years → 3
- 2–3 years → 2
- 0–1 years → 1

3. AGE SCORE:
- Within range → 2
- Outside range → 0

--------------------------------

TOTAL SCORE = skill + experience + age

--------------------------------

RULES:
- MAX score = 10
- 10 ONLY if:
  ✔ ALL skills match
  ✔ Experience ≥ 4
  ✔ Age within range

- Extra skills should NOT reduce score
- Missing even ONE required skill → NO 10

--------------------------------

AUDITION:
Skills: ${audition.skills.join(", ")}
Age Range: ${audition.ageRange}

CANDIDATE:
Name: ${candidate.name}
Age: ${candidate.age}
Skills: ${candidate.skills.join(", ")}
Experience: ${candidate.experience} years

--------------------------------

Return ONLY JSON:
{
  "score": number,
  "reason": " very short explanation"
}
`;

    // ✅ Timeout controller
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model:"llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You must ONLY return valid JSON. No extra text.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    // ✅ API error handling
    if (!response.ok) {
      const errText = await response.text();
      console.error("API ERROR:", errText);

      return res.json({
        score: 5,
        reason: "Groq API error",
      });
    }

    const data = await response.json();

    const rawText = data?.choices?.[0]?.message?.content || "";

    console.log("RAW AI RESPONSE:", rawText);

    if (!rawText) {
      return res.json({
        score: 5,
        reason: "Empty AI response",
      });
    }

    let result;

    try {
      // ✅ Clean markdown
      const cleanText = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // ✅ Extract JSON safely
      const match = cleanText.match(/\{[\s\S]*?\}/);

      if (!match) throw new Error("No JSON found");

      result = JSON.parse(match[0]);

      // ✅ Validate
      if (
        typeof result.score !== "number" ||
        typeof result.reason !== "string"
      ) {
        throw new Error("Invalid structure");
      }

    } catch (parseError) {
      console.error("PARSE ERROR:", parseError);

      return res.json({
        score: 5,
        reason: "Invalid AI response format",
      });
    }

    // ✅ Normalize score
    result.score = Math.max(0, Math.min(10, result.score));

    return res.json(result);

  } catch (err) {
    console.error("SERVER ERROR:", err);

    // ✅ Timeout-specific handling
    if (err.name === "AbortError") {
      return res.json({
        score: 5,
        reason: "AI request timeout",
      });
    }

    return res.json({
      score: 5,
      reason: "AI service unavailable",
    });
  }
});

app.post("/apply", async (req, res) => {
  try {
    const applicant = new Applicant(req.body);
    await applicant.save();
    res.json({ message: "Application saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/applicants/:directorId", async (req, res) => {
  const { directorId } = req.params;

  try {
    // Step 1: Find auditions of this director
    const auditions = await Audition.find({ directorId });

    const auditionIds = auditions.map(a => a._id.toString());

    // Step 2: Find applicants for those auditions only
    const applicants = await Applicant.find({
      auditionId: { $in: auditionIds }
    });

    res.json(applicants);

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ================= NEW APIs =================

// POST audition
app.post("/auditions", async (req, res) => {
  try {
    const audition = new Audition(req.body);
    await audition.save();
    res.json({ message: "Audition saved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/auditions/:id", async (req, res) => {
  try {
    const updated = await Audition.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET auditions
app.get("/auditions", async (req, res) => {
  const data = await Audition.find();
  res.json(data);
});

app.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;

  // ✅ ADD THIS HERE
  if (!["director", "candidate"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = new User({ name, email, password, role });
  await user.save();

  res.json({ message: "Signup successful" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET
);

  res.json({ token, role: user.role });
});
app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "AI Casting Platform Backend is running 🚀"
  });
});
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});