import { MongoClient } from "mongodb";

export const getMongoClient = async () => {
  const mongo = new MongoClient("mongodb://mongo-cache:27017", {
    auth: {
      user: process.env.MONGO_INITDB_ROOT_USERNAME,
      password: process.env.MONGO_INITDB_ROOT_PASSWORD
    }
  });
  await mongo.connect();
  return mongo;
};
