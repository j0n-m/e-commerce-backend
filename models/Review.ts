import mongoose, { Types } from "mongoose";

const Schema = mongoose.Schema;

interface IReview {
  rating: 1 | 2 | 3 | 4 | 5;
  reviewer_name: string;
  review_description: string;
  review_date: Date;
  review_edit_date?: Date;
  product_id: Types.ObjectId;
}

//Single review instance
const reviewSchema = new Schema<IReview>({
  rating: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
    required: true,
  },
  reviewer_name: {
    type: String,
    required: true,
  },
  review_description: {
    type: String,
    required: true,
    minlength: 1,
  },
  review_date: {
    type: Schema.Types.Date,
    required: true,
  },
  review_edit_date: {
    type: Date,
  },
  product_id: {
    type: Schema.ObjectId,
    ref: "Product",
    required: true,
  },
});

reviewSchema.virtual("url").get(function () {
  return `/api/product/${this.product_id}/review/${this._id}`;
});

export default mongoose.model("Review", reviewSchema);
export { IReview };
