import { Schema, model as MongooseModel } from "mongoose";

const User = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    quote: { type: String },
  },
  { collection: "user-data" }
);

const model = MongooseModel("UserData", User);

export default model;
