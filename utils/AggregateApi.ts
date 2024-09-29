import { searchParameters } from "../controller/apiController";
import mongoose from "mongoose";

type MongooseAggregation = mongoose.Aggregate<any[]>;

export class AggregateApi {
  constructor(
    public aggregation: MongooseAggregation,
    private queryRecord: searchParameters
  ) {}
  filter() {
    const defaultProjection = () => this.aggregation.project({ __v: 0 });

    if (this.queryRecord.fields) {
      const selectionArr = this.queryRecord.fields
        .trim()
        .replace(/\s|undefined/g, "")
        .split(",")
        .filter((v) => v !== "");

      //rules to prevent crashing the projection query
      const firstChar = selectionArr[0][0];
      if (firstChar === "-") {
        const isAllExclude = selectionArr.every((v) => v[0] === "-");
        if (!isAllExclude) {
          defaultProjection();
          return this;
        }
      } else {
        const isAllInclude = selectionArr.every(
          (v) => v[0] !== "-" || v === "-_id"
        );
        if (!isAllInclude) {
          defaultProjection();
          return this;
        }
      }

      const mapped: { [index: string]: number } = {};

      selectionArr.forEach((s: string) => {
        if (s[0] === "-") {
          mapped[s.slice(1)] = 0;
        } else {
          mapped[s] = 1;
        }
      });

      this.aggregation.project(mapped);
    } else {
      defaultProjection();
    }
    return this;
  }
  sort(defaultField: string = "name") {
    if (this.queryRecord.sort) {
      const dbFields = this.queryRecord.sort
        .replace(/\s/g, "")
        .split(",")
        .join(" ");
      this.aggregation = this.aggregation.sort(dbFields);
    } else {
      this.aggregation = this.aggregation.sort(defaultField);
    }
    return this;
  }
  populate(
    fromCollection: string,
    localFieldName: string,
    fromFieldName: string,
    storedFieldName: string
  ) {
    this.aggregation.lookup({
      from: fromCollection,
      localField: localFieldName,
      foreignField: fromFieldName,
      as: storedFieldName,
    });
    return this;
  }
  paginate() {
    const { pageSkip, pageLimit } = this.pageInfo();

    this.aggregation = this.aggregation.skip(pageSkip).limit(pageLimit);
    return this;
  }
  pageInfo() {
    const default_limit = 20;
    const limitValues = [1, 2, 3, 5, 10, 20, 30, 40, 60] as const;
    type PageLimitType = (typeof limitValues)[number];
    const isValidLimit = (val: number): val is PageLimitType => {
      return limitValues.includes(val as PageLimitType);
    };

    const pageNum_f = Number.parseInt(this.queryRecord.page as string);
    const pageNum = pageNum_f >= 1 ? pageNum_f : 1;
    let pageLimit: number;

    if (this.queryRecord.limit) {
      //sanitizes the limit input
      const pageLimit_f = Number(Number.parseInt(this.queryRecord.limit));
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
