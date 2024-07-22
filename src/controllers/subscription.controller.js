import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!channelId) {
        throw new ApiError(400, "ChannelId is required")
    }

    const userId = req.user?._id
    const credential = { subscriber: userId, channel: channelId }

    try {
        const subscribed = await Subscription.findOne(credential)

        if (!subscribed) {
            // Not subscribed: Create a new subscription
            const newSubscription = await Subscription.create(credential)
            if (!newSubscription) {
                throw new ApiError(500, "Unable to subscribe to the channel")
            }
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        newSubscription,
                        "Channel subscribed successfully!"
                    )
                )
        } else {
            // Subscribed: Delete the subscription
            const deletedSubscription = await Subscription.deleteOne(credential)
            if (!deletedSubscription) {
                throw new ApiError(
                    500,
                    "Unable to unsubscribe from the channel"
                )
            }
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        deletedSubscription,
                        "Channel unsubscribed successfully!"
                    )
                )
        }
    } catch (error) {
        throw new ApiError(
            500,
            error.message || "Unable to toggle subscription"
        )
    }
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if (!subscriberId) {
        throw new ApiError(400, "ChannelId is required")
    }
    try {
        const subscribers = await Subscription.aggregate([
            {
                $match: { channel: { $eq: { $toObjectId: subscriberId } } },
            },
            {
                $group: {
                    _id: "subscriber",
                    subscribers: { $push: "$subscriber" },
                },
            },
            {
                $project: {
                    _id: 0,
                    subscribers: 1,
                },
            },
        ])

        if (!subscribers || subscribers.length === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        [],
                        "No subscribers found for the channel"
                    )
                )
        }
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    subscribers,
                    "All Subscribers fetched Successfully!!"
                )
            )
    } catch (error) {
        throw new ApiError(500, error.message || "Unable to get subscribers")
    }
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    if (!channelId) {
        throw new ApiError(400, "ChannelId is required")
    }

    try {
        const subscribedChannels = await Subscription.aggregate([
            {
                $match: { subscriber: { $eq: { $toObjectId: channelId } } },
            },
            {
                $group: {
                    _id: "subscriber",
                    subscribedChannels: { $push: "$channel" },
                },
            },
            {
                $project: {
                    _id: 0,
                    subscribedChannels: 1,
                },
            },
        ])

        if (!subscribedChannels || subscribedChannels.length === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        [],
                        "No subscribedChannel found for the user"
                    )
                )
        }
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    subscribedChannels,
                    "All SubscribedChannels fetched Successfully!!"
                )
            )
    } catch (error) {
        throw new ApiError(
            500,
            error.message || "Unable to get subscribed channels"
        )
    }
})

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels }
