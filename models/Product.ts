import mongoose, { Types } from "mongoose";
const Schema = mongoose.Schema;

type HighlightType = {
  heading: string;
  overview: string;
};

interface IProduct {
  // _id?: Types.ObjectId;
  name: string;
  brand: string;
  price: number;
  retail_price: number;
  description: string;
  highlights: Array<HighlightType>;
  quantity?: number;
  category: Array<Types.ObjectId>;
  total_bought?: number;
  tags: Array<string>;
  image_src?: string;
}

const productSchema = new Schema<IProduct>({
  // _id: {
  //   type: Schema.ObjectId,
  // },
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
    min: 0.01,
    max: 100000,
  },
  retail_price: {
    type: Number,
    required: true,
    min: 0.01,
    max: 100000,
  },
  description: {
    type: String,
    default: "",
  },
  highlights: [
    {
      _id: false,
      heading: {
        type: String,
        minlength: 1,
      },
      overview: {
        type: String,
        minlength: 1,
      },
    },
  ],
  quantity: {
    type: Number,
    default: 20,
    required: true,
    min: 0,
    max: 250,
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
    min: 0,
    max: 1000000,
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
export { IProduct, HighlightType };
