const { verifyAuthToken } = require("../utils/jwt");

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  return req.cookies?.access_token || null;
}

function authMiddleware(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "Nao autenticado" });
  }

  try {
    req.user = verifyAuthToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: "Token invalido" });
  }
}

module.exports = authMiddleware;
