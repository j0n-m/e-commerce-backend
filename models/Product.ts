import mongoose, { Types } from "mongoose";
const Schema = mongoose.Schema;

type HighlightType = {
  heading: string;
  overview: string;
};

interface IProduct {
  _id: Types.ObjectId;
  name: string;
  brand: string;
  price: number;
  retail_price: number;
  description: string;
  highlights: Array<HighlightType>;
  quantity: number;
  category: Array<Types.ObjectId>;
  total_bought: number;
  tags: Array<string>;
  image_src?: string;
}

const productSchema = new Schema<IProduct>({
  _id: {
    type: Schema.ObjectId,
  },
  name: {
    type: String,
    required: true,
    minlength: 1,
  },
  brand: {
    type: String,
    required: true,
    minlength: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  retail_price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
  },
  highlights: [
    {
      heading: {
        type: String,
        minlength: 2,
      },
      overview: {
        type: String,
        minlength: 2,
      },
    },
  ],
  quantity: {
    type: Number,
    default: 20,
    required: true,
  },
  category: [
    {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
  ],
  total_bought: {
    type: Number,
    required: true,
    default: 0,
  },
  tags: [
    {
      type: String,
    },
  ],
  image_src: {
    type: String,
  },
});

productSchema.virtual("url").get(function () {
  return `/api/product/${this._id}`;
});

export default mongoose.model("Product", productSchema);
