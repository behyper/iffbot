import mongoose, { Model } from "mongoose";
import env from "../services/env.js";
import MessageModel, { MessageDocument } from "./models/messageModel.js";
import UserModel, { UserDocument } from "./models/userModel.js";
import { SortDocument } from "./interfaces/sort.js";
import SortModel from "./models/sortModel.js";
import jwt from "jsonwebtoken";

import AIOModel from "./models/aIOModel.js";
import OngoingModel from "./models/ongoingModel.js";
import { HindiDramaModel } from "./models/aIOModel.js";

import { AIODocument } from "./interfaces/aIO.js";

import { AIOSearchCriteria } from "./interfaces/searchCriteria.js";
import { InviteService } from "./inviteService.js";
import { InviteUser } from "./interfaces/inviteUser.js";
import { OngoingDocument } from "./interfaces/ongoingDocument.js";
import TokenModel from "./models/tokeModel.js";
import { ITokenDocument } from "./interfaces/token.js";
import { sendToLogGroup } from "../utils/sendToCollection.js";

class MongoDB {
  db: typeof mongoose;
  MessageModel: Model<MessageDocument>;
  UserModel: Model<UserDocument>;
  SortModel: Model<SortDocument>;
  AIOModel: Model<AIODocument>;
  OngoingModel: Model<OngoingDocument>;
  HindiDramaModel: Model<AIODocument>;
  TokenModel: Model<ITokenDocument>;

  inviteService: InviteService;
  databaseUrl: string;

  constructor() {
    this.db = mongoose;
    this.MessageModel = MessageModel;
    this.UserModel = UserModel;
    this.SortModel = SortModel;
    this.AIOModel = AIOModel;
    this.TokenModel = TokenModel;

    this.OngoingModel = OngoingModel;
    this.HindiDramaModel = HindiDramaModel;
    this.databaseUrl = env.databaseUrl || "";
    this.inviteService = new InviteService();
  }

  async initialize() {
    await this.db.connect(this.databaseUrl);
  }

  async saveMessages(shareId: number, messageIds: number[]) {
    await new this.MessageModel({
      shareId,
      messageIds,
    }).save();

    return shareId;
  }
  async saveUser(user: UserDocument) {
    try {
      const existingUser = await this.UserModel.findOne({ id: Number(user.id) });
      if (!existingUser) {
        await new this.UserModel(user).save();
      }
      return user;
    } catch (error) {
      console.error("Error saving user:", error);
    }
    return user;
  }
  async getAllUserIds(): Promise<number[]> {
    try {
      const users = await UserModel.find().select("id");
      const userIds = users.map((user) => user.id);
      return userIds;
    } catch (error) {
      console.error("Error fetching user IDs:", error);
      return [];
    }
  }
  async isUserExist(userId: string): Promise<boolean> {
    try {
      const userExists = await this.UserModel.findOne({ id: Number(userId) });
      console.log(userExists);
      return userExists?.id ? true : false;
    } catch (error) {
      console.error("Error checking user existence:", error);
      return false;
    }
  }
  async countUsers(): Promise<string> {
    try {
      const itemCount = await this.UserModel.countDocuments();
      return `: ${itemCount}`;
    } catch (error) {
      return "Error counting users";
    }
  }

  async saveSort(sort: SortDocument) {
    await new this.SortModel(sort).save();
    return sort;
  }
  async getFirstItem(): Promise<SortDocument | null> {
    try {
      const document = await SortModel.findOne({}, { sort: { $slice: 1 } });
      if (!document || document.sort.length === 0) {
        console.log("No document found or the sort array is empty.");
        return null;
      }
      return document;
    } catch (err) {
      return null;
    }
  }

  async getMessages(shareId: number) {
    return (await this.MessageModel.findOne({ shareId }))?.messageIds;
  }

  async getAIOMessages(shareId: number) {
    return (await this.AIOModel.findOne({ shareId }))?.messageIds;
  }
  async getOngoingMessages(shareId: number) {
    return (await this.OngoingModel.findOne({ shareId }))?.messageIds;
  }

  async saveAIO(aio: AIODocument) {
    await new this.AIOModel(aio).save();
    return aio;
  }
  async saveOngoing(ong: OngoingDocument) {
    await new this.OngoingModel(ong).save();
    return ong;
  }
  async getHindiMessages(shareId: number) {
    return (await this.HindiDramaModel.findOne({ shareId }))?.messageIds;
  }

  async saveHindiDrama(aio: AIODocument) {
    await new this.HindiDramaModel(aio).save();
    return aio;
  }

  async searchAIO(
    criteria: AIOSearchCriteria,
    messageIdLink?: string | null
  ): Promise<AIODocument[] | undefined> {
    if (!criteria.aIOTitle || criteria.aIOTitle.length < 2) {
      console.log("Please provide a valid search criteria.");
      return undefined;
    }
    const normalizedTitle = criteria.aIOTitle;
    const first20Chars = normalizedTitle.slice(0, 20);

    const query = {
      aIOTitle: { $regex: new RegExp(first20Chars, "i") },
    };

    let specialQuery = {};
    if (first20Chars.length > 4) {
      const keywords = first20Chars
        .replace(/\s+/g, " ")
        .split(" ")
        .map((keyword) => `(?=.*${keyword})`)
        .join("");
      const regexPattern = new RegExp(`^${keywords}`, "i");

      specialQuery = {
        aIOTitle: { $regex: regexPattern },
      };
    }

    try {
      let results = await this.AIOModel.find(query);

      if (results.length === 0 && Object.keys(specialQuery).length > 0) {
        results = await this.AIOModel.find(specialQuery);
      }
      if (results.length === 0) {
        try {
          await sendToLogGroup(
            env.logGroupId,
            `not found: ${normalizedTitle} [View Message](${
              messageIdLink || "https://www.telegram.org/"
            })`
          );
        } catch {}
      }
      return results;
    } catch (err) {
      console.error("Error executing the query:", err);
      return undefined;
    }
  }
  async searchHindiDrama(criteria: AIOSearchCriteria): Promise<AIODocument[] | undefined> {
    if (!criteria.aIOTitle || criteria.aIOTitle.length < 2) {
      console.log("Please provide a valid search criteria.");
      return undefined;
    }
    const normalizedTitle = criteria.aIOTitle;
    const first20Chars = normalizedTitle.slice(0, 20);

    const query = {
      aIOTitle: { $regex: new RegExp(first20Chars, "i") },
    };

    let specialQuery = {};
    if (first20Chars.length > 4) {
      const keywords = first20Chars
        .replace(/\s+/g, " ")
        .split(" ")
        .map((keyword) => `(?=.*${keyword})`)
        .join("");
      const regexPattern = new RegExp(`^${keywords}`, "i");

      specialQuery = {
        aIOTitle: { $regex: regexPattern },
      };
    }

    try {
      let results = await this.HindiDramaModel.find(query);

      if (results.length === 0 && Object.keys(specialQuery).length > 0) {
        results = await this.HindiDramaModel.find(specialQuery);
      }

      return results;
    } catch (err) {
      console.error("Error executing the query:", err);
      return undefined;
    }
  }

  async addAIO(shareId: number, messageIds: number[]) {
    const aioDocument = await this.AIOModel.findOne({ shareId });
    if (aioDocument) {
      await this.AIOModel.findByIdAndUpdate(
        aioDocument.id,
        { $push: { messageIds: { $each: messageIds } } },
        { new: true }
      );
      return true;
    } else {
      return false;
    }
  }

  async deleteAIO(shareId: number) {
    const animeDocument = await this.AIOModel.findOne({ shareId });
    if (animeDocument) {
      await this.AIOModel.findByIdAndDelete(animeDocument.id);
      return true;
    } else {
      return false;
    }
  }

  async updateAIOAttribute(shareId: number, updateQuery: any) {
    try {
      await AIOModel.updateOne({ shareId: shareId }, { $set: updateQuery });
      return true;
    } catch (error) {
      console.error("Error updating drama attribute:", error);
      return false;
    }
  }

  //invite
  async addInvite(userId: string, invitedUsername: string, invitedUserId: string): Promise<void> {
    await this.inviteService.addInvite(userId, invitedUsername, invitedUserId);
  }

  async getInviteUser(userId: string): Promise<InviteUser | null> {
    return this.inviteService.getInviteUser(userId);
  }

  async canRequest(userId: string): Promise<boolean> {
    return this.inviteService.canRequest(userId);
  }

  async useRequest(userId: string): Promise<void> {
    await this.inviteService.useRequest(userId);
  }

  // token
  async hasGeneratedToken(userId: string): Promise<boolean> {
    try {
      const tokenData = await this.TokenModel.findOne({ userId });
      return tokenData !== null;
    } catch (error) {
      console.error("Error checking if token exists for user:", error);
      throw error;
    }
  }

  async verifyAndValidateToken(userId: string): Promise<boolean> {
    try {
      const tokenData = await this.TokenModel.findOne({ userId });

      if (!tokenData) {
        console.error("Token not found in the database");
        return false;
      } else {
        const decoded = jwt.verify(tokenData.token, env.jwtSecret) as { userId: string };

        if (new Date() > tokenData.expiresAt) {
          console.error("Token has expired");
          return false;
        }

        return true;
      }
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.error("Token has expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.error("Invalid token");
      } else {
        console.error("Unexpected error during token verification:", error);
      }

      return false;
    }
  }

  async generateNewToken(userId: string): Promise<string> {
    const newToken = jwt.sign({ userId }, env.jwtSecret, { expiresIn: "24h" });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const existingToken = await this.TokenModel.findOne({ userId });

      if (existingToken) {
        existingToken.token = newToken;
        existingToken.expiresAt = expiresAt;
        await existingToken.save();
      } else {
        const newTokenData = new this.TokenModel({ userId, token: newToken, expiresAt });
        await newTokenData.save();
      }

      return newToken;
    } catch (error) {
      console.error("Error generating or saving token:", error);
      throw error;
    }
  }

  async manageToken(userId: string, token?: string): Promise<{ token: string; message: string }> {
    try {
      const hasToken = await this.hasGeneratedToken(userId);
      if (!hasToken) {
        const newToken = await this.generateNewToken(userId);
        return { token: newToken, message: "No token found. New token generated." };
      }
      if (token) {
        const isValid = await this.verifyAndValidateToken(userId);

        if (isValid) {
          return { token, message: "Token is valid." };
        } else {
          const newToken = await this.generateNewToken(userId);
          return { token: newToken, message: "Token expired or invalid. New token generated." };
        }
      } else {
        const newToken = await this.generateNewToken(userId);
        return { token: newToken, message: " New token generated." };
      }
    } catch (error) {
      console.error("Error managing token:", error);
      throw error;
    }
  }
  // sort link
  async addLinkToFirstSort(newLink: { shareId: number; aioShortUrl: string }): Promise<boolean> {
    try {
      const result = await SortModel.updateOne(
        {},
        { $push: { sort: { $each: [newLink], $position: 0 } } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Error adding link to first sort:", error);
      return false;
    }
  }

  // Function to get the first item in the sort array
  async getFirstSortItem(): Promise<SortDocument | null> {
    try {
      const document = await SortModel.findOne({}, { sort: { $slice: 1 } });
      if (!document || document.sort.length === 0) {
        console.log("No document found or the sort array is empty.");
        return null;
      }
      return document;
    } catch (error) {
      console.error("Error retrieving first sort item:", error);
      return null;
    }
  }

  // Function to set the current active share ID
  async setActiveShareId(newActiveShareId: string): Promise<boolean> {
    try {
      const result = await SortModel.updateOne(
        {},
        { $set: { currentActivePath: newActiveShareId } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Error setting active share ID:", error);
      return false;
    }
  }

  // Function to update both the first sort and the current active path atomically
  async updateFirstSortAndActivePath(
    newLink: { shareId: number; aioShortUrl: string },
    newActiveShareId: string
  ): Promise<boolean> {
    try {
      const result = await SortModel.updateOne(
        {},
        {
          $push: { sort: { $each: [newLink], $position: 0 } },
          $set: { currentActivePath: newActiveShareId },
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Error updating first sort and active path:", error);
      return false;
    }
  }
}

const mongoDB = new MongoDB();

export default mongoDB;
