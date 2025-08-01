require("dotenv").config();
const admin = require("firebase-admin");
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");

app.use(cors());
app.use(express.json());
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized access No token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    // console.log(token, decoded);
    // console.log(req.decoded.email);
    next();
  } catch (err) {
    return res.status(403).send({ error: "Invalid token" });
  }
};

const serviceAccount = require("./path/your-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
    const blogsCollection = db.collection("blogs");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      // console.log("decoded Email", req.decoded);
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "admin") {
        return res.status(403).send({ error: "Forbidden" });
      }
      next();
    };

    const verifyAdminOrVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });

      if (user?.role !== "admin" && user?.role !== "volunteer") {
        return res.status(403).send({ error: "Forbidden" });
      }

      next();
    };

    // users: Add new user
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
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send({ role: user?.role || "user" });
    });

    //get users by email
    app.get("/users/:email", verifyToken, async (req, res) => {
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

    app.patch("/users/:email", verifyToken, async (req, res) => {
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
    app.post("/donation-requests", verifyToken, async (req, res) => {
      try {
        const request = req.body;
        // console.log("request", request);

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

    // Get 3 recent donation requests by a specific donor
    app.get(
      "/donation-requests/recent/:email",
      verifyToken,
      async (req, res) => {
        const email = req.params.email;
        // console.log("email:", email);
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
      }
    );

    // Get donation requests by a id
    app.get("/donation-requests/:id", verifyToken, async (req, res) => {
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
    app.patch("/donation-requests/:id", verifyToken, async (req, res) => {
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
    app.delete("/donation-requests/:id", verifyToken, async (req, res) => {
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
    app.get(
      "/all-users-count",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        // console.log(req.headers);
        const usersCount = await usersCollection.countDocuments();
        res.send(usersCount);
      }
    );
    // Get all donation count
    app.get(
      "/all-donation-count",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        const donationCount = await donationRequestsCollection.countDocuments();
        res.send(donationCount);
      }
    );

    // 🔥 All Users with Pagination + Filtering
    app.get(
      "/all-users",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
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
      }
    );

    // GET /users/search :public
    app.get("/search-users", async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;

        const query = {
          role: "donor",
          status: "active",
        };

        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;

        const donors = await usersCollection.find(query).toArray();

        res.status(200).json(donors);
      } catch (error) {
        console.error("Error fetching donors:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // 🔥 All donation requests with Pagination + Filtering
    app.get("/all-donations", verifyToken, async (req, res) => {
      // console.log(req.query);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 3;
      const role = req.query.role;
      const email = req.query.email;
      const status = req.query.status;
      // const role = req.user.role;
      // const email = req.user?.email;

      const skip = (page - 1) * limit;

      // Default: everyone sees only their own donations
      let query = { requesterEmail: email };

      // Admins can see all
      if (role === "admin" || role === "volunteer") {
        query = {};
      }

      if (status && status !== "all") {
        query.status = status;
      }

      const donations = await donationRequestsCollection
        .find(query)
        .sort({ donationDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await donationRequestsCollection.countDocuments(query);

      res.send({ donations, total });
    });

    //public :pending donation requests
    app.get("/pending-donations", async (req, res) => {
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      const query = { status: "pending" };

      const skip = (page - 1) * limit;

      const pendingDonations = await donationRequestsCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await donationRequestsCollection.countDocuments(query);

      res.send({ donations: pendingDonations, total });
    });

    //update donation status
    app.patch("/donations/update-status/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { status, donorName, donorEmail } = req.body;

      try {
        const updateFields = { status };
        if (donorName) updateFields.donorName = donorName;
        if (donorEmail) updateFields.donorEmail = donorEmail;

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateFields }
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

    // ✅ Update User Status (Block/Unblock)
    app.patch("/users/:id/status", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

    // ✅ Update User Role (Make Admin/Volunteer)
    app.patch("/users/:id/role", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
    });

    // POST: Create a blog
    app.post(
      "/blogs",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        const blog = req.body;
        blog.status = "draft";
        blog.createdAt = new Date();
        const result = await blogsCollection.insertOne(blog);
        res.send(result);
      }
    );

    // Get all published blogs (public endpoint)
    app.get("/published-blogs", async (req, res) => {
      try {
        const publishedBlogs = await blogsCollection
          .find({ status: "published" })
          .sort({ createdAt: -1 }) // newest first
          .toArray();

        res.send(publishedBlogs);
      } catch (error) {
        console.error("Error fetching published blogs:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Get a single blog by ID (public)
    app.get("/published-blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const blog = await blogsCollection.findOne({
          _id: new ObjectId(id),
          status: "published",
        });

        if (!blog) {
          return res
            .status(404)
            .send({ message: "Blog not found or unpublished" });
        }

        res.send(blog);
      } catch (error) {
        console.error("Error fetching single blog:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // GET /blogs?status=draft&skip=0&limit=6
    app.get("/blogs", verifyToken, async (req, res) => {
      const { status, skip = 0, limit = 6 } = req.query;

      const query = {};
      if (status && status !== "all") {
        query.status = status;
      }

      const blogs = await blogsCollection
        .find(query)
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .toArray();

      const total = await blogsCollection.countDocuments(query);

      res.send({ blogs, total });
    });

    // PATCH: Publish or Unpublish a blog (admin only)
    app.patch(
      "/blogs/:id/status",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          const { status } = req.body;

          if (!["draft", "published"].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
          }

          const result = await blogsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status } }
          );

          if (result.modifiedCount === 0) {
            return res
              .status(404)
              .json({ message: "Blog not found or already has this status" });
          }

          res.json({ message: `Blog marked as ${status}` });
        } catch (error) {
          console.error("Error updating blog status:", error);
          res.status(500).json({ message: "Internal server error" });
        }
      }
    );

    // DELETE: Delete a blog (admin only)
    app.delete("/blogs/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await blogsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Blog not found" });
        }

        res.json({ message: "Blog deleted successfully" });
      } catch (error) {
        console.error("Error deleting blog:", error);
        res.status(500).json({ message: "Internal server error" });
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
  // console.log(`Example app listening on port ${port}`);
});
