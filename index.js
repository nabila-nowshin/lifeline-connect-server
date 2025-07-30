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
    const donationRequestsCollection = db.collection("donation-requests");

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
        //console.error("Error fetching user:", error);
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

    // DONATION REQUESTS
    app.post("/donation-requests", async (req, res) => {
      try {
        const request = req.body;
        console.log("request", request);

        // Basic validation (optional)
        if (
          !request.requesterEmail ||
          !request.bloodGroup ||
          !request.donationDate
        ) {
          return res.status(400).json({ error: "Missing required fields." });
        }

        // Insert into your MongoDB collection
        const result = await donationRequestsCollection.insertOne(request);

        res.status(201).json({
          message: "Donation request submitted successfully!",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating donation request:", error);
        res.status(500).json({ error: "Failed to create donation request." });
      }
    });

    // Get all donation requests by a specific donor
    // app.get("/donation-requests/:email", async (req, res) => {
    //   const email = req.params.email;
    //   console.log("hello");
    //   try {
    //     const recentRequests = await donationRequestsCollection
    //       .find({ requesterEmail: email })
    //       .toArray();

    //     res.json(recentRequests);
    //   } catch (error) {
    //     console.error("Error fetching recent donation requests:", error);
    //     res.status(500).json({ error: "Internal Server Error" });
    //   }
    // });

    // Get paginated donation requests by a specific donor
    app.get("/donation-requests/by-email/:email", async (req, res) => {
      const email = req.params.email;
      console.log("email:", email);
      const skip = parseInt(req.query.skip) || 0;
      const limit = parseInt(req.query.limit) || 5;

      try {
        const query = { requesterEmail: email };

        const total = await donationRequestsCollection.countDocuments(query);

        const recentRequests = await donationRequestsCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .sort({ donationDate: -1 }) // Optional: sort newest first
          .toArray();

        res.json({ requests: recentRequests, total });
      } catch (error) {
        console.error("Error fetching paginated donation requests:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Get 3 recent donation requests by a specific donor
    app.get("/donation-requests/recent/:email", async (req, res) => {
      const email = req.params.email;
      console.log("email:", email);
      try {
        const recentRequests = await donationRequestsCollection
          .find({ requesterEmail: email })
          .sort({ donationDate: -1 }) // newest first
          .limit(3)
          .toArray();

        res.json(recentRequests);
      } catch (error) {
        console.error("Error fetching recent donation requests:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Get donation requests by a id
    app.get("/donation-requests/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const request = await donationRequestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res.status(404).json({ error: "Request not found" });
        }

        res.json(request);
      } catch (error) {
        console.error("Error fetching request:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Update donation request by ID (PATCH)
    app.patch("/donation-requests/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body; // recipientName, donationDate, donationTime, bloodGroup

      try {
        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Request not found" });
        }

        res.json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ error: "Failed to update donation request" });
      }
    });

    // Delete donation request by ID (DELETE)
    app.delete("/donation-requests/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await donationRequestsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Request not found" });
        }

        res.json({ deletedCount: result.deletedCount });
      } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ error: "Failed to delete donation request" });
      }
    });

    // ADMIN
    // Get all users count
    app.get("/all-users-count", async (req, res) => {
      const usersCount = await usersCollection.countDocuments();
      res.send(usersCount);
    });
    // Get all donation count
    app.get("/all-donation-count", async (req, res) => {
      const donationCount = await donationRequestsCollection.countDocuments();
      res.send(donationCount);
    });

    // 🔥 All Users with Pagination + Filtering
    app.get("/all-users", async (req, res) => {
      const status = req.query.status;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const query = {};
      if (status && status !== "all") {
        query.status = status;
      }

      const skip = (page - 1) * limit;
      const users = await usersCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();
      const total = await usersCollection.countDocuments(query);

      res.send({ users, total });
    });

    // ✅ Update User Status (Block/Unblock)
    app.patch("/users/:id/status", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

    // ✅ Update User Role (Make Admin/Volunteer)
    app.patch("/users/:id/role", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
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
