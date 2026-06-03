function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.message}`);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.message });
  }
  // Mongoose cast error (bad ObjectId etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  // Payload too large
  if (err.status === 413) {
    return res.status(413).json({ error: 'Request payload too large' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

module.exports = { errorHandler };