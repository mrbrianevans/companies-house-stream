import mongodb from "mongodb";

const { MongoClient } = mongodb;

export const getMongoClient = async () => {
  const mongo = new MongoClient("mongodb://mongo-cache:27017");
  await mongo.connect();
  return mongo;
};
