const mongoose = require('mongoose');
module.exports = {
    connectDB: () => mongoose.connect(
        process.env.MONGO_URI || 'mongodb+srv://nagendrahada1609_db_user:vIAxCZSntVC0Nmh9@e3electric.ai9cg30.mongodb.net/e3electric'
        //                                                                                                               
    ).then(() => {
        // console.log('DB name:', mongoose.connection.db.databaseName);
        // console.log('Telemetry collection:', Telemetry.collection.name);
    })
};