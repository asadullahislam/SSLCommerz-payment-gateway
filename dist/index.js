const express = require("express");
const SSLCommerzPayment = require("sslcommerz-lts");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId
} = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5002;

// Middleware Setup
app.use(cors());
app.use(express.json());

// MongoDB Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tym1q1j.mongodb.net/?retryWrites=true&w=majority`;

// MongoClient Setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

// SSLCommerz Configurations
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; // true for live, false for sandbox

console.log(`Store ID: ${store_id}, Store Password: ${store_passwd}`);

// Main Function to Handle Routes and Database
async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    // Database and Collection
    const orderCollection = client.db("SSL_Commerz_Payment").collection("order");

    // Generate Unique Transaction ID
    const tran_id = new ObjectId().toString();

    // Create Order Route
    app.post("/order", async (req, res) => {
      const order = req.body;

      // Prepare Payment Data
      const data = {
        total_amount: order.balance,
        currency: order.currency,
        tran_id: tran_id,
        // Unique transaction ID
        success_url: `http://localhost:5002/payment/success/${tran_id}`,
        fail_url: `http://localhost:5002/payment/fail/${tran_id}`,
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: "Computer",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: order.name,
        cus_email: order.email,
        cus_add1: order.address,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: order.postalCode,
        cus_country: "Bangladesh",
        cus_phone: order.phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh"
      };
      console.log("Payment Data:", data);
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({
          url: GatewayPageURL
        });
        const finalOrder = {
          paidStatus: false,
          transactionId: tran_id
        };
        const result = orderCollection.insertOne(finalOrder);
        console.log("Redirecting to: ", GatewayPageURL);
      });
    });

    // payment route

    app.post("/payment/success/:tranId", async (req, res) => {
      console.log(req.params.tranId);
      const result = await orderCollection.updateOne({
        transactionId: req.params.tranId
      }, {
        $set: {
          paidStatus: true
        }
      });
      if (result.modifiedCount > 0) {
        res.redirect(`http://localhost:5173/payment/success/${req.params.tranId}`);
      }
    });
    app.post("/payment/fail/:tranId", async (req, res) => {
      const result = await orderCollection.deleteOne({
        transactionId: req.params.tranId
      });
      if (result.deletedCount > 0) {
        res.redirect(`http://localhost:5173/payment/fail/${req.params.tranId}`);
      }
    });
    // Root Route
    app.get("/", (req, res) => {
      res.send("SSL payment gateway is running.");
    });
  } finally {
    // Optional: Close the MongoDB connection when the server shuts down
    // await client.close();
  }
}

// Run the Main Function
run().catch(err => console.error("Error running the app:", err));

// Start the Server
app.listen(port, () => {
  console.log(`SSL Payment Gateway server is running on port ${port}`);
});