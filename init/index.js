const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");

if (process.env.NODE_ENV != "production") {
    require("dotenv").config({ quiet: true });
}

const dns = require("dns");
dns.setServers([process.env.MONGODB_DNS_SERVER || "10.129.119.214"]);

const dbUrl = process.env.ATLASDB_URL;

const initDB = async () => {
    if (!dbUrl) {
        throw new Error("ATLASDB_URL is not configured");
    }

    await mongoose.connect(dbUrl);

    let owner = await User.findOne({ username: "seed-owner" });
    if (!owner) {
        owner = await User.register(
            new User({
                username: "seed-owner",
                email: "seed-owner@example.com",
            }),
            "seed-owner-password"
        );
    }

    const listings = initData.data.map((listing) => ({
        ...listing,
        owner: owner._id,
    }));

    const result = await Listing.bulkWrite(
        listings.map((listing) => ({
            updateOne: {
                filter: {
                    title: listing.title,
                    location: listing.location,
                    country: listing.country,
                },
                update: { $set: listing },
                upsert: true,
            },
        }))
    );

    console.log(
        `Atlas initialization complete: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`
    );
};

initDB()
    .catch((err) => {
        console.error("Unable to initialize Atlas data:", err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
