// swagger.js
const swaggerAutogen = require('swagger-autogen')();

const doc = {
    info: {
        title: 'EV Fleet API',
        description: 'EV Fleet Telemetry API'
    },
    host: 'ev-fleet-backend-9yab.onrender.com',
    schemes: ['https'],
};

const outputFile = './swagger-output.json';
const routes = ['./routes/vehicles.js', './routes/fleet.js' , './routes/telemetry.js']; // your route files

swaggerAutogen(outputFile, routes, doc);