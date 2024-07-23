import mongoose from "mongoose"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"
import { Tweet } from "../models/tweet.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!videoId) {
        throw new ApiError(400, "videoId is required")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        // If the video doesn't exist, delete all comments associated with the video ID
        await Comment.deleteMany({ video: videoId })
        throw new ApiError(
            400,
            "There is no such video. All associated comments have been deleted"
        )
    }

    const commentAggregate = Comment.aggregate([
        {
            $match: {
                video: { $eq: { $toObjectId: videoId } },
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
            },
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes",
                },
                owner: {
                    $first: "$owner",
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                },
                isLiked: 1,
            },
        },
    ])
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    }
    const comments = await Comment.aggregatePaginate(commentsAggregate, options)

    if (!comments || comments.length === 0) {
        return res
            .status(200)
            .json(new ApiResponse(200, {}, "No commments in this video!!"))
    }
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                comments,
                "Comments of the video fetched Successfully"
            )
        )
})

const addComment = asyncHandler(async (req, res) => {
    let id
    let model
    // TODO: add a comment to a video or tweet
    const { videoId = "", tweetId = "" } = req.params
    const { commentContent } = req.body
    if (!commentContent) {
        throw new ApiError(400, "Comment content is required")
    }
    if (videoId === "" && tweetId === "") {
        throw new ApiError(
            400,
            "Atleast select any one among tweet and video to comment on"
        )
    }

    if (videoId === "") {
        id = tweetId
        model = Tweet
        videoId = null
    } else if (tweetId === "") {
        id = videoId
        model = Video
        tweetId = null
    }

    try {
        const target = await model.findById(id)
        if (!target || (model.toString() === "Video" && !target.isPublished)) {
            throw new ApiError(404, "Target not found")
        }
        if (!commentContent) {
            throw new ApiError(400, "Comment content is required")
        }
        const comment = new Comment.create({
            content: commentContent,
            [videoId ? "video" : "tweet"]: videoId || tweetId,
            owner: req.user?._id,
        })
        if (!comment) {
            throw new ApiError(500, "Failed to create comment")
        }
        return res
            .status(200)
            .json(new ApiResponse(200, comment, "Comment added successfully"))
    } catch (error) {
        throw new ApiError(500, error?.message || "Failed to add comment")
    }
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const { commentId } = req.params
    const { commentContent } = req.body
    if (!commentId) {
        throw new ApiError(400, "Comment ID is required")
    }
    try {
        const comment = await Comment.findById(commentId)
        if (!comment) {
            throw new ApiError(404, "Comment not found")
        }
        // Check if the video is published or not
        const videoId = comment.video
        const video = await Video.findById(videoId)

        if (!video) {
            await Comment.deleteMany({ video: videoId })
            return res
                .status(404)
                .json(new ApiResponse(404, {}, "Comment doesn't exist"))
        }

        if (!video.isPublished) {
            throw new ApiError(404, "Video doesn't exists")
        }
        if (comment.owner.toString() !== req.user?._id.toString()) {
            throw new ApiError(300, "Unauthorized Access")
        }
        if (!commentContent) {
            throw new ApiError(400, "commentContent is required!!")
        }

        const UpdateComment = await Comment.findByIdAndUpdate(
            commentId,
            {
                $set: {
                    content: commentContent,
                },
            },
            {
                new: true,
            }
        )
        if (!UpdateComment) {
            throw new ApiError(500, "Unable to update the comment")
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    UpdateComment,
                    "Comment updated Successfully"
                )
            )
    } catch (error) {
        throw new ApiError(500, error?.message || "Failed to update comment")
    }
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const { commentId } = req.params
    if (!commentId) {
        throw new ApiError(400, "commentId is required!!")
    }
    try {
        const comment = await Comment.findById(commentId)
        if (!comment) {
            throw new ApiError(404, "comment not found")
        }

        // Checking whether video is published or not
        const videoId = comment.video
        const video = await Video.findById(videoId)

        //check if video is exists or not
        // If video do not exists, no point in keeping any comments related to it
        if (!video) {
            await Comment.deleteMany({ video: videoId })
            throw new ApiError(
                400,
                "There is no such Video. All associated comments have been deleted"
            )
        }

        if (
            video.owner.toString() !== req.user?._id.toString() &&
            !video.isPublished
        ) {
            throw new ApiError(300, "Video doesn't exists")
        }
        if (comment.owner.toString() !== req.user?._id.toString()) {
            throw new ApiError(300, "Unauthorized Access")
        }

        const DeletedComment = await Comment.findByIdAndDelete(commentId)
        if (!DeletedComment) {
            throw new ApiError(500, "Unable to delete the comment")
        }

        return res
            .staus(200)
            .json(new ApiResponse(200, {}, "Comment deleted successfully "))
    } catch (error) {
        throw new ApiError(
            500,
            error?.message || "Unable to delete the comment"
        )
    }
})

export { getVideoComments, addComment, updateComment, deleteComment }
