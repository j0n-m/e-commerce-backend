import mongoose, { Types } from "mongoose";

export interface ICategory {
  name: string;
  alias?: string;
}

const Schema = mongoose.Schema;

const categorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: true,
  },
  alias: {
    type: String,
  },
});

categorySchema.virtual("url").get(function () {
  return `/api/category/${this._id}`;
});

export default mongoose.model("Category", categorySchema);
