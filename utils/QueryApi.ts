import { searchParameters } from "../controller/apiController";
import mongoose from "mongoose";
import { IProduct } from "../models/Product";

type MongooseQuery = mongoose.Query<
  (mongoose.Document<unknown, {}, IProduct> &
    IProduct & {
      _id: mongoose.Types.ObjectId;
    })[],
  mongoose.Document<unknown, {}, IProduct> &
    IProduct & {
      _id: mongoose.Types.ObjectId;
    },
  {},
  IProduct,
  "find",
  {}
>;

export class QueryApi {
  constructor(
    public query: MongooseQuery,
    private queryRecord: searchParameters
  ) {}
  filter() {
    if (this.queryRecord.fields) {
      const selectionStr = this.queryRecord.fields
        .trim()
        .replace(/\s/g, "")
        .split(",")
        .join(" ");

      this.query.select(selectionStr);
    } else {
      this.query.select("-__v");
    }
  }
  sort(defaultField: string = "name") {
    if (this.queryRecord.sort) {
      const dbFields = this.queryRecord.sort
        .replace(/\s/g, "")
        .split(",")
        .join(" ");
      this.query = this.query.sort(dbFields);
    } else {
      this.query = this.query.sort(defaultField);
    }
    return this;
  }
  paginate() {
    const { pageSkip, pageLimit } = this.pageInfo();

    this.query = this.query.skip(pageSkip).limit(pageLimit);
    return this;
  }
  pageInfo() {
    const default_limit = 20;
    const limitValues = [1, 2, 5, 10, 20, 30, 40, 60] as const;
    type PageLimitType = (typeof limitValues)[number];
    const isValidLimit = (val: number): val is PageLimitType => {
      return limitValues.includes(val as PageLimitType);
    };

    const pageNum_f = Number.parseInt(this.queryRecord.page as string);
    const pageNum = pageNum_f >= 1 ? pageNum_f : 1;
    let pageLimit: number;

    if (this.queryRecord.limit) {
      //sanitizes the limit input
      const pageLimit_f = Number(this.queryRecord.limit);
      pageLimit = isValidLimit(pageLimit_f) ? pageLimit_f : default_limit;
    } else {
      pageLimit = default_limit;
    }
    //mutates the query values to a valid limit number
    this.queryRecord.limit = pageLimit.toString();

    const pageSkip = (pageNum - 1) * pageLimit;

    return { pageSkip, pageLimit, pageNum };
  }
}
