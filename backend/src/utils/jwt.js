const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signAuthToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  signAuthToken,
  verifyAuthToken,
};
