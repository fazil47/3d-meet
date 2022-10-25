import { Schema, model as MongooseModel } from "mongoose";

const User = new Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    quote: { type: String },
  },
  { collection: "user-data" }
);

export const UserModel = MongooseModel("UserData", User);
