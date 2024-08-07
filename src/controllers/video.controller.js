import { isValidObjectId } from "mongoose"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { Video } from "../models/video.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const isUserOwner = async (videoId, req) => {
    const video = await Video.findById(videoId)

    if (video?.owner.toString() !== req.user?._id.toString()) {
        return false
    }
    return true
}

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination

    // Parse page and limit to numbers
    page = parseInt(page, 10)
    limit = parseInt(limit, 10)

    //Validate and adjust page and limit values
    page = Math.max(1, page)
    limit = Math.min(20, Math, max(1, limit))

    const pipeline = []

    // Match videos by owner userId if provided
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "userId is invalid")
        }

        pipeline.push({
            $match: {
                owner: { $eq: { $toObjectId: userId } },
            },
        })
    }

    // Match videos based on search query
    if (query) {
        pipeline.push({
            $match: {
                $text: {
                    $search: query,
                },
            },
        })
    }

    // Sort pipeline stage based on sortBy and sortType
    const sortCriteria = {}
    if (sortBy && sortType) {
        sortCriteria[sortBy] = sortType === "asc" ? 1 : -1
        pipeline.push({
            $sort: sortCriteria,
        })
    } else {
        sortCriteria["createdAt"] = -1
        pipeline.push({
            $sort: sortCriteria,
        })
    }

    // Apply pagination using skip and limit
    pipeline.push({
        $skip: (page - 1) * limit,
    })
    pipeline.push({
        $limit: limit,
    })

    // Execute aggregation pipeline
    const Videos = await Video.aggregate(pipeline)

    if (!Videos || Videos.length === 0) {
        throw new ApiError(404, "Videos not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, Videos, "Videos fetched Successfully"))
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video
    if (!title || !description) {
        throw new ApiError(400, "Title and Description are required")
    }

    //Retrieve the video and thumbnail
    const videoLocalPath = req.files?.videoFile[0].path
    const thumbnailLocalPath = req.files?.thumbnail[0].path

    if (!videoLocalPath) {
        throw new ApiError(404, "Video is required")
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(404, "Thumbnail is required")
    }

    //Upload video and thumbnail to cloudinary
    const video = await uploadOnCloudinary(videoLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!video?.url) {
        throw new ApiError(500, "Failed to upload video")
    }
    if (!thumbnail?.url) {
        throw new ApiError(500, "Failed to upload thumbnail")
    }

    const newVideo = await Video.create({
        videoFile: video.url,
        tumbnail: thumbnailLocalPath?.url,
        title,
        description,
        duration: video?.duration,
        isPublished: true,
        owner: req.user._id,
    })

    return res
        .status(200)
        .json(new ApiResponse(200, newVideo, "Video published successfully"))
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    // checking videoId is given or not
    if (!videoId) {
        throw new ApiError(400, "videoId is required!!!")
    }

    //finding video based on Id
    const video = await Video.findById(videoId)

    //checking video is exists or not, is made public or not
    if (!video || !video?.isPublished) {
        throw new ApiError(404, "Video not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(404, video, "Video fetched successfully"))
})

const updateVideo = asyncHandler(async (req, res) => {
    //TODO: update video details like title, description, thumbnail

    //checking videoId is given or not
    const { videoId } = req.params
    if (!videoId) {
        throw new ApiError(400, "videoId is required!!!")
    }

    // checking video is exists or not
    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    //Checking for the user trying to update the video is the owner of the video or not
    const isOwner = await isUserOwner(videoId, req)
    if (!isOwner) {
        throw new ApiError(300, "Unauthorized access")
    }

    //getting the part which is to be updated by user and validating if any one of them are provided or not
    const { title = video.title, description = video.description } = req.body
    const newVideo = req.files["newVideo"] ? req.files["newVideo"][0] : null
    const newThumbNail = req.files["newThumbNail"]
        ? req.files["newThumbNail"][0]
        : null
    if (!newVideo || !newThumbNail) {
        throw new ApiError(400, "All fields cannot be empty")
    }

    let updatedVideo, updatedThumbnail
    //uploading newVideo or/and newThumbNail to cloudinary after validating if they are provided or not
    if (newVideo) {
        updatedVideo = await uploadOnCloudinary(newVideo.path)
        if (!updatedVideo?.url) {
            throw new ApiError(500, "Failed to upload video")
        }
    }

    if (newThumbNail) {
        updatedThumbnail = await uploadOnCloudinary(newThumbNail.path)
        if (!updatedThumbnail?.url) {
            throw new ApiError(500, "Failed to upload thumbnail")
        }
    }

    //updating the new details
    const updatedDetails = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title: title,
                description: description,
                thumbNail: updatedThumbnail?.url,
                videoFile: updatedVideo?.url,
                duration: updatedVideo?.duration,
            },
        },
        { new: true }
    )
    if (!updatedDetails) {
        throw new ApiError(
            500,
            "Something went wrong while updating the details"
        )
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedDetails, "Video Updated Successfully")
        )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    if (!videoId) {
        throw new ApiError(400, "videoId is required!!!")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    const authorized = await isUserOwner(videoId, req)
    if (!authorized) {
        throw new ApiError(300, "Unauthorized access")
    }

    const videoDeleted = await Video.findByIdAndDelete(videoId)

    if (!videoDeleted) {
        throw new ApiError(500, "Something went wrong deleting the video")
    }

    // TODO: delete video from cloudinary, playlist if it exits, remove all comments, likes on that post
    return res
        .status(200)
        .json(new ApiResponse(200, videoDeleted, "Video deleted successfully"))
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!videoId) {
        throw new ApiError(400, "videoId is required!!!")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }
    const isOwner = await isUserOwner(videoId, req)
    if (!isOwner) {
        throw new ApiError(300, "Unauthorized access")
    }

    const updateVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished,
            },
        },
        { new: true }
    )

    if (!updateVideo) {
        throw new ApiError(500, "Something went wrong toggling the status")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updateVideo,
                "Publish Status toggled successfully"
            )
        )
})

export {
    getAllVideos,
    getVideoById,
    publishAVideo,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
}
