const jsonwebtoken = require("jsonwebtoken");
const generateTokens = (userId, role) => {
  const accessToken = jsonwebtoken.sign(
    { id: userId, role },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "15m" }
  );
  const refreshToken = jsonwebtoken.sign(
    { id: userId, role },
    process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret",
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

module.exports = {
  generateTokens: generateTokens,
};
