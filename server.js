require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { connectDB } = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger-output.json');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: [
      "https://extraordinary-meerkat-680624.netlify.app",
    ],
  })
);
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/telemetry', require('./routes/telemetry'));
app.use('/vehicles', require('./routes/vehicles'));
app.use('/fleet', require('./routes/fleet'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));
// Serve React Frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

connectDB().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});