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
    minlength: 1,
  },
  alias: {
    type: String,
    default: "",
  },
});

categorySchema.virtual("url").get(function () {
  return `/api/category/${this._id}`;
});

export default mongoose.model("Category", categorySchema);
