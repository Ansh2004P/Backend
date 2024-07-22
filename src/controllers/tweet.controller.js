import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const { tweetContent } = req.body
    if (!tweetContent) {
        throw new ApiError(400, "Tweet cannot be empty")
    }

    try {
        const tweet = await Tweet.create({
            content: tweetContent,
            owner: req.user?._id,
        })

        if (!tweet) {
            throw new ApiError(
                500,
                "Unable to create tweet!! try again after some time "
            )
        }

        return res
            .status(200)
            .json(
                new ApiResponse(200, { tweet }, "Tweet published successfully")
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to create tweet")
    }
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params
    if (!userId) {
        throw new ApiError(400, "UserId is required")
    }
    try {
        const tweet = await Tweet.aggregate([
            {
                $match: {
                    owner: { $eq: { $toObjectId: userId } },
                },
            },
            {
                $group: {
                    _id: "owner",
                    tweets: { $push: "$content" },
                },
            },
            {
                $project: {
                    _id: 0,
                    tweets: 1,
                },
            },
        ])
        if (!tweet || tweet.length === 0) {
            return res
                .status(200)
                .json(new ApiResponse(200, [], "User have no tweets"))
        }
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    tweet,
                    "Tweet for the user fetched successfully!"
                )
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to get user tweets")
    }
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { tweetId } = req.params
    const { tweetContent } = req.body
    if (!tweetId || !tweetContent) {
        throw new ApiError(400, "Tweet you are trying to update does not exist")
    }
    try {
        //Get the tweet from database
        const tweet = await Tweet.findById(tweetId)
        if (!tweet) {
            throw new ApiError(404, "Tweet does not exist")
        }

        // Check whether user trying to update is owner or not
        if (tweet.owner.toString() !== req.user._id.toString()) {
            throw new ApiError(300, "Unauthorized access")
        }

        //Update the tweet
        const updateTweet = await Tweet.findByIdAndUpdate(
            tweetId,
            {
                $set: {
                    content: tweetContent,
                },
            },
            { new: true }
        )
        if (!updateTweet) {
            throw new ApiError(500, "Unable to update tweet")
        }

        return res
            .status(200)
            .json(
                new ApiResponse(200, updatedTweet, "Tweet updated successfully")
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to update tweet")
    }
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params

    if (!tweetId) {
        throw new ApiError(400, "tweet you are trying to delete does not exist")
    }

    try {
        const tweet = await Tweet.findById(tweetId)
        if (!existingTweet) {
            throw new ApiError(404, "Tweet does not exist")
        }

        //check whether user trying to delete is owner or not
        if (tweet.owner.toString() !== req.user._id.toString()) {
            throw new ApiError(300, "Unauthorized access")
        }

        // delete the tweet
        const deleteTweet = await Tweet.findByIdAndDelete(tweetId)
        if (!deleteTweet) {
            throw new ApiError(500, "Unable to delete tweet")
        }
        return res
            .status(200)
            .json(new ApiResponse(200, {}, "Tweet deleted successfully"))
    } catch (error) {
        throw new ApiError(500, error?.message || "Unable to delete tweet")
    }
})

export { createTweet, getUserTweets, updateTweet, deleteTweet }
