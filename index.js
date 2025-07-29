require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@tiptopgardeners.3nfx9jd.mongodb.net/?retryWrites=true&w=majority&appName=TipTopGardeners`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const db = client.db("LifeLine_connect");
    const usersCollection = db.collection("users");

    // ✅ POST /users: Add new user
    app.post("/users", async (req, res) => {
      try {
        const userData = req.body;

        // Optional: Check if user already exists
        const existingUser = await usersCollection.findOne({
          email: userData.email,
        });
        if (existingUser) {
          return res.status(409).send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne(userData);
        res.status(201).send({
          message: "User stored successfully",
          insertedId: result.insertedId,
        });
      } catch (err) {
        console.error("Error inserting user:", err);
        res.status(500).send({ error: "Failed to store user" });
      }
    });

    //GET users role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send({ role: user?.role || "user" });
    });

    //get users by email
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });
        res.send(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ error: "Failed to fetch user" });
      }
    });

    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const updatedData = { ...req.body };

      // Remove _id if present to avoid MongoDB immutable field error
      if (updatedData._id) {
        delete updatedData._id;
      }

      console.log("Updating user:", email);
      console.log("With data:", updatedData);

      try {
        const result = await usersCollection.updateOne(
          { email },
          { $set: updatedData }
        );

        res.send(result);
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).send({ error: "Failed to update user" });
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World! from other universe");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
