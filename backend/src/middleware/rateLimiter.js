// Rate limiting is DISABLED — all limiters are pass-through no-ops.
// To re-enable, replace each noopLimiter with an express-rate-limit instance.

const noopLimiter = (req, res, next) => next();

module.exports = {
    apiLimiter:  noopLimiter,
    authLimiter: noopLimiter,
    aiLimiter:   noopLimiter,
};
