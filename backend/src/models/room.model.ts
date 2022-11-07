import { Schema, model } from "mongoose";

const Room = new Schema(
  {
    id: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, required: true, ref: "user-data" },
  },
  { collection: "room-data" }
);

export const RoomModel = model("RoomData", Room);
