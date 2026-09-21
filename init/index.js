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

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminUsername || !adminEmail || !adminPassword) {
        throw new Error(
            "ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be configured"
        );
    }

    let owner = await User.findOne({ username: adminUsername });
    if (!owner) {
        owner = await User.register(
            new User({
                username: adminUsername,
                email: adminEmail,
                role: "admin",
            }),
            adminPassword
        );
    } else {
        owner.email = adminEmail;
        owner.role = "admin";
        await owner.setPassword(adminPassword);
        await owner.save();
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
