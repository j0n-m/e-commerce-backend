function getDbCredentials() {
  const DB_URI = process.env.DB_URI;
  const DB_PASS = process.env.DB_PASS;

  return DB_URI == null
    ? console.error("Cannot retrieve DB URI")
    : DB_PASS == null
    ? console.error("Cannot retrieve DB Pass")
    : DB_URI.replace(/pass/i, DB_PASS);
}

export default getDbCredentials;
